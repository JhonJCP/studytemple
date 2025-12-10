"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Terminal, AlertTriangle } from "lucide-react";

function SimulatorContent() {
    const searchParams = useSearchParams();
    const topic = searchParams.get('topic');

    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/10 rounded-3xl bg-white/5">
            <div className="p-6 bg-purple-500/20 rounded-full mb-6 animate-pulse">
                <Terminal className="w-16 h-16 text-purple-400" />
            </div>

            <h1 className="text-4xl font-black text-white mb-4">SIMULADOR DE TESTS</h1>
            <p className="text-xl text-white/50 max-w-lg mb-8">
                {topic
                    ? `Configurando simulación para: "${topic}"`
                    : "Selecciona un tema desde el calendario para iniciar."}
            </p>

            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center gap-3 text-amber-200">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-bold">Módulo en Construcción (Fase 3)</span>
            </div>
        </div>
    );
}

export default function SimulatorPage() {
    return (
        <div className="min-h-screen p-8 bg-background flex flex-col">
            <Link href="/calendar" className="flex items-center text-white/50 hover:text-white mb-8 transition-colors w-fit">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver al Calendario
            </Link>

            <Suspense fallback={<div className="text-white/50 p-12 text-center">Cargando simulador...</div>}>
                <SimulatorContent />
            </Suspense>
        </div>
    );
}
