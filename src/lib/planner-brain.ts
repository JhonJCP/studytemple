
import { DEFAULT_SYLLABUS } from "./default-syllabus";

// Types
export interface StudyPlan {
    availability: { [key: string]: number }; // minutes per day (mon, tue...)
    goalDate: Date;
    intensity: 'relaxed' | 'balanced' | 'intense';
}

export interface ScheduledSession {
    date: Date;
    topicId: string;
    topicTitle: string;
    durationMinutes: number;
    mode: 'deep_dive' | 'summary' | 'flashcards' | 'audio';
    reason: string; // "Compressed due to tight schedule"
    originalLengthPages: number; // Estimated
}

// Estimates
const PAGES_PER_HOUR_DEEP = 10;
const PAGES_PER_HOUR_SUMMARY = 40; // Skimming/Summary reading

// The Brain Function
export function generateSchedule(plan: StudyPlan, startDate: Date = new Date()): ScheduledSession[] {
    const schedule: ScheduledSession[] = [];
    let currentDate = new Date(startDate);
    const deadline = plan.goalDate;

    // 1. Flatten Syllabus to Task List
    // We filter out Supplementary for the core plan
    const tasks = [];
    DEFAULT_SYLLABUS.groups.forEach(group => {
        if (group.title.toLowerCase().includes("suplementario")) return;

        group.topics.forEach(topic => {
            // ESTIMATION HEURISTIC:
            // Longer filenames often imply longer docs? No, unreliable.
            // For now, assume a standard "Heavy" topic is ~30 pages, "Light" is ~10.
            // We'll guess based on keywords.
            let pages = 20;
            if (topic.title.includes("Ley")) pages = 50;
            if (topic.title.includes("Guía")) pages = 15;
            if (topic.title.includes("Supuesto")) pages = 10; // Practice is slower but less pages

            tasks.push({
                ...topic,
                group: group.title,
                pages: pages
            });
        });
    });

    // 2. Calculate Total Demand
    const totalPages = tasks.reduce((sum, t) => sum + t.pages, 0);
    const deepHoursNeeded = totalPages / PAGES_PER_HOUR_DEEP;

    // 3. Calculate Total Supply (Time)
    // Simple loop from start to deadline
    let availableMinutes = 0;
    const dayIterator = new Date(startDate);
    while (dayIterator <= deadline) {
        const dayName = dayIterator.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        // Handle "saturday", "sunday" keys from plan if they exist, or defaults
        const mins = plan.availability[dayName] || 0;
        availableMinutes += mins;
        dayIterator.setDate(dayIterator.getDate() + 1);
    }

    const availableHours = availableMinutes / 60;
    const compressionRatio = availableHours / deepHoursNeeded;

    console.log(`🧠 PLANNER BRAIN: Demand=${deepHoursNeeded}h, Supply=${availableHours}h, Ratio=${compressionRatio.toFixed(2)}`);

    // 4. Distribute
    let taskIndex = 0;
    currentDate = new Date(startDate);

    while (currentDate <= deadline && taskIndex < tasks.length) {
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const minsToday = plan.availability[dayName] || 0;

        if (minsToday > 0) {
            let timeRemaining = minsToday;

            while (timeRemaining > 20 && taskIndex < tasks.length) { // Minimum 20 min slot
                const task = tasks[taskIndex];

                // Decide Mode based on Ratio
                let mode: ScheduledSession['mode'] = 'deep_dive';
                let pagesPerHour = PAGES_PER_HOUR_DEEP;
                let reason = "Estudio profundo estándar.";

                if (compressionRatio < 0.8) {
                    mode = 'summary';
                    pagesPerHour = PAGES_PER_HOUR_SUMMARY;
                    reason = "Tiempo escaso. Modo Resumen activado.";
                }

                // Specific Logic: Practice is always 'deep' logic basically (handling exercises)
                if (task.group.includes("Práctica")) {
                    mode = 'deep_dive'; // Practice needs time
                    reason = "Práctica requiere tiempo real.";
                }

                const neededHours = task.pages / pagesPerHour;
                const neededMinutes = neededHours * 60;

                // Create Session
                // If it fits, schedule it. If not, split it? 
                // For MVP, we squeeze it or carry over. We'll carry over logic simply by reducing pages.

                const allocatedMinutes = Math.min(timeRemaining, neededMinutes);
                const percentDone = allocatedMinutes / neededMinutes;

                schedule.push({
                    date: new Date(currentDate),
                    topicId: task.originalFilename, // Using ID as filename for now
                    topicTitle: task.title,
                    durationMinutes: Math.floor(allocatedMinutes),
                    mode: mode,
                    reason: reason + (percentDone < 1 ? " (Continuar mañana)" : ""),
                    originalLengthPages: task.pages
                });

                timeRemaining -= allocatedMinutes;

                if (percentDone >= 0.9) {
                    taskIndex++; // Done
                } else {
                    // Task remains for next slot (simplified loop: we just reduce its 'pages' effectively, 
                    // but here we just leave taskIndex and loop again next day)
                    // Wait, unlimited while loop hazard. 
                    // To simplify: if we can't finish, we move to next day.
                    break;
                }
            }
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return schedule;
}
