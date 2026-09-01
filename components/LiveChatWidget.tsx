"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "6Le7xJQtAAAAAGZUTG4KU1grtYTF_1nVRAiSrL2l";

interface ChatMessage {
  id: string;
  thread_id: string;
  sender: "customer" | "staff";
  sender_name: string;
  text: string;
  created_at: string;
  status?: "sending" | "sent";
}

// Web Audio API notification chime for incoming staff replies
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    osc2.frequency.setValueAtTime(440, now); // A4
    osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  } catch (_) {}
}

export default function LiveChatWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [threadId, setThreadId] = useState<string>("");

  // Customer Lead Fields
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isLeadCaptured, setIsLeadCaptured] = useState(false);
  const [leadError, setLeadError] = useState("");

  const [showMenu, setShowMenu] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Google reCAPTCHA v3 script dynamically
  useEffect(() => {
    if (typeof window === "undefined") return;
    const scriptId = "google-recaptcha-v3-chat";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Inactivity Timeout: 10 minutes (600,000 ms)
  const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

  // Do not render on admin dashboard
  if (pathname?.startsWith("/admin")) return null;

  const updateActivity = () => {
    localStorage.setItem("ut_live_chat_last_active", String(Date.now()));
  };

  // Initialize or restore session with 10-minute timeout check
  const initSession = (forceNew = false) => {
    const lastActiveStr = typeof window !== "undefined" ? localStorage.getItem("ut_live_chat_last_active") : null;
    const isTimedOut = lastActiveStr ? Date.now() - Number(lastActiveStr) > INACTIVITY_TIMEOUT_MS : false;

    if (forceNew || isTimedOut) {
      localStorage.removeItem("ut_live_chat_thread_id");
      localStorage.removeItem("ut_live_chat_name");
      localStorage.removeItem("ut_live_chat_email");
      localStorage.removeItem("ut_live_chat_phone");
      localStorage.removeItem("ut_live_chat_last_active");

      const newThread = `ut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem("ut_live_chat_thread_id", newThread);
      setThreadId(newThread);
      setIsClosed(false);
      setMessages([]);
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setIsLeadCaptured(false);

      if (isTimedOut && !forceNew) {
        setLeadError("⏳ Chat timed out after 10 minutes of inactivity. Please re-enter your details to start fresh.");
      }
      return;
    }

    let savedThread = localStorage.getItem("ut_live_chat_thread_id");
    if (!savedThread) {
      savedThread = `ut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem("ut_live_chat_thread_id", savedThread);
    }
    setThreadId(savedThread);
    setIsClosed(false);
    setMessages([]);

    const savedName = localStorage.getItem("ut_live_chat_name") || "";
    const savedEmail = localStorage.getItem("ut_live_chat_email") || "";
    const savedPhone = localStorage.getItem("ut_live_chat_phone") || "";

    setCustomerName(savedName);
    setCustomerEmail(savedEmail);
    setCustomerPhone(savedPhone);

    if (savedName && savedEmail && savedPhone) {
      setIsLeadCaptured(true);
    } else {
      setIsLeadCaptured(false);
    }
  };

  useEffect(() => {
    initSession();
  }, []);

  // Background 10-minute inactivity check interval
  useEffect(() => {
    if (!isLeadCaptured) return;
    const timeoutInterval = setInterval(() => {
      const lastActiveStr = localStorage.getItem("ut_live_chat_last_active");
      if (lastActiveStr && Date.now() - Number(lastActiveStr) > INACTIVITY_TIMEOUT_MS) {
        initSession(true);
        setLeadError("⏳ Chat timed out after 10 minutes of inactivity. Please re-enter your details to start fresh.");
      }
    }, 10000);

    return () => clearInterval(timeoutInterval);
  }, [isLeadCaptured]);

  // Fetch message history
  const fetchHistory = async (id: string) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/live-chat/history?threadId=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.messages)) {
          setMessages((prev) => {
            const map = new Map<string, ChatMessage>();
            prev.forEach((m) => map.set(m.id, m));
            data.messages.forEach((m: ChatMessage) => {
              for (const [k, v] of Array.from(map.entries())) {
                if (k.startsWith("opt_") && v.text === m.text && v.sender === m.sender) {
                  map.delete(k);
                }
              }
              map.set(m.id, { ...m, status: "sent" });
            });
            return Array.from(map.values()).sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });

          if (data.messages.some((m: ChatMessage) => m.text.includes("conversation has been ended") || m.text.includes("conversation has ended"))) {
            setIsClosed(true);
          }
        }
      }
    } catch (_) {}
  };

  // Initial fetch and Realtime subscription
  useEffect(() => {
    if (!threadId || !isLeadCaptured) return;

    fetchHistory(threadId);

    const channel = supabase
      .channel(`chat_${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload: { new: ChatMessage }) => {
          const newMsg = payload.new;
          setMessages((prev) => {
            const filtered = prev.filter((m) => !(m.id.startsWith("opt_") && m.text === newMsg.text));
            if (filtered.some((m) => m.id === newMsg.id)) return filtered;
            return [...filtered, { ...newMsg, status: "sent" }];
          });

          if (newMsg.sender === "staff") {
            playChime();
            if (!isOpen) {
              setHasUnread(true);
            }
          }
        }
      )
      .subscribe();

    const pollInterval = setInterval(() => {
      fetchHistory(threadId);
    }, 1500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [threadId, isOpen, isLeadCaptured]);

  // Scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Handle Starting Chat after Details Form with Strict Validation
  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError("");

    const name = customerName.trim();
    const email = customerEmail.trim().toLowerCase();
    const rawDigits = customerPhone.replace(/\D/g, "");
    const phone = rawDigits.slice(-10);

    // 1. Strict Name Validation
    if (!name || name.length < 2) {
      setLeadError("Please enter your full name (at least 2 letters).");
      return;
    }
    if (!/^[a-zA-Z\s.'-]+$/.test(name)) {
      setLeadError("Name can only contain letters and spaces.");
      return;
    }
    const dummyNames = ["test", "testing", "asdf", "qwerty", "abc", "xyz", "none", "admin", "fake", "user", "guest"];
    if (dummyNames.includes(name.toLowerCase()) || /^([a-zA-Z])\1{2,}$/.test(name)) {
      setLeadError("Please enter a genuine full name.");
      return;
    }

    // 2. Strict Email Validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;
    if (!email || !emailRegex.test(email) || email.includes("..") || email.startsWith(".") || email.endsWith(".")) {
      setLeadError("Please enter a valid email address (e.g. name@gmail.com).");
      return;
    }
    const dummyEmails = [
      "test@test.com", "a@a.com", "abc@abc.com", "xyz@xyz.com", "asdf@asdf.com",
      "admin@admin.com", "fake@fake.com", "none@none.com", "123@123.com", "sample@sample.com"
    ];
    if (dummyEmails.includes(email)) {
      setLeadError("Please enter a genuine personal or business email address.");
      return;
    }

    // 3. Strict Phone Number Validation (Indian 10-digit mobile)
    if (rawDigits.length !== 10 && (rawDigits.length !== 12 || !rawDigits.startsWith("91"))) {
      setLeadError("Phone number must be exactly 10 digits.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setLeadError("Please enter a valid Indian mobile number starting with 6, 7, 8, or 9.");
      return;
    }
    // Reject repeated digits (e.g. 0000000000, 9999999999)
    if (/^(\d)\1{9}$/.test(phone)) {
      setLeadError("Please enter a valid mobile number, not repeated digits.");
      return;
    }
    // Reject fake sequential patterns
    const fakeSequences = ["1234567890", "0123456789", "9876543210", "0987654321", "9898989898", "9191919191", "9090909090", "9999900000", "7000000000", "8000000000", "9000000000"];
    if (fakeSequences.includes(phone)) {
      setLeadError("Please enter a genuine mobile number.");
      return;
    }
    // Must have at least 4 unique digits
    const uniqueDigits = new Set(phone.split("")).size;
    if (uniqueDigits < 4) {
      setLeadError("Please enter a genuine 10-digit mobile number.");
      return;
    }

    localStorage.setItem("ut_live_chat_name", name);
    localStorage.setItem("ut_live_chat_email", email);
    localStorage.setItem("ut_live_chat_phone", phone);
    updateActivity();
    setIsLeadCaptured(true);
  };

  const getRecaptchaToken = async (): Promise<string> => {
    if (typeof window !== "undefined" && window.grecaptcha) {
      return new Promise<string>((resolve) => {
        window.grecaptcha.ready(async () => {
          try {
            const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: "live_chat_send" });
            resolve(token);
          } catch {
            resolve("");
          }
        });
      });
    }
    return "";
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || isSending || !threadId) return;

    updateActivity();
    const optimisticId = `opt_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      thread_id: threadId,
      sender: "customer",
      sender_name: customerName || "You",
      text: text,
      created_at: new Date().toISOString(),
      status: "sending",
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setIsSending(true);

    try {
      const recaptchaToken = await getRecaptchaToken();

      const res = await fetch("/api/live-chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          senderName: customerName,
          email: customerEmail,
          phone: customerPhone,
          locality: "Srinagar",
          text: text,
          recaptchaToken,
        }),
      });

      if (res.ok) {
        updateActivity();
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, status: "sent" } : m))
        );
      }
    } catch (err) {
      console.warn("Live chat send error:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleEndChat = async () => {
    setShowMenu(false);
    if (!threadId) return;

    try {
      await fetch("/api/live-chat/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, closedBy: "customer" }),
      });
      setIsClosed(true);
      fetchHistory(threadId);
    } catch (_) {}
  };

  const handleStartNewChat = () => {
    initSession(true);
  };

  return (
    <>
      {/* ─── FLOATING TOGGLE BUTTON (Bottom Right) ─── */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
        {/* Unread Message Tooltip */}
        {!isOpen && hasUnread && (
          <div
            onClick={() => {
              setIsOpen(true);
              setHasUnread(false);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-cyan-400 shadow-2xl transition-all cursor-pointer animate-bounce border border-cyan-300"
            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Farm Team replied! Click to view</span>
          </div>
        )}

        {/* Toggle Button with Clean Inline SVG Icon (No Font Glitches) */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            setHasUnread(false);
          }}
          aria-label="Open Live Chat with Urban Trout Team"
          className="group relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 active:scale-95 cursor-pointer"
          style={{
            background: "linear-gradient(135deg, #0e5a77, #072f3f)",
            border: "1.5px solid rgba(114, 221, 253, 0.6)",
            boxShadow: "0 0 25px rgba(114, 221, 253, 0.45), 0 8px 24px rgba(0,0,0,0.6)",
          }}
        >
          {/* Online Pulse Indicator */}
          <span className="absolute top-1 right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400 border-2 border-slate-950" />
          </span>

          {isOpen ? (
            /* Clean SVG Close Icon */
            <svg
              className="w-6 h-6 text-cyan-200 transition-transform group-hover:rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            /* Clean SVG Speech Bubble Icon */
            <svg
              className="w-7 h-7 text-cyan-200 transition-transform group-hover:scale-110"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          )}
        </button>
      </div>

      {/* ─── LIVE CHAT POPUP WINDOW ─── */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[92vw] sm:w-[400px] h-[560px] max-h-[82vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl transition-all border animate-fade-in"
          style={{
            background: "rgba(4, 15, 24, 0.98)",
            borderColor: "rgba(114, 221, 253, 0.35)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.9), 0 0 35px rgba(114,221,253,0.2)",
          }}
        >
          {/* ── Header ── */}
          <div className="relative flex items-center justify-between px-4 py-3.5 bg-slate-950/95 border-b border-cyan-900/40">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src="/sitelogo.png"
                  alt="Urban Trout"
                  className="w-10 h-10 rounded-xl object-contain bg-slate-900 p-1 border border-cyan-500/40 shadow-inner"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
              </div>
              <div>
                <h3
                  className="text-sm font-bold text-white tracking-wide leading-tight"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  Urban Trout Support
                </h3>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Farm Team Live · Replies in &lt; 2 mins
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Options Menu Button (SVG) - Only when in active chat */}
              {isLeadCaptured && (
                <button
                  type="button"
                  onClick={() => setShowMenu(!showMenu)}
                  aria-label="Chat Menu"
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
                  </svg>
                </button>
              )}

              {/* Close Button (SVG) */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute top-14 right-4 z-20 w-48 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl py-1.5 text-xs text-slate-200 animate-fade-in">
                <button
                  type="button"
                  onClick={handleEndChat}
                  className="w-full px-3.5 py-2 text-left hover:bg-red-500/20 text-red-400 flex items-center gap-2 transition-colors cursor-pointer font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.828a5 5 0 010-7.072m7.072 0a5 5 0 010 7.072M12 3v9" />
                  </svg>
                  <span>End Conversation</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  className="w-full px-3.5 py-2 text-left hover:bg-cyan-500/20 text-cyan-300 flex items-center gap-2 transition-colors cursor-pointer font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Start New Chat</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Body: Lead Capture Gate vs Live Chat Conversation ── */}
          {!isLeadCaptured ? (
            /* ── MANDATORY LEAD ONBOARDING FORM ── */
            <div className="flex-1 p-5 flex flex-col justify-center overflow-y-auto bg-slate-950/60 font-sans">
              <div className="text-center mb-4 space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center mx-auto text-cyan-300 mb-2 shadow-lg shadow-cyan-500/10">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
                </div>
                <h4
                  className="text-base font-bold text-white tracking-wide"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  Start Live Chat
                </h4>
                <p className="text-xs text-slate-400 max-w-[260px] mx-auto leading-relaxed">
                  Please provide your contact details to connect with our Srinagar farm team.
                </p>
              </div>

              {leadError && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs text-center font-medium animate-fade-in">
                  {leadError}
                </div>
              )}

              <form onSubmit={handleStartChat} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aamir Khan"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. aamir@gmail.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Phone Number (10-Digit) *
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">+91</span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="94190 00000"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                      className="w-full pl-12 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-mono font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-bold text-xs tracking-wide uppercase transition-all duration-200 active:scale-98 shadow-lg shadow-cyan-500/25 cursor-pointer mt-2"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  Start Conversation →
                </button>

                <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1 pt-1 font-sans">
                  <span>🔒 Protected by reCAPTCHA</span>
                </p>
              </form>
            </div>
          ) : (
            /* ── ACTIVE CHAT CONVERSATION VIEW ── */
            <>
              {/* Message Scroll Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 font-sans bg-slate-950/40">
                {/* Greeting Card */}
                <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-slate-200 space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                    <span>👋</span>
                    <span>Hi {customerName || "there"}!</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                    How can we assist you today? Type your message below and our farm team in Naseem Bagh will reply live.
                  </p>
                </div>

                {/* Messages List */}
                {messages.map((msg) => {
                  const isMe = msg.sender === "customer";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"} space-y-1`}
                    >
                      <div className="flex items-center gap-1.5 px-1">
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {isMe ? "You" : msg.sender_name || "Farm Team"}
                        </span>
                        {!isMe && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/25 text-cyan-300 text-[9px] font-bold uppercase font-mono border border-cyan-500/40">
                            Support
                          </span>
                        )}
                      </div>
                      <div
                        className={`max-w-[84%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed break-words font-medium ${
                          isMe
                            ? "bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 rounded-br-none shadow-md shadow-cyan-500/15"
                            : "bg-slate-900 border border-slate-700 text-white rounded-bl-none shadow-md"
                        }`}
                        style={{ fontFamily: '"Manrope", sans-serif' }}
                      >
                        {msg.text}
                      </div>
                      <div className="flex items-center gap-1.5 px-1">
                        <span className="text-[11px] text-slate-300 font-mono font-medium">
                          {new Date(msg.created_at).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {isMe && (
                          <span className="text-xs text-cyan-300 font-bold">
                            {msg.status === "sending" ? "✓" : "✓✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Closed Conversation State Banner */}
                {isClosed && (
                  <div className="p-4 rounded-2xl bg-slate-900/95 border border-slate-700 text-center space-y-2.5 animate-fade-in my-2 shadow-xl">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-emerald-400 border border-slate-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-xs text-white font-bold">Conversation Ended</p>
                    <p className="text-[11px] text-slate-300">
                      Thank you for contacting Urban Trout. We are always happy to help!
                    </p>
                    <button
                      type="button"
                      onClick={handleStartNewChat}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-lg shadow-cyan-500/25"
                    >
                      Start New Conversation
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ── Input Box ── */}
              {!isClosed ? (
                <div className="p-3 bg-slate-950 border-t border-slate-800">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Type your message here…"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      disabled={isSending}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-medium"
                      style={{ fontFamily: '"Manrope", sans-serif' }}
                    />
                    <button
                      type="submit"
                      disabled={isSending || !inputText.trim()}
                      className="w-10 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 disabled:opacity-40 text-slate-950 flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
                    >
                      <svg className="w-4 h-4 text-slate-950 fill-current ml-0.5" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    </button>
                  </form>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono px-1">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Online Support
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-950 border-t border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={handleStartNewChat}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
                  >
                    Click here to start a new chat
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
