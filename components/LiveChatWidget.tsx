"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ChatMessage {
  id: string;
  thread_id: string;
  sender: "customer" | "staff";
  sender_name: string;
  text: string;
  created_at: string;
}

const QUICK_PROMPTS = [
  "🐟 Is fresh trout available for delivery today?",
  "🚚 How fast is doorstep delivery in Srinagar?",
  "🌿 Can I visit the farm in Naseem Bagh?",
  "🔪 What is the difference between whole & gutted trout?",
];

// Generates a clean, modern pleasant notification chime using Web Audio API
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
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showInfoForm, setShowInfoForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Do not render on admin dashboard
  if (pathname?.startsWith("/admin")) return null;

  // Initialize or restore session from localStorage
  useEffect(() => {
    let savedThread = localStorage.getItem("ut_live_chat_thread_id");
    if (!savedThread) {
      savedThread = `ut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem("ut_live_chat_thread_id", savedThread);
    }
    setThreadId(savedThread);

    const savedName = localStorage.getItem("ut_live_chat_name") || "";
    const savedPhone = localStorage.getItem("ut_live_chat_phone") || "";
    setCustomerName(savedName);
    setCustomerPhone(savedPhone);

    if (!savedName && !savedPhone) {
      setShowInfoForm(true);
    }
  }, []);

  // Fetch message history
  const fetchHistory = async (id: string) => {
    try {
      const res = await fetch(`/api/live-chat/history?threadId=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      }
    } catch (_) {}
  };

  // Initial fetch and Realtime subscription
  useEffect(() => {
    if (!threadId) return;

    fetchHistory(threadId);

    // Supabase Realtime WebSocket listener for instant live messages
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
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
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

    // 4-second polling fallback for 100% reliability
    const pollInterval = setInterval(() => {
      fetchHistory(threadId);
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [threadId, isOpen]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending || !threadId) return;

    setIsSending(true);
    if (!textToSend) setInputText("");

    const optimisticId = `opt_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      thread_id: threadId,
      sender: "customer",
      sender_name: customerName || "You",
      text: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch("/api/live-chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          senderName: customerName || "Website Visitor",
          phone: customerPhone || undefined,
          locality: "Srinagar",
          text: text,
        }),
      });

      if (res.ok) {
        // Save name/phone to localStorage if entered
        if (customerName) localStorage.setItem("ut_live_chat_name", customerName);
        if (customerPhone) localStorage.setItem("ut_live_chat_phone", customerPhone);
      }
    } catch (err) {
      console.warn("Live chat send notice:", err);
    } finally {
      setIsSending(false);
    }
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
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-900 bg-cyan-400 shadow-2xl transition-all cursor-pointer animate-bounce"
            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Farm Team replied! Click to view</span>
          </div>
        )}

        {/* Toggle Button */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            setHasUnread(false);
          }}
          aria-label="Open Live Chat with Farm Team"
          className="group relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 active:scale-95 cursor-pointer"
          style={{
            background: "linear-gradient(135deg, #0f4c64, #082937)",
            border: "1.5px solid rgba(114, 221, 253, 0.4)",
            boxShadow: "0 0 25px rgba(114, 221, 253, 0.35), 0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          {/* Online Pulse Indicator */}
          <span className="absolute top-1 right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-950" />
          </span>

          {isOpen ? (
            <span className="material-symbols-outlined text-cyan-300 text-2xl">close</span>
          ) : (
            <span className="material-symbols-outlined text-cyan-300 text-2xl group-hover:scale-110 transition-transform">
              chat_bubble
            </span>
          )}
        </button>
      </div>

      {/* ─── LIVE CHAT POPUP WINDOW ─── */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[92vw] sm:w-[390px] h-[540px] max-h-[82vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl transition-all border animate-fade-in"
          style={{
            background: "rgba(6, 23, 34, 0.95)",
            borderColor: "rgba(114, 221, 253, 0.25)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(114,221,253,0.15)",
          }}
        >
          {/* ── Chat Header ── */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-slate-950/80 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src="/sitelogo.png"
                  alt="Urban Trout"
                  className="w-9 h-9 rounded-xl object-contain bg-slate-900 p-1 border border-cyan-500/30"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  Urban Trout Farm Support
                </h3>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Farm Team Live · Replies in ~2 mins
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* ── Optional Visitor Info Bar ── */}
          {showInfoForm && (
            <div className="px-4 py-2.5 bg-cyan-950/40 border-b border-cyan-500/20 text-xs flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-cyan-300 font-semibold">
                <span>Want reply on WhatsApp too? (Optional)</span>
                <button
                  type="button"
                  onClick={() => setShowInfoForm(false)}
                  className="text-slate-400 hover:text-white"
                >
                  Skip
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Your Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <input
                  type="tel"
                  placeholder="WhatsApp Phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          {/* ── Message Area ── */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans">
            {/* Greeting Card */}
            <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <span className="material-symbols-outlined text-base">waving_hand</span>
                <span>Welcome to Urban Trout!</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Have a question about fresh harvest, same-day Srinagar delivery, custom trout cuts, or farm visits? Ask us below!
              </p>
            </div>

            {/* Quick Suggestion Chips (Shown if no messages yet) */}
            {messages.length === 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">
                  Quick Questions:
                </p>
                <div className="flex flex-col gap-1.5">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(prompt)}
                      className="text-left px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-cyan-950/50 border border-slate-800 hover:border-cyan-500/40 text-[11px] text-slate-300 hover:text-cyan-300 transition-all cursor-pointer shadow-sm"
                      style={{ fontFamily: '"Manrope", sans-serif' }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages List */}
            {messages.map((msg) => {
              const isMe = msg.sender === "customer";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"} space-y-1`}
                >
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-[10px] text-slate-500 font-medium">
                      {isMe ? "You" : msg.sender_name || "Farm Team"}
                    </span>
                    {!isMe && (
                      <span className="px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[8px] font-bold uppercase font-mono">
                        Staff
                      </span>
                    )}
                  </div>
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      isMe
                        ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-slate-950 font-medium rounded-br-none shadow-md shadow-cyan-500/10"
                        : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-md"
                    }`}
                    style={{ fontFamily: '"Manrope", sans-serif' }}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-slate-600 px-1 font-mono">
                    {new Date(msg.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Box ── */}
          <div className="p-3 bg-slate-950 border-t border-slate-800/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask about fresh trout, delivery, etc…"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isSending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                style={{ fontFamily: '"Manrope", sans-serif' }}
              />
              <button
                type="submit"
                disabled={isSending || !inputText.trim()}
                className="w-10 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 disabled:opacity-40 text-slate-950 flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                <span className="material-symbols-outlined text-lg">send</span>
              </button>
            </form>
            <p className="text-[9px] text-center text-slate-600 mt-2 font-mono">
              ⚡ Connected directly to Urban Trout Farm Team on Telegram
            </p>
          </div>
        </div>
      )}
    </>
  );
}
