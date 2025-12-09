import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 relative overflow-hidden">
      <div className="z-10 text-center space-y-8 animate-float">
        <h1 className="text-7xl font-black tracking-tighter text-glow bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
          STUDY TEMPLE
        </h1>
        <p className="text-xl text-white/60 tracking-[0.2em] uppercase">
          Ingeniería de Obras Publicas
        </p>

        <Link href="/dashboard">
          <button className="px-8 py-4 bg-primary text-black font-bold rounded-full text-lg hover:bg-primary/90 transition-all hover:scale-105 shadow-[0_0_40px_rgba(var(--primary),0.5)]">
            ENTRAR
          </button>
        </Link>
      </div>

      {/* Background decorations */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -z-0" />
    </main>
  );
}
