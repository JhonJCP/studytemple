/**
 * DIAGNOSE FULL - Diagnóstico completo del sistema
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET(req: NextRequest) {
    // Ver qué archivos existen
    const infografiaExists = existsSync(join(process.cwd(), 'src', 'lib', 'widget-brains', 'infografia-brain.ts'));
    const audioExists = existsSync(join(process.cwd(), 'src', 'lib', 'audio-brain.ts'));
    const planningImportExists = existsSync(join(process.cwd(), 'src', 'app', 'admin', 'import-planning', 'page.tsx'));
    
    // Leer versión del OrchestratorFlow
    let orchestratorHasFix = false;
    try {
        const orchestratorPath = join(process.cwd(), 'src', 'components', 'OrchestratorFlow.tsx');
        const content = readFileSync(orchestratorPath, 'utf-8');
        orchestratorHasFix = content.includes('if (!config) return null');
    } catch (err) {
        // ignore
    }
    
    // Leer versión del global-planner
    let plannerReadsDB = false;
    try {
        const plannerPath = join(process.cwd(), 'src', 'lib', 'global-planner.ts');
        const content = readFileSync(plannerPath, 'utf-8');
        plannerReadsDB = content.includes('loadPlanningFromDB');
    } catch (err) {
        // ignore
    }
    
    return NextResponse.json({
        deployment: {
            buildTime: new Date().toISOString(),
            nodeVersion: process.version
        },
        files: {
            infografiaBrain: infografiaExists,
            audioBrain: audioExists,
            importPlanningPage: planningImportExists
        },
        fixes: {
            orchestratorCrashFix: orchestratorHasFix,
            plannerReadsDB: plannerReadsDB
        },
        env: {
            hasGeminiKey: !!process.env.GEMINI_API_KEY,
            hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY,
            hasPlanningData: !!process.env.PLANNING_DATA
        }
    });
}

