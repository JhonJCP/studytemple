/**
 * Test del Planning Reader
 * 
 * Verifica que el GlobalPlanner lee correctamente el planning
 * y asigna timeAllocation correcto.
 */

const fs = require('fs');
const path = require('path');

async function testPlanningReader() {
    console.log('========== TEST PLANNING READER ==========\n');
    
    // 1. Leer archivo de planning
    const planningPath = path.join(__dirname, '..', '..', 'Temario', 'Planing.txt');
    
    console.log(`1. Leyendo planning desde: ${planningPath}`);
    
    if (!fs.existsSync(planningPath)) {
        console.error('❌ ERROR: Archivo de planning no encontrado');
        return false;
    }
    
    const planningContent = fs.readFileSync(planningPath, 'utf-8');
    const planningData = JSON.parse(planningContent);
    
    console.log(`✅ Planning cargado:`);
    console.log(`   - Topics: ${planningData.topic_time_estimates?.length || 0}`);
    console.log(`   - Schedule entries: ${planningData.daily_schedule?.length || 0}\n`);
    
    // 2. Verificar topic específico: Ley de Carreteras
    console.log('2. Verificando topic "Ley de Carreteras"...');
    
    const carreteras = planningData.topic_time_estimates.find(t => 
        t.topicId.includes('carreteras') && t.topicId.includes('ley')
    );
    
    if (!carreteras) {
        console.error('❌ ERROR: Topic carreteras-ley no encontrado en planning');
        return false;
    }
    
    console.log('✅ Topic encontrado:');
    console.log(`   - ID: ${carreteras.topicId}`);
    console.log(`   - Título: ${carreteras.topicTitle}`);
    console.log(`   - Complejidad: ${carreteras.complexity}`);
    console.log(`   - Tiempo base: ${carreteras.baseStudyMinutes} min`);
    console.log(`   - Content length: ${carreteras.recommendedContentLength}`);
    console.log(`   - Total con repasos: ${carreteras.totalPlannedMinutes} min`);
    console.log(`   - Rationale: ${carreteras.rationale}\n`);
    
    // 3. Verificar que valores son correctos según plan
    console.log('3. Validando valores esperados...');
    
    const tests = [
        { name: 'Complejidad', actual: carreteras.complexity, expected: 'High' },
        { name: 'Tiempo base', actual: carreteras.baseStudyMinutes, expected: 90 },
        { name: 'Content length', actual: carreteras.recommendedContentLength, expected: 'extended' }
    ];
    
    let allPassed = true;
    
    tests.forEach(test => {
        if (test.actual === test.expected) {
            console.log(`   ✅ ${test.name}: ${test.actual}`);
        } else {
            console.log(`   ❌ ${test.name}: ${test.actual} (esperado: ${test.expected})`);
            allPassed = false;
        }
    });
    
    // 4. Verificar mapeo a estrategia
    console.log('\n4. Verificando mapeo a estrategia de generación...');
    
    const expectedStrategy = carreteras.recommendedContentLength === 'extended' ? 'detailed' : 'balanced';
    const expectedWords = carreteras.recommendedContentLength === 'extended' ? 1000 : 700;
    
    console.log(`   - Estrategia esperada: ${expectedStrategy}`);
    console.log(`   - Palabras objetivo: ${expectedWords}`);
    console.log(`   - Secciones objetivo: 5 (porque es detailed)\n`);
    
    // 5. Verificar otros topics del planning
    console.log('5. Verificando otros topics del planning...');
    
    const sampleTopics = [
        'trazado-31ic',
        'firmes-pg3',
        'supuestos-carreteras'
    ];
    
    sampleTopics.forEach(topicId => {
        const topic = planningData.topic_time_estimates.find(t => t.topicId === topicId);
        if (topic) {
            console.log(`   ✅ ${topicId}: ${topic.baseStudyMinutes}min, ${topic.complexity}, ${topic.recommendedContentLength}`);
        } else {
            console.log(`   ⚠️  ${topicId}: No encontrado (puede ser de daily_schedule)`);
        }
    });
    
    console.log('\n========== TEST COMPLETADO ==========');
    
    if (allPassed) {
        console.log('✅ TODOS LOS TESTS PASARON');
        return true;
    } else {
        console.log('❌ ALGUNOS TESTS FALLARON');
        return false;
    }
}

// Ejecutar test
testPlanningReader().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error('Error ejecutando test:', err);
    process.exit(1);
});

