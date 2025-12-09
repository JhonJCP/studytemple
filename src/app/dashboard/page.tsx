import { StudyMap } from "@/components/StudyMap";

export default function DashboardPage() {
    return (
        <div className="min-h-screen p-8 bg-background">
            <header className="mb-12 flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black text-white mb-2">EL TEMPLO</h1>
                    <p className="text-white/60">Elige tu zona de estudio</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm font-bold text-primary">Nivel 1</p>
                        <p className="text-xs text-white/40">Ingeniero Novato</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-secondary border border-white/10" />
                </div>
            </header>

            <section>
                <StudyMap />
            </section>
        </div>
    );
}
