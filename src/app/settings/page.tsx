"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Clipboard, MessageCircle } from "lucide-react";

type SavedPlan = { ts: string; analysis?: string; raw?: string };
type ChatMessage = { role: "user" | "assistant"; text: string; ts: string };

export default function SettingsPage() {
    const [history, setHistory] = useState<SavedPlan[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

    useEffect(() => {
        try {
            const h = JSON.parse(localStorage.getItem("planner_history") || "[]");
            setHistory(h);
        } catch {
            setHistory([]);
        }
        try {
            const chats = JSON.parse(localStorage.getItem("chat_oracle_history") || "[]");
            setChatHistory(chats);
        } catch {
            setChatHistory([]);
        }
    }, []);

    return (
        <div className="min-h-screen p-8 bg-background">
            <Link href="/dashboard" className="flex items-center text-white/50 hover:text-white mb-8 transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver al Templo
            </Link>

            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <MessageSquare className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white">Configuración · Historial IA</h1>
                    <p className="text-white/50 text-sm">Consulta y copia los últimos planes o chats guardados localmente.</p>
                </div>
            </div>

            <div className="glass-card p-6 border border-white/10 mb-6">
                <h2 className="text-xl font-bold text-white mb-4">Historial de Planes / Chats</h2>
                {history.length === 0 && (
                    <p className="text-white/50 text-sm">No hay historial local disponible.</p>
                )}
                <div className="space-y-3">
                    {history.map((h, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <div className="flex justify-between text-xs text-white/50 mb-2">
                                <span>{new Date(h.ts).toLocaleString()}</span>
                                <button
                                    onClick={() => {
                                        const text = h.raw || "";
                                        navigator.clipboard.writeText(text);
                                    }}
                                    className="flex items-center gap-1 text-blue-300 hover:text-blue-100"
                                >
                                    <Clipboard className="w-3 h-3" /> Copiar JSON
                                </button>
                            </div>
                            {h.analysis && (
                                <pre className="text-xs text-white/70 whitespace-pre-wrap max-h-48 overflow-auto custom-scrollbar">
                                    {h.analysis}
                                </pre>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="glass-card p-6 border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                    <MessageCircle className="w-5 h-5 text-purple-300" />
                    <h2 className="text-xl font-bold text-white">Historial de Chat (local)</h2>
                </div>
                {chatHistory.length === 0 && (
                    <p className="text-white/50 text-sm">No hay mensajes guardados aún.</p>
                )}
                <div className="space-y-2 max-h-[400px] overflow-auto custom-scrollbar">
                    {chatHistory.map((m, idx) => (
                        <div key={idx} className="p-2 rounded bg-white/5 border border-white/10">
                            <div className="text-[10px] text-white/40 mb-1">
                                {m.role === "user" ? "Tú" : "Oráculo"} · {new Date(m.ts).toLocaleString()}
                            </div>
                            <div className="text-sm text-white/80 whitespace-pre-wrap">{m.text}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
