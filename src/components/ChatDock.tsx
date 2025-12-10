"use client";

import { useEffect, useState, useRef } from "react";
import { MessageCircle, X, Send, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; text: string; ts: string };

export function ChatDock() {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem("chat_oracle_history");
            if (saved) setMessages(JSON.parse(saved));
        } catch {
            // ignore
        }
    }, []);

    // Persist
    useEffect(() => {
        try {
            localStorage.setItem("chat_oracle_history", JSON.stringify(messages));
        } catch {
            // ignore
        }
    }, [messages]);

    // Auto scroll
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, open]);

    const send = async () => {
        const question = input.trim();
        if (!question || loading) return;
        setInput("");
        const userMsg: ChatMessage = { role: "user", text: question, ts: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);
        try {
            const res = await fetch("/api/oracle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question }),
            });
            const data = await res.json();
            if (data.success) {
                setMessages(prev => [...prev, { role: "assistant", text: data.answer || "Sin respuesta.", ts: new Date().toISOString() }]);
            } else {
                setMessages(prev => [...prev, { role: "assistant", text: data.error || "Error al responder.", ts: new Date().toISOString() }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: "assistant", text: "Error de red al consultar el Oráculo.", ts: new Date().toISOString() }]);
        } finally {
            setLoading(false);
        }
    };

    const clearHistory = () => {
        setMessages([]);
        try {
            localStorage.removeItem("chat_oracle_history");
        } catch {
            // ignore
        }
    };

    return (
        <>
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    "fixed z-40 bottom-6 right-6 rounded-full shadow-lg border border-white/10",
                    "bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 hover:scale-105 transition"
                )}
                title="Chat sobre el temario"
            >
                <MessageCircle className="w-6 h-6" />
            </button>

            {open && (
                <div className="fixed z-40 bottom-24 right-6 w-[360px] max-h-[70vh] bg-[#0b0b10] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-white/5">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-purple-300" />
                            <div>
                                <p className="text-xs font-bold text-white/80">Chat del Templo</p>
                                <p className="text-[10px] text-white/50">Pregúntale al Oráculo</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={clearHistory}
                                className="p-1 text-white/40 hover:text-white transition"
                                title="Borrar historial local"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1 text-white/60 hover:text-white transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-3 space-y-3 custom-scrollbar">
                        {messages.length === 0 && (
                            <div className="text-center text-white/40 text-xs py-6">
                                Pregunta sobre leyes, supuestos o procedimientos. El historial se guarda localmente.
                            </div>
                        )}
                        {messages.map((m, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "px-3 py-2 rounded-lg max-w-[95%]",
                                    m.role === "user" ? "bg-purple-600/20 text-white ml-auto" : "bg-white/5 text-white/80"
                                )}
                            >
                                <div className="text-[10px] text-white/40 mb-1">
                                    {m.role === "user" ? "Tú" : "Oráculo"} · {new Date(m.ts).toLocaleTimeString()}
                                </div>
                                <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                            </div>
                        ))}
                        {loading && (
                            <div className="px-3 py-2 rounded-lg bg-white/5 text-white/60 w-fit">
                                <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                                Pensando...
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="border-t border-white/10 p-3 bg-black/40">
                        <div className="flex items-center gap-2">
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && send()}
                                placeholder="Pregunta sobre el temario..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400"
                            />
                            <button
                                onClick={send}
                                disabled={loading}
                                className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold border border-purple-500/40 transition flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
