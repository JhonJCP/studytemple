"use client";

import { useState } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function ImportPlanningPage() {
    const [jsonInput, setJsonInput] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [result, setResult] = useState<any>(null);
    
    const handleImport = async () => {
        setStatus('loading');
        setMessage('');
        
        try {
            // Parse JSON
            const planning = JSON.parse(jsonInput);
            
            // Llamar API
            const res = await fetch('/api/planning/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planning })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Error importing planning');
            }
            
            setStatus('success');
            setMessage(`✓ Planning importado exitosamente: ${data.topicCount} temas, ${data.scheduleCount} sesiones`);
            setResult(data);
            
        } catch (err) {
            setStatus('error');
            setMessage(err instanceof Error ? err.message : 'Error desconocido');
        }
    };
    
    const handleLoadCurrent = async () => {
        setStatus('loading');
        setMessage('Cargando planning actual...');
        
        try {
            const res = await fetch('/api/planning/import');
            const data = await res.json();
            
            if (data.hasPlanning) {
                setJsonInput(JSON.stringify({
                    strategic_analysis: data.planning.strategic_analysis,
                    topic_time_estimates: data.planning.topic_time_estimates,
                    daily_schedule: data.planning.daily_schedule
                }, null, 2));
                setStatus('idle');
                setMessage(`Planning cargado: ${data.topicCount} temas, ${data.scheduleCount} sesiones`);
            } else {
                setStatus('error');
                setMessage('No hay planning guardado. Pega el JSON de Planing.txt abajo.');
            }
        } catch (err) {
            setStatus('error');
            setMessage(err instanceof Error ? err.message : 'Error cargando planning');
        }
    };
    
    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-black text-white mb-4">
                    Importar Planning
                </h1>
                <p className="text-white/60 mb-8">
                    Pega el contenido completo de <code className="text-purple-400">Temario/Planing.txt</code> aquí para guardarlo en la base de datos.
                </p>
                
                {/* Status */}
                {message && (
                    <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${
                        status === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-300' :
                        status === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-300' :
                        'bg-blue-500/10 border-blue-500/30 text-blue-300'
                    }`}>
                        {status === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> :
                         status === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> :
                         <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />}
                        <div>
                            <p className="text-sm font-semibold">{message}</p>
                            {result && (
                                <p className="text-xs mt-1 opacity-60">
                                    Planning ID: {result.planningId}
                                </p>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Botón cargar actual */}
                <button
                    onClick={handleLoadCurrent}
                    disabled={status === 'loading'}
                    className="mb-4 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                >
                    Cargar Planning Actual (si existe)
                </button>
                
                {/* Textarea para JSON */}
                <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='Pega aquí el contenido de Planing.txt (todo el JSON completo)'
                    className="w-full h-96 bg-black/40 border border-white/10 rounded-xl p-4 text-white/90 font-mono text-xs resize-none focus:border-purple-500/50 focus:outline-none"
                />
                
                {/* Botón importar */}
                <button
                    onClick={handleImport}
                    disabled={!jsonInput || status === 'loading'}
                    className="mt-4 w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {status === 'loading' ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Importando...
                        </>
                    ) : (
                        <>
                            <Upload className="w-5 h-5" />
                            Importar Planning a DB
                        </>
                    )}
                </button>
                
                {/* Instrucciones */}
                <div className="mt-8 p-6 bg-white/5 rounded-xl border border-white/10">
                    <h2 className="text-sm font-bold text-white mb-3">
                        📋 Instrucciones
                    </h2>
                    <ol className="text-sm text-white/60 space-y-2 list-decimal list-inside">
                        <li>Abre el archivo <code className="text-purple-400">Temario/Planing.txt</code></li>
                        <li>Copia TODO el contenido (desde <code>{"{"}</code> hasta <code>{"}"}</code>)</li>
                        <li>Pégalo en el textarea de arriba</li>
                        <li>Click en "Importar Planning a DB"</li>
                        <li>El planning se guardará y estará disponible para el Global Planner</li>
                    </ol>
                    <p className="text-xs text-white/40 mt-4">
                        💡 <strong>Tip:</strong> Cuando Cortez genere un nuevo planning, puedes usar esta misma página para actualizarlo.
                    </p>
                </div>
            </div>
        </div>
    );
}

