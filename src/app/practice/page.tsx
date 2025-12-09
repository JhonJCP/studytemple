import Link from "next/link";
import { ArrowLeft, Database, Terminal, PenTool } from "lucide-react";

export default function PracticePage() {
    return (
        <div className="min-h-screen p-8 bg-background">
            <Link href="/dashboard" className="flex items-center text-white/50 hover:text-white mb-8 transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver al Templo
            </Link>

            <h1 className="text-5xl font-black text-white mb-4">EL TALLER</h1>
            <p className="text-xl text-white/60 mb-12 max-w-2xl">
                Aquí se forja la técnica. Domina el Segundo Ejercicio: Informes y Propuestas.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* The Museum */}
                <Link href="/practice/museum">
                    <div className="group glass-card p-10 h-80 flex flex-col justify-between border-t-4 border-t-amber-500/50 hover:border-t-amber-500 transition-all">
                        <div>
                            <Database className="w-12 h-12 text-amber-500 mb-6" />
                            <h2 className="text-3xl font-bold text-white mb-2">El Museo</h2>
                            <p className="text-white/60">
                                Analiza los 15 Supuestos Sagrados. <br />
                                Desglose paso a paso de soluciones oficiales.
                            </p>
                        </div>
                        <div className="flex items-center text-amber-500 font-bold group-hover:translate-x-2 transition-transform">
                            Entrar al Museo &rarr;
                        </div>
                    </div>
                </Link>

                {/* The Simulator */}
                <Link href="/practice/simulator">
                    <div className="group glass-card p-10 h-80 flex flex-col justify-between border-t-4 border-t-purple-500/50 hover:border-t-purple-500 transition-all">
                        <div>
                            <Terminal className="w-12 h-12 text-purple-500 mb-6" />
                            <h2 className="text-3xl font-bold text-white mb-2">El Simulador</h2>
                            <p className="text-white/60">
                                Enfréntate a nuevos retos generados por la IA. <br />
                                Redacta informes y recibe correcciones en tiempo real.
                            </p>
                        </div>
                        <div className="flex items-center text-purple-500 font-bold group-hover:translate-x-2 transition-transform">
                            Iniciar Simulación &rarr;
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
