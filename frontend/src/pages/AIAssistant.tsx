import React, { useState, useRef, useEffect } from "react";
import Navbar from "../components/Navbar";
import { aiService } from "../services/ai";
import { Send, AlertCircle, Bot, User, Clock, Sparkles } from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: Date;
}

const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hello! I am your AttendWise Leave Assistant. Ask me anything about your attendance schedule, attendance margins, or simulate future leaves.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inputFocused, setInputFocused] = useState(false);
  const [inputHovered, setInputHovered] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    setError(null);
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: textToSend,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await aiService.chatWithAssistant(textToSend);
      const assistantMsg: Message = {
        id: Math.random().toString(),
        sender: "assistant",
        text: res.reply,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Assistant chat failed", err);
      setError(
        err.response?.data?.detail || "Failed to contact assistant. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChipClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const suggestions = [
    "Can I miss tomorrow's classes?",
    "How many lectures can I safely miss?",
    "When is the safest day to take leave?",
    "Show my attendance summary"
  ];

  // Dynamic input styling with a purple focus ring for AI features
  const inputStyle = (): React.CSSProperties => {
    return {
      border: `1px solid ${
        inputFocused
          ? "rgba(139,92,246,0.35)"
          : inputHovered
          ? "rgba(139,92,246,0.16)"
          : "rgba(15,23,42,0.08)"
      }`,
      backgroundColor: "#ffffff",
      boxShadow: inputFocused
        ? "0 0 0 3px rgba(139,92,246,0.06), 0 1px 2px rgba(15,23,42,0.02)"
        : "none",
      transition: "border-color 180ms ease, box-shadow 180ms ease",
      outline: "none",
    };
  };

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-[#0f172a] antialiased selection:bg-purple-100 selection:text-purple-950 flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow max-w-3xl mx-auto w-full px-6 py-10 flex flex-col h-[calc(100vh-4rem)]">
        
        {/* Chat Header */}
        <div className="border-b border-zinc-150/60 pb-4 mb-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200/50 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.02)]">
              <Bot className="h-5.5 w-5.5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-zinc-800 flex items-center gap-1.5">
                Leave Planner Assistant
                <span className="text-[8px] bg-purple-50 text-purple-650 border border-purple-100 font-extrabold uppercase px-1 py-0.2 rounded-md leading-none select-none tracking-wider shrink-0">
                  Experimental Beta
                </span>
              </h2>
              <p className="text-[10px] text-zinc-400 font-bold flex items-center mt-0.5 uppercase tracking-wider">
                <Clock className="h-3 w-3 mr-1 text-zinc-300" />
                AI-Powered Simulations
              </p>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="rounded-2xl border border-red-500/15 bg-red-50/50 p-4.5 mb-5 text-xs text-red-650 flex items-start space-x-3 animate-fade-in shadow-[0_1px_3px_rgba(15,23,42,0.01)]">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-semibold">{error}</span>
          </div>
        )}

        {/* Messages List Area */}
        <div className="flex-grow overflow-y-auto space-y-6 pr-1 flex flex-col min-h-0">
          {messages.length === 0 ? (
            <div className="flex-grow flex flex-col justify-center items-center py-12 text-center max-w-sm mx-auto space-y-6 animate-scale-in">
              <div className="h-12 w-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-sm">
                <Sparkles className="h-5.5 w-5.5 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-zinc-800 flex items-center justify-center gap-2">
                  <span>Ask anything about your attendance</span>
                  <span className="text-[8.5px] bg-purple-50 text-purple-600 border border-purple-100 font-extrabold uppercase px-1.5 py-0.5 rounded-md leading-none">
                    Experimental Beta
                  </span>
                </h3>
                <p className="text-[12px] text-zinc-450 leading-relaxed font-semibold">
                  Query your attendance standing, check margins, or simulate planned leaves in natural language.
                </p>
              </div>

              {/* Suggestion Chips */}
              <div className="pt-2 flex flex-wrap gap-2.5 justify-center">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChipClick(s)}
                    className="text-[10.5px] font-bold border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-zinc-800 py-2 px-3.5 rounded-full transition-all cursor-pointer shadow-sm uppercase tracking-wider"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-3.5 max-w-[85%] ${
                    msg.sender === "user" ? "ml-auto flex-row-reverse space-x-reverse" : "mr-auto"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border text-xs shrink-0 shadow-sm ${
                    msg.sender === "user" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200/60"
                  }`}>
                    {msg.sender === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-purple-500" />}
                  </div>
                  <div className={`rounded-2xl px-4.5 py-3 text-xs leading-relaxed ${
                    msg.sender === "user" 
                      ? "bg-zinc-900 text-white shadow-sm" 
                      : "bg-white border border-zinc-200/50 text-zinc-850 shadow-[0_4px_12px_rgba(15,23,42,0.02)]"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-start space-x-3.5 mr-auto max-w-[85%] mt-2 animate-scale-in w-full">
              <div className="h-8 w-8 rounded-full flex items-center justify-center border border-zinc-200/60 bg-white text-xs shrink-0 shadow-sm">
                <Bot className="h-4 w-4 text-purple-500 animate-pulse" />
              </div>
              <div className="rounded-2xl px-5 py-4.5 bg-white border border-zinc-200/50 text-zinc-800 space-y-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.02)] flex-grow max-w-sm animate-pulse">
                <div className="h-3 w-3/4 bg-zinc-200 rounded" />
                <div className="h-3 w-1/2 bg-zinc-150 rounded" />
                <div className="h-3 w-5/6 bg-zinc-100 rounded" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="mt-5 pt-4 border-t border-zinc-100 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-center space-x-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onMouseEnter={() => setInputHovered(true)}
              onMouseLeave={() => setInputHovered(false)}
              style={inputStyle()}
              disabled={loading}
              placeholder="Ask a question about attendance margins or leaves..."
              className="flex-grow rounded-xl py-3 px-4.5 text-[12px] text-zinc-800 placeholder:text-zinc-350 disabled:opacity-60 transition-all duration-150"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="text-[9.5px] text-zinc-400 text-center mt-3 font-semibold select-none">
            AttendWise AI assistant responses are experimental and for simulation purposes only. Always cross-verify percentages.
          </p>
        </div>

      </main>
    </div>
  );
};

export default AIAssistant;
