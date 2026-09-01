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
  status?: "sending" | "sent";
}

const QUICK_PROMPTS = [
  "🐟 Is fresh trout available for delivery today?",
  "🚚 How fast is doorstep delivery in Srinagar?",
  "🌿 Can I visit the farm in Naseem Bagh?",
  "🔪 What is the difference between whole & gutted trout?",
];

// Synthesizes a clean, pleasant notification chime using Web Audio API
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
  const [showMenu, setShowMenu] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Do not render on admin dashboard
  if (pathname?.startsWith("/admin")) return null;

  // Initialize or restore session from localStorage
  const initSession = (forceNew = false) => {
    let savedThread = forceNew ? null : localStorage.getItem("ut_live_chat_thread_id");
    if (!savedThread) {
      savedThread = `ut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem("ut_live_chat_thread_id", savedThread);
    }
    setThreadId(savedThread);
    setIsClosed(false);
    setMessages([]);

    const savedName = localStorage.getItem("ut_live_chat_name") || "";
    const savedPhone = localStorage.getItem("ut_live_chat_phone") || "";
    setCustomerName(savedName);
    setCustomerPhone(savedPhone);

    if (!savedName && !savedPhone) {
      setShowInfoForm(true);
    }
  };

  useEffect(() => {
    initSession();
  }, []);

  // Fetch message history
  const fetchHistory = async (id: string) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/live-chat/history?threadId=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.messages)) {
          setMessages((prev) => {
            // Merge server messages with any sending messages
            const map = new Map<string, ChatMessage>();
            prev.forEach((m) => map.set(m.id, m));
            data.messages.forEach((m: ChatMessage) => {
              // If we had an optimistic message with same text & sender, replace it with server message
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

          // Check if thread was closed
          if (data.messages.some((m: ChatMessage) => m.text.includes("conversation has been ended") || m.text.includes("conversation has ended"))) {
            setIsClosed(true);
          }
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
            // Remove optimistic version if present
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

    // Fast 1.5s polling fallback for rock-solid zero-latency feel
    const pollInterval = setInterval(() => {
      fetchHistory(threadId);
    }, 1500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [threadId, isOpen]);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending || !threadId) return;

    // Zero-latency instant UI update
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
    if (!textToSend) setInputText("");
    setIsSending(true);

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
        // Mark optimistic message as sent
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, status: "sent" } : m))
        );
        if (customerName) localStorage.setItem("ut_live_chat_name", customerName);
        if (customerPhone) localStorage.setItem("ut_live_chat_phone", customerPhone);
      }
    } catch (err) {
      console.warn("Live chat send notice:", err);
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
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[92vw] sm:w-[390px] h-[550px] max-h-[82vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl transition-all border animate-fade-in"
          style={{
            background: "rgba(6, 23, 34, 0.95)",
            borderColor: "rgba(114, 221, 253, 0.25)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(114,221,253,0.15)",
          }}
        >
          {/* ── Chat Header ── */}
          <div className="relative flex items-center justify-between px-4 py-3.5 bg-slate-950/90 border-b border-slate-800/80">
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
                  Urban Trout Live Support
                </h3>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Farm Team Live · Replies in &lt; 2 mins
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Header Options Menu */}
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                aria-label="Chat Options"
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
              >
                <span className="material-symbols-outlined text-base">more_vert</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute top-14 right-4 z-20 w-48 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl py-1.5 text-xs text-slate-300 animate-fade-in">
                <button
                  type="button"
                  onClick={handleEndChat}
                  className="w-full px-3.5 py-2 text-left hover:bg-red-500/15 text-red-400 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">power_settings_new</span>
                  <span>End Conversation</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  className="w-full px-3.5 py-2 text-left hover:bg-cyan-500/15 text-cyan-300 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                  <span>Start New Chat</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Optional Visitor Info Bar ── */}
          {showInfoForm && !isClosed && (
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
            {messages.length === 0 && !isClosed && (
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
                  <div className="flex items-center gap-1 px-1">
                    <span className="text-[9px] text-slate-600 font-mono">
                      {new Date(msg.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {isMe && (
                      <span className="text-[10px] text-cyan-400">
                        {msg.status === "sending" ? "✓" : "✓✓"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Closed Conversation State Banner */}
            {isClosed && (
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-2.5 animate-fade-in my-2">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <span className="material-symbols-outlined text-lg">check</span>
                </div>
                <p className="text-xs text-slate-300 font-semibold">Conversation Ended</p>
                <p className="text-[11px] text-slate-400">
                  Thank you for reaching out to Urban Trout. We are always ready to help!
                </p>
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  Start New Conversation
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Box ── */}
          {!isClosed ? (
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
              <div className="flex items-center justify-between text-[9px] text-slate-600 mt-2 font-mono px-1">
                <span>⚡ Live connected to Telegram</span>
                <button
                  type="button"
                  onClick={handleEndChat}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  End Chat
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-950 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={handleStartNewChat}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline"
              >
                Click here to start a new chat
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
