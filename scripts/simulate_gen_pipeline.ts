
import { TopicContentGenerator } from "../src/lib/topic-content-generator";
import { getTopicById } from "../src/lib/syllabus-hierarchy";
import dotenv from 'dotenv';
dotenv.config();

// Mock environment variables if needed but we want to simulate full flow
// This script is intended to be run with ts-node or similar in an environment where .env.local is loaded or vars are set.

async function simulatePipeline() {
    console.log("=== SIMULACIÓN PIPELINE DE GENERACIÓN ===");

    // 1. Validar Topic
    const topicId = "g0-t7"; // Ajusta esto a un ID real que sepas que es "Ley 9/1991" o similar
    console.log(`[SIM] Buscando topic: ${topicId}`);

    // We need to import the real syllabus so we use the real getTopicById
    const topic = getTopicById(topicId);

    if (!topic) {
        console.error("❌ Topic no encontrado. Usa un ID válido del syllabus.");
        // Listar algunos para ayudar
        // const all = getAllTopicsWithGroups().slice(0,3);
        // console.log("Ejemplos:", all.map(t => `${t.id}: ${t.title}`));
        return;
    }
    console.log(`✅ Topic encontrado: ${topic.title} (${topic.originalFilename})`);

    // 2. Instanciar Generador con listener de estado
    console.log("\n[SIM] Iniciando generador...");
    const generator = new TopicContentGenerator(topicId, (state) => {
        const step = state.currentStep;

        // Log de cambios de estado relevantes
        if (state.status === 'error') {
            // Encontrar el paso con error
            const errorStep = state.steps.find(s => s.status === 'error');
            console.error(`🔴 ESTADO: Error - ${errorStep ? errorStep.error : 'Desconocido'}`);
        } else if (step) {
            const currentStepData = state.steps.find(s => s.role === step);
            if (currentStepData && currentStepData.status === 'running') {
                console.log(`\n🔹 PASO: ${step.toUpperCase()} Iniciado`);
                if (currentStepData.input) {
                    // Check for prompt preview to validate UI visibility
                    const preview = (currentStepData.input as any).prompt_preview;
                    if (preview) {
                        console.log(`   👀 Prompt Preview visible: ${preview.slice(0, 50)}...`);
                    } else {
                        console.warn(`   ⚠️ No prompt_preview found for ${step}`);
                    }
                }
            } else if (currentStepData && currentStepData.status === 'completed') {
                console.log(`   ✅ ${step.toUpperCase()} Completado. Razonamiento: ${currentStepData.reasoning?.slice(0, 50)}...`);
            }
        }
    });

    try {
        const result = await generator.generate();
        console.log("\n=== GENERACIÓN FINALIZADA CON ÉXITO ===");
        console.log(`Salud: ${JSON.stringify(result.metadata.health, null, 2)}`);

        const totalWords = result.sections.reduce((acc, s) => {
            const text = typeof s.content?.text === 'string' ? s.content.text : '';
            return acc + text.split(/\s+/).filter(w => w.length > 0).length;
        }, 0);

        console.log(`Total Palabras: ${totalWords}`);
        console.log(`Secciones: ${result.sections.length}`);

        // Validar contenido real
        const emptySections = result.sections.filter(s => !s.content?.text || s.content.text.length < 50);
        if (emptySections.length > 0) {
            console.warn(`⚠️ ALERTA: ${emptySections.length} secciones parecen vacías o muy cortas.`);
        } else {
            console.log("✅ Todas las secciones tienen contenido.");
        }

    } catch (e) {
        console.error("\n❌ ERROR CRÍTICO EN PIPELINE:");
        console.error(e);

        // Mostrar telemetría del error
        const events = generator.getTelemetrySummary();
        console.log("Resumen Telemetría:", events);
    }
}

simulatePipeline();
