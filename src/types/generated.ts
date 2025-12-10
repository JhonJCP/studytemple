// Shared domain types for Study Temple (content, audio, practicals, flashcards, tests, embeddings).
import type { GeneratedTopicContent } from "@/lib/widget-types";

export type GenerationStatus = "draft" | "complete" | "error";

export interface GeneratedContentRecord {
    id: string;
    user_id: string;
    topic_id: string;
    content_json: GeneratedTopicContent;
    audio_script?: string | null;
    audio_url?: string | null;
    audio_duration?: number | null;
    images?: Array<{ widget_id: string; url: string; prompt?: string }> | null;
    status: GenerationStatus;
    is_complete: boolean;
    created_at: string;
    updated_at: string;
}

export interface Podcast {
    script: string;
    audioUrl?: string;
    durationSeconds?: number;
    transcript?: string[];
}

export interface PracticalAnalysis {
    id: string;
    practical_id: string;
    summary?: string;
    key_issues?: string[];
    legal_references?: string[];
    resolution_steps?: string[];
    exam_tips?: string[];
    common_mistakes?: string[];
    audio_script?: string;
    audio_url?: string;
    audio_duration?: number;
    is_complete: boolean;
    created_at: string;
    updated_at: string;
}

export interface Flashcard {
    id: string;
    topic_id: string;
    front: string;
    back: string;
    difficulty: number;
    ease_factor: number;
    interval: number;
    repetitions: number;
    next_review?: string | null;
    last_review?: string | null;
    status: "new" | "learning" | "graduated";
    source?: string | null;
    created_at: string;
    updated_at: string;
}

export interface TestQuestion {
    id: string;
    topic_id?: string | null;
    question: string;
    options: string[];
    correct_index: number;
    explanation?: string | null;
    reference?: string | null;
    source?: string | null;
    created_at: string;
    updated_at: string;
}

export interface KnowledgeChunk {
    id: number;
    topic_id?: string | null;
    source_type?: string | null;
    content: string;
    metadata?: Record<string, unknown> | null;
    created_at: string;
}

export interface TopicTimeEstimate {
    group: string;
    topicTitle: string;
    topicId: string;
    complexity: "High" | "Medium" | "Low";
    baseStudyMinutes: number;
    recommendedContentLength: "concise" | "standard" | "extended";
    reviewPlan: Array<{ offsetDays: number; type: "review_flashcards" | "test_practice"; minutes: number }>;
    totalPlannedMinutes: number;
}

export interface DetailedPlan {
    strategic_analysis: string;
    topic_time_estimates: TopicTimeEstimate[];
    daily_schedule: Array<{
        date: string;
        topicTitle: string;
        topicId: string;
        type: "study" | "review_flashcards" | "test_practice";
        durationMinutes: number;
        startTime?: string;
        endTime?: string;
        breaks?: string;
        aiReasoning?: string;
        complexity?: "High" | "Medium" | "Low";
    }>;
}
