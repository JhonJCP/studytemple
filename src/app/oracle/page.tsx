import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";

export default function OraclePage() {
    return (
        <div className="min-h-screen p-8 bg-background">
            <Link href="/dashboard" className="flex items-center text-white/50 hover:text-white mb-8 transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver al Templo
            </Link>

            <div className="flex items-center gap-4 mb-12">
                <div className="p-4 bg-purple-500/20 rounded-full">
                    <MessageSquare className="w-8 h-8 text-purple-500" />
                </div>
                <div>
                    <h1 className="text-5xl font-black text-white">EL ORÁCULO</h1>
                    <p className="text-white/60">Consulta la sabiduría del Templo</p>
                </div>
            </div>

            <div className="glass-card p-12 text-center border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-4">Próximamente</h2>
                <p className="text-white/60 max-w-md mx-auto">
                    Aquí podrás chatear con Gemini 3 Pro sobre cualquier aspecto del temario.
                    "¿Qué dice la Ley de Costas sobre los chiringuitos?"
                </p>
            </div>
        </div>
    );
}
