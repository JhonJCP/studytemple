"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    BookOpen,
    Swords,
    Calendar,
    HardHat,
    Droplets,
    Anchor,
    Book,
    Scale,
    Wallet,
    ChevronRight,
    ChevronDown
} from "lucide-react";
import { useState } from "react";
import { SYLLABUS_DATA, getTopicsByZone } from "@/lib/syllabus-data";

const ZONES = [
    { id: "A", title: "Carreteras", icon: HardHat, color: "text-orange-400" },
    { id: "B", title: "Aguas", icon: Droplets, color: "text-blue-400" },
    { id: "C", title: "Costas", icon: Anchor, color: "text-cyan-400" },
    { id: "D", title: "Medio Ambiente", icon: Book, color: "text-green-400" },
    { id: "E", title: "Administrativo", icon: Scale, color: "text-slate-400" },
    { id: "F", title: "Práctica", icon: Wallet, color: "text-purple-400" },
];

export function Sidebar() {
    const pathname = usePathname();
    const [expandedZone, setExpandedZone] = useState<string | null>(null);

    // Don't show sidebar on login page
    if (pathname === "/login") return null;

    const toggleZone = (zoneId: string) => {
        setExpandedZone(expandedZone === zoneId ? null : zoneId);
    };

    return (
        <aside className="fixed left-0 top-0 h-screen w-72 bg-black/90 border-r border-white/10 backdrop-blur-xl flex flex-col z-50 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="p-6 border-b border-white/10">
                <Link href="/dashboard" className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 group-hover:bg-primary/30 transition-colors">
                        <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                    </div>
                    <div>
                        <h2 className="font-black text-white tracking-tight">STUDY TEMPLE</h2>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Obras Públicas</p>
                    </div>
                </Link>
            </div>

            {/* Main Navigation */}
            <nav className="p-4 space-y-2">
                <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" active={pathname === "/dashboard"} />
                <NavItem href="/library" icon={BookOpen} label="Gran Biblioteca" active={pathname === "/library"} />
                <NavItem href="/dojo" icon={Swords} label="El Dojo" active={pathname === "/dojo"} />
                <NavItem href="/calendar" icon={Calendar} label="Calendario" active={pathname === "/calendar"} />
            </nav>

            {/* Syllabus Tree */}
            <div className="px-6 py-4">
                <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-full h-px bg-white/10" />
                    Temario
                    <span className="w-full h-px bg-white/10" />
                </h3>

                <div className="space-y-1">
                    {ZONES.map((zone) => {
                        const isExpanded = expandedZone === zone.id;
                        const topics = getTopicsByZone(zone.id);

                        return (
                            <div key={zone.id} className="rounded-xl overflow-hidden">
                                <button
                                    onClick={() => toggleZone(zone.id)}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 text-sm font-medium transition-all hover:bg-white/5",
                                        isExpanded ? "bg-white/5 text-white" : "text-white/60"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <zone.icon className={cn("w-4 h-4", zone.color)} />
                                        <span>Bloque {zone.id}</span>
                                    </div>
                                    {isExpanded ? <ChevronDown className="w-3 h-3 opacity-50" /> : <ChevronRight className="w-3 h-3 opacity-50" />}
                                </button>

                                {isExpanded && (
                                    <div className="bg-black/40 border-l border-white/5 ml-4 pl-2 py-2 space-y-1">
                                        {topics.map(topic => (
                                            <Link
                                                key={topic.id}
                                                href={`/syllabus/topic/${topic.id}`}
                                                className={cn(
                                                    "block text-xs py-2 px-3 rounded-lg transition-colors leading-relaxed line-clamp-2",
                                                    pathname === `/syllabus/topic/${topic.id}`
                                                        ? "bg-primary/20 text-primary border border-primary/10"
                                                        : "text-white/40 hover:text-white hover:bg-white/5"
                                                )}
                                                title={topic.title}
                                            >
                                                {topic.title}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all border",
                active
                    ? "bg-primary text-black border-primary font-bold shadow-lg shadow-primary/20"
                    : "text-white/60 border-transparent hover:bg-white/5 hover:text-white"
            )}
        >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
        </Link>
    );
}
