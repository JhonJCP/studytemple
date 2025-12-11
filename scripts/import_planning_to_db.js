/**
 * Script para importar el planning actual a Supabase
 * Uso: node scripts/import_planning_to_db.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function importPlanning() {
    // Leer planning desde archivo
    const planningPath = path.join(__dirname, '..', '..', 'Temario', 'Planing.txt');
    const planningContent = fs.readFileSync(planningPath, 'utf-8');
    const planning = JSON.parse(planningContent);
    
    console.log('Planning loaded:');
    console.log('- Topics:', planning.topic_time_estimates?.length || 0);
    console.log('- Schedule entries:', planning.daily_schedule?.length || 0);
    
    // Conectar a Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('Error: SUPABASE credentials not found in env');
        process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Obtener usuario actual (asume que hay sesión activa)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
        console.error('Error: User not authenticated');
        console.error('Please run this script with valid auth or specify user_id manually');
        process.exit(1);
    }
    
    console.log('\nUser ID:', user.id);
    
    // Desactivar planning anterior si existe
    await supabase
        .from('user_planning')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);
    
    // Insertar nuevo planning
    const { data, error } = await supabase
        .from('user_planning')
        .insert({
            user_id: user.id,
            strategic_analysis: planning.strategic_analysis,
            topic_time_estimates: planning.topic_time_estimates,
            daily_schedule: planning.daily_schedule,
            generated_by: 'import',
            is_active: true
        })
        .select()
        .single();
    
    if (error) {
        console.error('\nError inserting planning:', error);
        process.exit(1);
    }
    
    console.log('\n✓ Planning imported successfully!');
    console.log('ID:', data.id);
    console.log('Version:', data.version);
    console.log('Created at:', data.created_at);
}

importPlanning().catch(console.error);

