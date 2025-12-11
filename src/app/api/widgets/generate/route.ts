/**
 * API ENDPOINT - Generación de Widgets On-Demand
 * 
 * Este endpoint recibe peticiones del frontend para generar
 * widgets específicos usando los "cerebros" correspondientes.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateInfografia } from "@/lib/widget-brains/infografia-brain";
import { generateMnemonic } from "@/lib/widget-brains/mnemonic-brain";
import { generateCasePractice } from "@/lib/widget-brains/case-practice-brain";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
const WIDGET_TIMEOUT_MS = 120000; // 2 minutos para generación de widget

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    
    try {
        const { widgetType, widgetData, topicId, userId } = await req.json();
        
        console.log(`[WIDGET-API] Request: type=${widgetType}, topic=${topicId}`);
        
        // Verificar autenticación
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Verificar si ya existe en caché (DB)
        const { data: cachedWidget } = await supabase
            .from('generated_content')
            .select('content_json')
            .eq('user_id', user.id)
            .eq('topic_id', topicId)
            .single();
        
        // Buscar widget en caché
        if (cachedWidget?.content_json?.widgets) {
            const existingWidget = cachedWidget.content_json.widgets.find(
                (w: any) => w.id === widgetData.widgetId && w.generated === true
            );
            
            if (existingWidget?.cachedResult) {
                console.log(`[WIDGET-API] Using cached widget: ${widgetData.widgetId}`);
                return NextResponse.json({ 
                    success: true, 
                    result: existingWidget.cachedResult,
                    cached: true,
                    elapsed: Date.now() - startTime 
                });
            }
        }
        
        // Generar widget según tipo
        let result;
        
        switch (widgetType) {
            case 'infografia':
                result = await generateInfografia({
                    frame: widgetData.frame,
                    concept: widgetData.concept,
                    topicId,
                    widgetId: widgetData.widgetId || `widget_${Date.now()}`
                });
                break;
                
            case 'mnemonic':
                result = await generateMnemonic({
                    frame: widgetData.frame,
                    termsToMemorize: widgetData.termsToMemorize || []
                });
                break;
                
            case 'case_practice':
                result = await generateCasePractice({
                    frame: widgetData.frame,
                    concept: widgetData.concept
                });
                break;
                
            default:
                return NextResponse.json(
                    { error: `Unknown widget type: ${widgetType}` },
                    { status: 400 }
                );
        }
        
        // Guardar resultado en caché (actualizar generated_content)
        if (cachedWidget?.content_json) {
            const updatedWidgets = cachedWidget.content_json.widgets?.map((w: any) => {
                if (w.id === widgetData.widgetId) {
                    return {
                        ...w,
                        generated: true,
                        cachedResult: result
                    };
                }
                return w;
            }) || [];
            
            await supabase
                .from('generated_content')
                .update({
                    content_json: {
                        ...cachedWidget.content_json,
                        widgets: updatedWidgets
                    }
                })
                .eq('user_id', user.id)
                .eq('topic_id', topicId);
            
            console.log(`[WIDGET-API] Widget cached: ${widgetData.widgetId}`);
        }
        
        const elapsed = Date.now() - startTime;
        console.log(`[WIDGET-API] Success: type=${widgetType}, elapsed=${elapsed}ms`);
        
        return NextResponse.json({ 
            success: true, 
            result,
            cached: false,
            elapsed 
        });
        
    } catch (error) {
        console.error('[WIDGET-API] Error:', error);
        return NextResponse.json(
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                elapsed: Date.now() - startTime
            },
            { status: 500 }
        );
    }
}

