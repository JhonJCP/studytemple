
import { ScheduledSession } from "@/lib/planner-brain";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarGridProps {
    currentDate: Date;
    schedule: ScheduledSession[];
    onSelectDate: (date: Date) => void;
    selectedDate: Date;
    onNavigateMonth: (direction: 1 | -1) => void;
}

export function CalendarGrid({ currentDate, schedule, onSelectDate, selectedDate, onNavigateMonth }: CalendarGridProps) {
    // Get visible month days
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // We navigate using currentDate as the "Viewport"
    const viewportDate = new Date(year, month, 1);

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon start
    const totalDays = lastDay.getDate();

    const days = [];
    for (let i = 0; i < startPadding; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));

    const getDailyLoad = (d: Date) => {
        const tasks = schedule.filter(s => {
            const sd = new Date(s.date);
            return sd.getDate() === d.getDate() && sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
        });
        return {
            count: tasks.length,
            type: tasks.some(t => t.type === 'study') ? 'heavy' : 'review',
            hasTest: tasks.some(t => t.type === 'test_practice')
        };
    };

    const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
    const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    return (
        <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-6">
                <button
                    onClick={() => onNavigateMonth(-1)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-white/70" />
                </button>

                <h3 className="text-lg font-bold text-white uppercase tracking-wider min-w-[140px] text-center">
                    {MONTH_NAMES[month]} {year}
                </h3>

                <button
                    onClick={() => onNavigateMonth(1)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ChevronRight className="w-5 h-5 text-white/70" />
                </button>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-4 mb-4 text-[10px] text-white/40 uppercase">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Estudio</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Repaso</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 border border-red-400"></span> Examen</div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
                {WEEKDAYS.map(d => <div key={d} className="text-center text-xs font-bold text-white/20">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-2">
                {days.map((date, idx) => {
                    if (!date) return <div key={idx} className="h-10 md:h-14" />;

                    const { count, type, hasTest } = getDailyLoad(date);
                    const isSelected = selectedDate.getDate() === date.getDate() && selectedDate.getMonth() === date.getMonth();
                    const isToday = new Date().getDate() === date.getDate() && new Date().getMonth() === date.getMonth() && new Date().getFullYear() === date.getFullYear();

                    return (
                        <motion.button
                            key={idx}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onSelectDate(date)}
                            className={cn(
                                "h-10 md:h-14 rounded-lg flex flex-col items-center justify-center relative border transition-all",
                                isSelected ? "bg-white/10 border-white/50" : "bg-white/5 border-transparent hover:bg-white/10",
                                isToday && "ring-1 ring-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]",
                                hasTest && "border-red-500/30 bg-red-500/5"
                            )}
                        >
                            <span className={cn("text-xs md:text-sm font-bold", isSelected ? "text-white" : "text-white/50")}>
                                {date.getDate()}
                            </span>
                            {count > 0 && (
                                <div className="flex gap-1 mt-1">
                                    <span className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        type === 'heavy' ? "bg-green-500" : "bg-purple-500"
                                    )} />
                                    {hasTest && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                                </div>
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
