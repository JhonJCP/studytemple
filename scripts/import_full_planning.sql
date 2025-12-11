-- SCRIPT para importar el planning completo a la base de datos
-- IMPORTANTE: Ejecutar DESPUÉS de tener el JSON completo preparado

-- Este script inserta o actualiza el planning del usuario
-- Usar el user_id real del usuario autenticado

-- Primero, desactivar plannings anteriores
UPDATE user_planning 
SET is_active = false 
WHERE user_id = 'de62b32b-0a0c-46ca-9e00-c6710d2d79d2' 
AND is_active = true;

-- NOTA: El JSON completo se debe pegar manualmente en Supabase SQL Editor
-- debido al tamaño (>35KB). Usar el siguiente template:

/*
INSERT INTO user_planning (
    user_id,
    strategic_analysis,
    topic_time_estimates,
    daily_schedule,
    generated_by,
    is_active
) VALUES (
    'de62b32b-0a0c-46ca-9e00-c6710d2d79d2'::uuid,
    
    -- strategic_analysis (copiar de Planing.txt campo "strategic_analysis")
    'PASTE_STRATEGIC_ANALYSIS_HERE',
    
    -- topic_time_estimates (copiar array completo de Planing.txt)
    'PASTE_TOPIC_TIME_ESTIMATES_JSON_HERE'::jsonb,
    
    -- daily_schedule (copiar array completo de Planing.txt)
    'PASTE_DAILY_SCHEDULE_JSON_HERE'::jsonb,
    
    'manual',
    true
);
*/

-- Verificar que se insertó correctamente:
SELECT 
    id,
    user_id,
    jsonb_array_length(topic_time_estimates) as topic_count,
    jsonb_array_length(daily_schedule) as schedule_count,
    version,
    is_active,
    created_at
FROM user_planning
WHERE user_id = 'de62b32b-0a0c-46ca-9e00-c6710d2d79d2'
AND is_active = true;

