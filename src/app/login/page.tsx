"use client";

import { createClient } from "@/utils/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push("/dashboard");
            router.refresh();
        }
    };

    const handleSignUp = async () => {
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signUp({
            email,
            password
        });
        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            setError("¡Cuenta creada! Revisa tu email para confirmar.");
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px]" />

            <div className="w-full max-w-md p-8 glass-card border border-white/10 relative z-10">
                <div className="text-center mb-8">
                    <div className="bg-primary/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/30 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                        <ShieldCheck className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">STUDY TEMPLE</h1>
                    <p className="text-white/50 text-sm mt-2">Acceso restringido a Ingenieros</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="text-xs uppercase font-bold text-white/40 mb-1 block">Identificación (Email)</label>
                        <input
                            type="email"
                            required
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-primary focus:outline-none transition-colors"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs uppercase font-bold text-white/40 mb-1 block">Clave de Acceso</label>
                        <input
                            type="password"
                            required
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-primary focus:outline-none transition-colors"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-black font-black py-4 rounded-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <><KeyRound className="w-4 h-4" /> ENTRAR AL TEMPLO</>}
                    </button>

                    <div className="text-center">
                        <button type="button" onClick={handleSignUp} className="text-xs text-white/30 hover:text-white transition-colors">
                            ¿No tienes credenciales? Solicitar acceso (Sign Up)
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
