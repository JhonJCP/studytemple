
import { ScheduledSession } from "@/lib/planner-brain";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CalendarGridProps {
    currentDate: Date;
    schedule: ScheduledSession[];
    onSelectDate: (date: Date) => void;
    selectedDate: Date;
}

export function CalendarGrid({ currentDate, schedule, onSelectDate, selectedDate }: CalendarGridProps) {
    // Get visible month days
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Days padding
    const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon start
    const totalDays = lastDay.getDate();

    const days = [];
    for (let i = 0; i < startPadding; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));

    const getDailyLoad = (d: Date) => {
        const tasks = schedule.filter(s => s.date.getDate() === d.getDate() && s.date.getMonth() === d.getMonth());
        return { count: tasks.length, type: tasks.some(t => t.type === 'study') ? 'heavy' : 'review' };
    };

    const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

    return (
        <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Diciembre 2025</h3>
                <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-[10px] text-white/40 uppercase">Estudio</span>
                    <span className="w-2 h-2 rounded-full bg-purple-500 ml-2"></span>
                    <span className="text-[10px] text-white/40 uppercase">Repaso</span>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
                {WEEKDAYS.map(d => <div key={d} className="text-center text-xs font-bold text-white/20">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-2">
                {days.map((date, idx) => {
                    if (!date) return <div key={idx} className="h-10 md:h-14" />;

                    const { count, type } = getDailyLoad(date);
                    const isSelected = selectedDate.getDate() === date.getDate() && selectedDate.getMonth() === date.getMonth();
                    const isToday = new Date().getDate() === date.getDate() && new Date().getMonth() === date.getMonth();

                    return (
                        <motion.button
                            key={idx}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onSelectDate(date)}
                            className={cn(
                                "h-10 md:h-14 rounded-lg flex flex-col items-center justify-center relative border transition-all",
                                isSelected ? "bg-white/10 border-white/50" : "bg-white/5 border-transparent hover:bg-white/10",
                                isToday && "ring-1 ring-green-500"
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
                                    {count > 1 && <span className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                                </div>
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
