"use client";

import { useState, useEffect } from "react";
import { Search, Book } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { LibraryStacks } from "@/components/LibraryStacks";
import { SyllabusBrain } from "@/components/SyllabusBrain";
import { DEFAULT_SYLLABUS } from "@/lib/default-syllabus";

export default function LibraryPage() {
    const supabase = createClient();
    const [searchQuery, setSearchQuery] = useState("");

    // Initialize with the perfect AI structure by default (Instant Load)
    const [libraryData, setLibraryData] = useState<any>(DEFAULT_SYLLABUS);
    // const [loading, setLoading] = useState(true); // Don't block UI

    // Fetch dynamic syllabus from Supabase (to override default if newer version exists)
    useEffect(() => {
        async function fetchSyllabus() {
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'smart-syllabus')
                    .single();

                if (data && data.value) {
                    console.log("✅ Loaded dynamic syllabus from DB");
                    setLibraryData(data.value);
                } else {
                    console.warn("⚠️ No syllabus in DB, using default AI structure.");
                }
            } catch (e) {
                console.error("Failed to load syllabus", e);
            }
        }
        fetchSyllabus();
    }, []);

    // Use fetched data or default structure
    const data = libraryData || DEFAULT_SYLLABUS;
    const totalDocs = data.groups?.reduce((acc: any, g: any) => acc + g.topics.length, 0) || 0;

    return (
        <div className="min-h-screen bg-background p-8 pb-32">
            {/* Header Area */}
            <div className="mb-12">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                            <Book className="w-8 h-8 text-amber-500" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tight">
                                La Gran Biblioteca
                            </h1>
                            <p className="text-white/60 text-lg">
                                Fuente de la Verdad. {totalDocs} documentos organizados por la IA.
                            </p>
                        </div>
                    </div>

                    {/* The Brain Trigger */}
                    <SyllabusBrain />
                </div>

                {/* AI Search Bar */}
                <div className="max-w-2xl relative group">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center bg-black/50 border border-white/10 rounded-full px-6 py-4 backdrop-blur-md focus-within:border-primary/50 transition-colors">
                        <Search className="w-5 h-5 text-white/50 mr-4" />
                        <input
                            type="text"
                            placeholder="Consulta al Oráculo (ej: 'Plazos de expropiación en Ley de Costas'...)"
                            className="bg-transparent border-none outline-none text-white w-full placeholder:text-white/30"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <div className="text-[10px] items-center gap-2 text-primary font-mono hidden md:flex">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                            SEMANTIC ACTIVE
                        </div>
                    </div>
                </div>
            </div>

            {/* The New AI-Organized Stacks */}
            <LibraryStacks data={data} key={JSON.stringify(data)} />

        </div>
    );
}
