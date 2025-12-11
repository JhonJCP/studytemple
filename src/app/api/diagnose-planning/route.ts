/**
 * DIAGNOSE PLANNING - Verificar si PLANNING_DATA está cargado
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const hasEnvVar = !!process.env.PLANNING_DATA;
    const envVarLength = process.env.PLANNING_DATA?.length || 0;
    
    let parsed = null;
    let parseError = null;
    
    if (process.env.PLANNING_DATA) {
        try {
            parsed = JSON.parse(process.env.PLANNING_DATA);
        } catch (err) {
            parseError = err instanceof Error ? err.message : 'Unknown parse error';
        }
    }
    
    return NextResponse.json({
        hasEnvVar,
        envVarLength,
        parseError,
        topicCount: parsed?.topic_time_estimates?.length || 0,
        scheduleCount: parsed?.daily_schedule?.length || 0,
        firstTopic: parsed?.topic_time_estimates?.[0] || null,
        sampleSchedule: parsed?.daily_schedule?.[0] || null
    });
}

