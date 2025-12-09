
export interface ReviewItem {
    topicId: string;
    interval: number;
    repetition: number;
    efFactor: number;
    nextReviewDate: Date;
}

export class SrsService {

    /**
     * Calculates new SRS state based on user performance rating (0-3).
     * 0: Forgot completely (Reset)
     * 1: Hard (Small interval increase)
     * 2: Good (Standard increase)
     * 3: Easy (Large increase)
     */
    calculateNextReview(current: ReviewItem, rating: 0 | 1 | 2 | 3): ReviewItem {
        let { interval, repetition, efFactor } = current;

        if (rating === 0) {
            // Reset logic if forgotten
            repetition = 0;
            interval = 1;
        } else {
            // Update Easiness Factor
            // Standard SM-2 formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
            // Mapped q: 0->?, our rating is 0-3. Let's maximize it simply.
            // If rating is 3 (Easy), EF goes up. If 1 (Hard), EF goes down.

            if (rating === 1) efFactor = Math.max(1.3, efFactor - 0.15);
            if (rating === 2) efFactor = efFactor; // Stable
            if (rating === 3) efFactor = efFactor + 0.1;

            repetition += 1;

            if (repetition === 1) {
                interval = 1;
            } else if (repetition === 2) {
                interval = 6;
            } else {
                interval = Math.round(interval * efFactor);
            }
        }

        // Calculate Date
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + interval);

        // LOG TO BRAIN DASHBOARD
        // Ensure this runs only on client or compatible environment if server side is monitored.
        // Assuming this service runs where it can log.
        if (typeof window !== 'undefined') {
            const agentMonitor = require('./agent-monitor').agentMonitor;
            agentMonitor.log(
                "Optimizador Tiempo",
                `Ajuste SRS: ${current.topicId}`,
                `Input Rating: ${rating}/3 | Current Interval: ${current.interval}d`,
                `Decisión: Nueva revisión en ${interval} días.`,
                10 // minimal latency for algo
            );
        }

        return {
            topicId: current.topicId,
            interval,
            repetition,
            efFactor,
            nextReviewDate: nextDate
        };
    }

    getInitialState(topicId: string): ReviewItem {
        return {
            topicId,
            interval: 0,
            repetition: 0,
            efFactor: 2.5,
            nextReviewDate: new Date() // Due immediately
        };
    }
}

export const srsService = new SrsService();
