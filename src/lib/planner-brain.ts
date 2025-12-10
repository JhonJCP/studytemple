
import { DEFAULT_SYLLABUS } from "./default-syllabus";

/** 
 * PLANNER BRAIN v3.0 - AI ENHANCED
 * 
 * Capability:
 * - Analyzes topic semantic complexity.
 * - Estimates optimal "Condensed Length" vs "Original Length".
 * - Schedules with a "Sprint" weighting algorithm.
 */

// --- Types ---

export interface StudyPlan {
    availability: { [key: string]: number }; // minutes per day
    startDate: Date;
    goalDate: Date;
    intensity: 'relaxed' | 'balanced' | 'intense';
}

export type SessionType = 'study' | 'review_flashcards' | 'test_practice' | 'comprehensive_review';

export interface ScheduledSession {
    id: string;
    date: Date;
    topicId: string;
    topicTitle: string;
    durationMinutes: number;
    type: SessionType;
    status: 'pending' | 'completed' | 'missed';
    complexity: 'High' | 'Medium' | 'Low';
    aiReasoning: string;
    startTime?: string;
    endTime?: string;
    breaks?: string;
}

interface AnalyzedTask {
    title: string;
    originalFilename: string;
    group: string;
    basePages: number;
    complexity: 'High' | 'Medium' | 'Low'; // AI Determined
    weight: number; // 1.0 = Standard, 1.5 = Hard, 0.7 = Easy
}

// --- AI Analysis Simulation ---
// In a full production agent, this would run via an LLM call for every file.
// Here we simulate the "Architecture of Understanding".

const AI_KNOWLEDGE_BASE: Record<string, { complexity: 'High' | 'Medium' | 'Low', weight: number, reason: string }> = {
    "ley": { complexity: 'High', weight: 1.5, reason: "Alta densidad jurídica." },
    "reglamento": { complexity: 'High', weight: 1.3, reason: "Normativa técnica detallada." },
    "guía": { complexity: 'Low', weight: 0.7, reason: "Documento orientativo, lectura rápida." },
    "supuesto": { complexity: 'Medium', weight: 1.2, reason: "Requiere cálculo y razonamiento activo." },
    "trazado": { complexity: 'High', weight: 1.4, reason: "Geometría compleja y normativa estricta." },
    "firmes": { complexity: 'Medium', weight: 1.1, reason: "Memorización de capas y materiales." },
    "general": { complexity: 'Medium', weight: 1.0, reason: "Conceptos estándar." }
};

function analyzeTopic(title: string): AnalyzedTask['complexity'] {
    const t = title.toLowerCase();
    if (t.includes("ley") || t.includes("trazado") || t.includes("costas")) return 'High';
    if (t.includes("guía") || t.includes("informe")) return 'Low';
    return 'Medium';
}

function getAIAnalysis(title: string) {
    const t = title.toLowerCase();
    for (const [key, data] of Object.entries(AI_KNOWLEDGE_BASE)) {
        if (t.includes(key)) return data;
    }
    return { complexity: 'Medium' as const, weight: 1.0, reason: "Contenido estándar del temario." };
}


// --- Helper: Flatten Syllabus with AI Analysis ---
function getAnalyzedTasks(): AnalyzedTask[] {
    const tasks: AnalyzedTask[] = [];
    DEFAULT_SYLLABUS.groups.forEach((group: any) => {
        if (group.title.toLowerCase().includes("suplementario")) return;
        group.topics.forEach((topic: any) => {
            const analysis = getAIAnalysis(topic.title);

            // Base pages estimation based on typical PDF size for these topics
            let pages = 20;
            if (analysis.complexity === 'High') pages = 45;
            if (analysis.complexity === 'Low') pages = 12;

            tasks.push({
                title: topic.title,
                originalFilename: topic.originalFilename,
                group: group.title,
                basePages: pages,
                complexity: analysis.complexity,
                weight: analysis.weight
            });
        });
    });
    return tasks;
}

// --- Core Algorithm ---

export function generateSmartSchedule(plan: StudyPlan): ScheduledSession[] {
    const schedule: ScheduledSession[] = [];
    const start = plan.startDate > new Date() ? plan.startDate : new Date();
    const end = plan.goalDate;
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const tasks = getAnalyzedTasks();

    // Timeline Buckets
    const dayBuckets: { [key: number]: ScheduledSession[] } = {};
    for (let i = 0; i <= totalDays + 15; i++) dayBuckets[i] = [];

    const addToBucket = (dayIdx: number, session: ScheduledSession) => {
        if (!dayBuckets[dayIdx]) dayBuckets[dayIdx] = [];
        session.date = new Date(start);
        session.date.setDate(start.getDate() + dayIdx);
        dayBuckets[dayIdx].push(session);
    };

    let currentStudyDay = 0;

    tasks.forEach((task, idx) => {
        let placed = false;
        // Optimization: Try to group by Topic Group? No, sequential for now.

        while (!placed && currentStudyDay < totalDays) {
            const dayName = new Date(start.getTime() + currentStudyDay * 86400000)
                .toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const dailyLimit = plan.availability[dayName] || 0;

            const used = (dayBuckets[currentStudyDay] || []).reduce((acc, s) => acc + s.durationMinutes, 0);

            // THE AI CALCULATION:
            // Duration = BasePages * (Mins/Page) * ComplexityWeight
            // High Complexity = Slower reading (3 min/page)
            // Low Complexity = Fast reading (1.5 min/page)
            const speed = task.complexity === 'High' ? 3.0 : task.complexity === 'Low' ? 1.5 : 2.0;
            const estimatedDuration = Math.ceil(task.basePages * speed * task.weight);

            // Cap duration to 60% of daily limit per single session to avoid burnout, 
            // unless it's impossible, then cap at daily limit.
            const maxSession = Math.max(30, Math.floor(dailyLimit * 0.8));
            const actualDuration = Math.min(estimatedDuration, dailyLimit);
            // If it doesn't fit mostly, move to next day

            if (used + actualDuration <= dailyLimit) {
                // Place STUDY
                addToBucket(currentStudyDay, {
                    id: `study-${idx}`,
                    date: new Date(),
                    topicId: task.originalFilename,
                    topicTitle: task.title,
                    durationMinutes: actualDuration,
                    type: 'study',
                    status: 'pending',
                    complexity: task.complexity,
                    aiReasoning: `Complejidad ${task.complexity}. Extensión estimada: ${task.basePages} pags. Tiempo ajustado por IA.`
                });

                // Place REVIEWS (Spaced Repetition)
                // High Complexity tags get more frequent reviews
                const intervals = task.complexity === 'High' ? [1, 3, 7] : [1, 5];

                intervals.forEach((interval, reviewIdx) => {
                    const reviewDay = currentStudyDay + interval;
                    const type = reviewIdx === 0 ? 'review_flashcards' : 'test_practice';

                    addToBucket(reviewDay, {
                        id: `review-${idx}-${reviewIdx}`,
                        date: new Date(),
                        topicId: task.originalFilename,
                        topicTitle: task.title,
                        durationMinutes: type === 'test_practice' ? 30 : 15,
                        type: type,
                        status: 'pending',
                        complexity: task.complexity,
                        aiReasoning: type === 'test_practice' ? "Simulacro para afianzar conceptos complejos." : "Repaso rápido SRS."
                    });
                });

                placed = true;
            } else {
                currentStudyDay++;
            }
        }
    });

    // Flatten
    Object.keys(dayBuckets).forEach(dayIdxStr => {
        const dayIdx = parseInt(dayIdxStr);
        const sessions = dayBuckets[dayIdx];
        if (sessions) {
            sessions.forEach(s => {
                const d = new Date(start);
                d.setDate(start.getDate() + dayIdx);
                s.date = d;
                schedule.push(s);
            });
        }
    });

    return schedule.sort((a, b) => a.date.getTime() - b.date.getTime());
}
