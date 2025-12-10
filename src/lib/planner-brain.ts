
import { DEFAULT_SYLLABUS } from "./default-syllabus";

/** 
 * PLANNER BRAIN v2.0
 * Strategy: "The 30-Day Sprint to Mastery"
 * Goal: Complete entire syllabus + SRS Reviews + Tests between [Start] and [Goal].
 * 
 * Algorithm: Modified SM-2 for short-term sprints.
 * - Initial Study: "Deep Dive"
 * - Review 1: 1 day later (Flashcards)
 * - Review 2: 3 days later (Test)
 * - Review 3: 7 days later (Mixed)
 * - Final Review: 2 days before deadline.
 */

// --- Types ---

export interface StudyPlan {
    availability: { [key: string]: number }; // minutes per day
    startDate: Date;   // e.g. Dec 15, 2025
    goalDate: Date;    // e.g. Jan 15, 2026
    intensity: 'relaxed' | 'balanced' | 'intense';
}

export type SessionType = 'study' | 'review_flashcards' | 'test_practice' | 'comprehensive_review';

export interface ScheduledSession {
    id: string;
    date: Date;
    topicId: string; // Filename or unique ID
    topicTitle: string;
    durationMinutes: number;
    type: SessionType;
    status: 'pending' | 'completed' | 'missed';
    notes?: string;
}

interface Task {
    title: string;
    originalFilename: string;
    group: string;
    basePages: number;
}

// --- Configuration ---

const SPRINT_START = new Date("2025-12-15");
const SPRINT_END = new Date("2026-01-15");

// Standard intervals for "Sprint SRS" (Days after initial study)
// [1, 3, 7, 14] is standard, but for 30 days we compress.
const REVIEW_INTERVALS = [1, 4, 10];

const MIN_SESSION_MINUTES = 30;

// --- Helper: Flatten Syllabus ---
function getFlatTasks(): Task[] {
    const tasks: Task[] = [];
    DEFAULT_SYLLABUS.groups.forEach((group: any) => {
        if (group.title.toLowerCase().includes("suplementario")) return;
        group.topics.forEach((topic: any) => {
            let pages = 20;
            if (topic.title.includes("Ley")) pages = 40;
            if (topic.title.includes("Guía")) pages = 15;
            if (topic.title.includes("Supuesto")) pages = 25;

            tasks.push({
                title: topic.title,
                originalFilename: topic.originalFilename,
                group: group.title,
                basePages: pages
            });
        });
    });
    return tasks;
}

// --- Core Algorithm ---

export function generateSmartSchedule(plan: StudyPlan): ScheduledSession[] {
    const schedule: ScheduledSession[] = [];

    // 1. Setup Time boundaries
    // User requested specifically Dec 15 - Jan 15 strategy, but if today is different,
    // we should arguably adapt. For now, we respect the user's specific "Sprint" request dates
    // if provided in plan, otherwise default to current logic.
    const start = plan.startDate > new Date() ? plan.startDate : new Date(); // Don't schedule in past
    const end = plan.goalDate;
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // 2. Get Workload
    const tasks = getFlatTasks();
    const tasksCount = tasks.length;

    // 3. Distribute Initial Study Sessions
    // We need to fit ALL 'study' sessions within the first ~60% of the sprint 
    // to leave room for the SRS reviews of the last topics.
    const studyPhaseDays = Math.floor(totalDays * 0.7);
    const tasksPerDay = Math.ceil(tasksCount / studyPhaseDays);

    let currentDayIndex = 0;
    let taskIndex = 0;

    // We simulate day by day
    for (let dayOffset = 0; dayOffset <= totalDays; dayOffset++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + dayOffset);

        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        let minutesAvailable = plan.availability[dayName] || 0;

        // -- A. Schedule REVIEW sessions for previous topics first (Priority High) --
        // Check schedule for sessions that trigger a review today
        // (This is a simplified simulation of SRS: we look back at what we scheduled previously)
        // In a real DB app, we'd query "Due Reviews". Here we generate the plan upfront.

        // Strategy: We can't know what we scheduled *today* yet looking back, 
        // so we must push reviews into the future *when* we schedule the study session.

        // So, step back: We iterate mainly to fill "Study" slots, 
        // and when we place a study slot, we immediately reserve space in future days for reviews.
        // But future days heavily depend on available minutes.
        // This suggests a "Timeline Bucket" approach.
    }

    // --- Timeline Bucket Implementation ---
    // Initialize buckets for each day
    const dayBuckets: { [key: number]: ScheduledSession[] } = {};
    for (let i = 0; i <= totalDays + 5; i++) dayBuckets[i] = [];

    // Helper to add to bucket
    const addToBucket = (dayIdx: number, session: ScheduledSession) => {
        if (!dayBuckets[dayIdx]) dayBuckets[dayIdx] = [];
        session.date = new Date(start);
        session.date.setDate(start.getDate() + dayIdx);
        dayBuckets[dayIdx].push(session);
    };

    // 4. Place Sessions
    let currentStudyDay = 0;

    tasks.forEach((task, idx) => {
        // Find next day with available capacity for a Study Session
        // (Study take ~60-90 mins usually)
        let placed = false;
        while (!placed && currentStudyDay < totalDays) {
            const dayName = new Date(start.getTime() + currentStudyDay * 86400000)
                .toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const dailyLimit = plan.availability[dayName] || 0;

            // Calculate usage so far
            const used = (dayBuckets[currentStudyDay] || []).reduce((acc, s) => acc + s.durationMinutes, 0);

            const studyDuration = Math.min(dailyLimit, Math.max(30, task.basePages * 2)); // 2 min per page approx

            if (used + studyDuration <= dailyLimit) {
                // Place STUDY
                addToBucket(currentStudyDay, {
                    id: `study-${idx}`,
                    date: new Date(), // fixed later
                    topicId: task.originalFilename,
                    topicTitle: task.title,
                    durationMinutes: studyDuration,
                    type: 'study',
                    status: 'pending',
                    notes: 'Sesión inicial de lectura y comprensión.'
                });

                // Place SRS REVIEWS (Future)
                REVIEW_INTERVALS.forEach((interval, reviewIdx) => {
                    const reviewDay = currentStudyDay + interval;
                    if (reviewDay <= totalDays) {
                        const type = reviewIdx === 0 ? 'review_flashcards' :
                            reviewIdx === 1 ? 'test_practice' : 'comprehensive_review';

                        addToBucket(reviewDay, {
                            id: `review-${idx}-${reviewIdx}`,
                            date: new Date(), // fixed later 
                            topicId: task.originalFilename,
                            topicTitle: task.title,
                            durationMinutes: 20, // Reviews are faster
                            type: type,
                            status: 'pending',
                            notes: type === 'test_practice' ? 'Simulacro de examen test.' : 'Repaso espaciado activo.'
                        });
                    }
                });

                placed = true;
            } else {
                currentStudyDay++; // Try next day
            }
        }
    });

    // 5. Flatten Buckets to Final Schedule
    Object.keys(dayBuckets).forEach(dayIdxStr => {
        const dayIdx = parseInt(dayIdxStr);
        const sessions = dayBuckets[dayIdx];
        if (sessions && sessions.length > 0) {
            sessions.forEach(s => {
                // Fix date object
                const d = new Date(start);
                d.setDate(start.getDate() + dayIdx);
                s.date = d;
                schedule.push(s);
            });
        }
    });

    return schedule.sort((a, b) => a.date.getTime() - b.date.getTime());
}
