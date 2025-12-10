"use client";

import { useEffect, useState } from "react";
import { Brain, Play, Save, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Editor from "@monaco-editor/react";
import { triggerAnalysis, getAnalysisStatus, saveSyllabusAction } from "@/app/library/actions";
import { toast } from "sonner";

const DEFAULT_PROMPT = `You are an expert Librarian and Civil Engineer building a syllabus for 'Ingenieros Técnicos de Obras Públicas'.

Your task: Organize the provided list of filenames into a clean, logical, hierarchical structure aligned with the Official Exam Blocks.

CONTEXT & RULES:
1. "BOE Convocatoria" and generic legal bases are CONTEXT, not study topics. Put them in a "Bases de la Oposición" group.
2. "Guía Informe Administrativo" and similar are METHODOLOGY for the Practical Exam. Put them in "Herramientas Prácticas".
3. Group the rest by Engineering Domain:
    - Aguas y Obras Hidráulicas
    - Costas y Puertos
    - Carreteras y Transportes
    - Medio Ambiente
4. Rename 'title' to be human-readable. Keep 'originalFilename' EXACTLY as is.

RETURN JSON STRUCTURE:
{
    "groups": [
        {
            "title": "Block Title",
            "icon": "LucideIconName",
            "description": "Short description",
            "topics": [
                { "title": "Clean Title", "originalFilename": "file.pdf" }
            ]
        }
    ]
}`;

export function SyllabusBrain() {
    const [isOpen, setIsOpen] = useState(false);
    const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [elapsed, setElapsed] = useState(0);

    // Poll status on mount and when analyzing
    useEffect(() => {
        let interval: NodeJS.Timeout;
        let timer: NodeJS.Timeout;

        const checkStatus = async () => {
            const status = await getAnalysisStatus();
            if (status.state === "processing") {
                setAnalyzing(true);
                // Sync elapsed time if possible, or just increment
                if (status.startedAt) {
                    setElapsed(Math.floor((Date.now() - status.startedAt) / 1000));
                }
            } else if (status.state === "completed") {
                setAnalyzing(false);
                setResult(status.result);
                // toast.success("Analysis ready!"); // Optional noise
            } else if (status.state === "error") {
                setAnalyzing(false);
                toast.error("Error en análisis previo: " + status.error);
            }
        };

        if (isOpen) {
            checkStatus(); // Initial check when opened
        }

        if (analyzing && isOpen) {
            interval = setInterval(checkStatus, 3000); // Check every 3s
            timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
        }

        return () => {
            clearInterval(interval);
            clearInterval(timer);
        };
    }, [analyzing, isOpen]);

    const handleAnalyze = async () => {
        setAnalyzing(true);
        setElapsed(0);
        setResult(null);

        // Trigger is fire-and-forget-ish (Server Action waits, client re-renders and polls)
        triggerAnalysis(prompt).catch(err => {
            console.error("Trigger failed", err);
            setAnalyzing(false);
            toast.error("No se pudo iniciar el análisis.");
        });
    };

    const handleSave = async () => {
        if (!result) return;
        const res = await saveSyllabusAction(result);
        if (res.success) {
            toast.success("Estructura guardada. La Biblioteca se ha actualizado.");
            setIsOpen(false);
            window.location.reload(); // Refresh to show new data
        } else {
            toast.error("Error guardando: " + res.error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20">
                    <Brain className="w-4 h-4" />
                    Análisis Estructural (IA)
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl h-[90vh] flex flex-col bg-zinc-950 border-white/10">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        <Brain className="w-6 h-6 text-purple-500" />
                        Cerebro del Bibliotecario
                    </DialogTitle>
                    <DialogDescription>
                        Supervisa y modifica las instrucciones de la IA (Gemini 3 Pro) para organizar tu temario.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex gap-4 min-h-0 pt-4">
                    {/* Left: Prompt Editor */}
                    <div className="w-1/2 flex flex-col gap-2">
                        <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest">Instrucciones (Prompt)</h3>
                        <div className="flex-1 border border-white/10 rounded-xl overflow-hidden">
                            <Editor
                                height="100%"
                                defaultLanguage="markdown"
                                theme="vs-dark"
                                value={prompt}
                                onChange={(val) => setPrompt(val || "")}
                                options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
                            />
                        </div>
                        <Button onClick={handleAnalyze} disabled={analyzing} className="w-full bg-purple-600 hover:bg-purple-700">
                            {analyzing ? <RotateCcw className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                            {analyzing ? `Analizando Documentos (${elapsed}s)...` : "Ejecutar Análisis"}
                        </Button>
                    </div>

                    {/* Right: Preview */}
                    <div className="w-1/2 flex flex-col gap-2">
                        <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest">Resultado (Previsualización)</h3>
                        <div className="flex-1 bg-black/50 border border-white/10 rounded-xl overflow-y-auto p-4 custom-scrollbar font-mono text-xs">
                            {analyzing ? (
                                <div className="h-full flex flex-col items-center justify-center text-purple-400 gap-4">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
                                        <Brain className="w-16 h-16 relative z-10 animate-bounce" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold">Razonando Estructura...</p>
                                        <p className="text-white/50 text-sm">Gemini 3 Pro está leyendo {elapsed}s</p>
                                        <p className="text-white/30 text-xs mt-2 max-w-xs">Puedes cerrar esta ventana, el proceso continuará en segundo plano.</p>
                                    </div>
                                </div>
                            ) : result ? (
                                <JSONTree data={result} />
                            ) : (
                                <div className="h-full flex items-center justify-center text-white/20 italic">
                                    Ejecuta el análisis para ver la estructura propuesta...
                                </div>
                            )}
                        </div>
                        <Button onClick={handleSave} disabled={!result} variant="secondary" className="w-full">
                            <Save className="w-4 h-4 mr-2" />
                            Aplicar esta Estructura
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Simple recursive JSON tree viewer
function JSONTree({ data, level = 0 }: { data: any, level?: number }) {
    if (typeof data !== 'object' || data === null) {
        return <span className="text-green-400">"{String(data)}"</span>;
    }

    if (Array.isArray(data)) {
        return (
            <div className="pl-4 border-l border-white/10 my-1">
                <span className="text-white/40 opacity-50 block text-[10px] mb-1">Array[{data.length}]</span>
                {data.map((item, i) => (
                    <div key={i} className="mb-2">
                        <JSONTree data={item} level={level + 1} />
                    </div>
                ))}
            </div>
        );
    }

    // Object (Group or Topic)
    const isTopic = data.originalFilename !== undefined;

    return (
        <div className="pl-2">
            {isTopic ? (
                <div className="flex items-center gap-2 text-white/80 py-1 hover:bg-white/5 rounded px-2">
                    <span className="text-blue-400">📄</span>
                    <span className="font-bold">{data.title}</span>
                    <span className="text-white/30 text-[10px]">({data.originalFilename})</span>
                </div>
            ) : (
                <div className="mb-4">
                    <div className="text-amber-400 font-bold text-sm mb-1 uppercase tracking-wider border-b border-white/5 pb-1 block w-full">
                        {data.title || "Object"}
                    </div>
                    {data.description && <div className="text-white/40 italic mb-2 pl-2">"{data.description}"</div>}
                    <div className="pl-4">
                        {Object.entries(data).map(([k, v]) => {
                            if (k === 'title' || k === 'description' || k === 'icon') return null;
                            return <JSONTree key={k} data={v} level={level + 1} />;
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
