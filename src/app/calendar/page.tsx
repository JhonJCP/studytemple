import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";

export default function CalendarPage() {
    return (
        <div className="min-h-screen p-8 bg-background">
            <Link href="/dashboard" className="flex items-center text-white/50 hover:text-white mb-8 transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver al Templo
            </Link>

            <div className="flex items-center gap-4 mb-12">
                <div className="p-4 bg-green-500/20 rounded-full">
                    <Calendar className="w-8 h-8 text-green-500" />
                </div>
                <div>
                    <h1 className="text-5xl font-black text-white">EL CALENDARIO</h1>
                    <p className="text-white/60">Sistema de Repaso Espaciado (SRS)</p>
                </div>
            </div>

            <div className="glass-card p-12 text-center border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-4">Próximamente</h2>
                <p className="text-white/60 max-w-md mx-auto">
                    Aquí gestionaremos tus repasos diarios basándonos en tu curva de olvido.
                    El algoritmo te dirá qué temas de la "Zona A" o "Zona B" necesitas reforzar hoy.
                </p>
            </div>
        </div>
    );
}
