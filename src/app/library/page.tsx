"use client";

import { createClient } from "@/utils/supabase/client";
import { Search, Book, FileText, Filter, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface DocMetadata {
    filename: string;
    category: string;
    // We can add more inferred metadata later
}

interface DocGroup {
    filename: string;
    category: string;
    pageCount: number; // Inferred from chunks
}

export default function LibraryPage() {
    const supabase = createClient();
    const [documents, setDocuments] = useState<DocGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        // Fetch all distinct filenames from library_documents
        // Note: Supabase JS select doesn't support generic 'distinct on metadata' easily without RPC.
        // For now, we fetch a lightweight list and aggregate client-side (MVP).
        // A better approach is an RPC function `get_library_books`.

        const { data, error } = await supabase
            .from("library_documents")
            .select("metadata");

        if (error) {
            console.error("Error fetching library:", error);
            setLoading(false);
            return;
        }

        // Aggregate by filename
        const grouped = new Map<string, DocGroup>();

        data.forEach((row: any) => {
            const meta = row.metadata as DocMetadata;
            if (!grouped.has(meta.filename)) {
                grouped.set(meta.filename, {
                    filename: meta.filename,
                    category: meta.category,
                    pageCount: 0
                });
            }
            const doc = grouped.get(meta.filename)!;
            doc.pageCount += 1; // Roughly 1 chunk ~ 0.5 - 1 page
        });

        setDocuments(Array.from(grouped.values()));
        setLoading(false);
    };

    const getGradients = (category: string) => {
        if (category?.includes("AGUAS")) return "from-blue-600/20 to-cyan-400/10 border-blue-500/30";
        if (category?.includes("COSTAS")) return "from-teal-600/20 to-emerald-400/10 border-teal-500/30";
        if (category?.includes("CARRETERAS")) return "from-slate-600/20 to-gray-400/10 border-slate-500/30";
        if (category?.includes("CORE")) return "from-purple-600/20 to-indigo-400/10 border-purple-500/30";
        return "from-zinc-800/50 to-zinc-900/50 border-white/10"; // Default
    };

    const filteredDocs = documents.filter(doc => {
        const matchesSearch = doc.filename.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory ? doc.category === selectedCategory : true;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen bg-[var(--background)] p-8 pb-32">
            {/* Background Ambiance */}
            <div className="fixed top-0 left-0 w-full h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2" />

            <header className="mb-12 relative z-10">
                <h1 className="text-5xl font-black text-white tracking-tight mb-4 flex items-center gap-4">
                    <BookOpen className="w-12 h-12 text-primary" />
                    La Gran Biblioteca
                </h1>
                <p className="text-xl text-white/50 max-w-2xl">
                    El repositorio oficial del Templo. Explora leyes, normas y manuales ingestados en el Cerebro.
                    <span className="text-primary block mt-2 text-sm font-bold uppercase tracking-widest">Fuente de la Verdad</span>
                </p>
            </header>

            {/* Oracle's Eye Search */}
            <div className="relative z-20 mb-12 max-w-4xl mx-auto">
                <div className="relative group">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative glass p-2 rounded-full flex items-center gap-4 px-6">
                        <Search className="w-6 h-6 text-white/50" />
                        <input
                            type="text"
                            placeholder="Consulta al Oráculo (ej: 'Plazos de expropiación en Ley de Costas'...)"
                            className="bg-transparent border-none outline-none text-white text-lg w-full placeholder:text-white/20 h-12"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <div className="flex gap-2 text-xs font-mono text-white/30 border-l border-white/10 pl-4">
                            <span>SEMANTIC</span>
                            <span className="text-primary">ACTIVE</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-8 overflow-x-auto pb-4 custom-scrollbar">
                <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${!selectedCategory ? 'bg-primary text-black border-primary' : 'bg-black/30 text-white/50 border-white/10 hover:border-white/30'}`}
                >
                    Todo
                </button>
                {Array.from(new Set(documents.map(d => d.category))).map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-full text-sm font-bold border transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-white text-black border-white' : 'bg-black/30 text-white/50 border-white/10 hover:border-white/30'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Library Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-48 bg-white/5 animate-pulse rounded-xl" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredDocs.map((doc, idx) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            key={doc.filename}
                            className={`group relative glass-card p-6 flex flex-col justify-between h-64 bg-gradient-to-br ${getGradients(doc.category)} hover:scale-[1.02] cursor-pointer`}
                        >
                            <div>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-black/20 rounded-lg backdrop-blur-sm">
                                        <Book className="w-6 h-6 text-white/80" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-white/40 border border-white/10 px-2 py-1 rounded">
                                        {doc.category || "UNKNOWN"}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-white leading-tight line-clamp-3 group-hover:text-primary transition-colors">
                                    {doc.filename.replace(".pdf", "")}
                                </h3>
                            </div>

                            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
                                <span className="flex items-center gap-1">
                                    <FileText className="w-3 h-3" />
                                    {doc.pageCount} Fragments
                                </span>
                                <span className="group-hover:translate-x-1 transition-transform text-white/60">
                                    Leer Documento &rarr;
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    )
}
