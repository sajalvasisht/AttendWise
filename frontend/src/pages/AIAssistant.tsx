import React, { useState, useRef, useEffect } from "react";
import Navbar from "../components/Navbar";
import { aiService } from "../services/ai";
import { Send, AlertCircle, Bot, User, Clock } from "lucide-react";

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
      text: "Hello! I am your AttendWise Leave Assistant. Ask me anything about your attendance schedule, safe bunk budgets, or simulate future leaves.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    "Can I skip tomorrow's classes?",
    "How many lectures can I still miss?",
    "When is the safest day to take leave?",
    "Show my attendance summary"
  ];

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 flex flex-col h-[calc(100vh-3.5rem)]">
        
        {/* Chat Header */}
        <div className="border-b border-border pb-4 mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
              <Bot className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Leave Planner Assistant</h2>
              <p className="text-[10px] text-muted-foreground flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                Deterministic planning & absence simulations
              </p>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-4 mb-4 text-xs text-destructive flex items-start space-x-3 animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 max-w-[85%] ${
                msg.sender === "user" ? "ml-auto flex-row-reverse space-x-reverse" : "mr-auto"
              }`}
            >
              <div className={`h-7 w-7 rounded-full flex items-center justify-center border text-xs shrink-0 ${
                msg.sender === "user" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
              }`}>
                {msg.sender === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>
              <div className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.01)] ${
                msg.sender === "user" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-card border border-border text-foreground"
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start space-x-3 mr-auto max-w-[85%]">
              <div className="h-7 w-7 rounded-full flex items-center justify-center border border-border bg-card text-xs shrink-0">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="rounded-2xl px-4 py-3 bg-card border border-border text-foreground flex items-center space-x-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce delay-100" />
                <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce delay-200" />
                <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce delay-300" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {messages.length === 1 && (
          <div className="py-4 flex flex-wrap gap-2 justify-center">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleChipClick(s)}
                className="text-[10px] font-medium border border-border/80 hover:border-foreground/20 bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground py-1.5 px-3 rounded-full transition-all cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="mt-4 pt-3 border-t border-border/60">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder="Ask a question about bunk budgets or leaves..."
              className="flex-1 rounded-xl border border-border bg-card py-2.5 px-4 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/25 focus:ring-1 focus:ring-foreground/5 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

      </main>
    </div>
  );
};

export default AIAssistant;
