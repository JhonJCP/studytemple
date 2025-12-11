-- ============================================
-- USER PLANNING - Planning dinámico por usuario
-- ============================================

-- Tabla para guardar el planning generado por Cortez
CREATE TABLE IF NOT EXISTS user_planning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Planning data (JSON completo)
    strategic_analysis TEXT,
    topic_time_estimates JSONB NOT NULL DEFAULT '[]'::jsonb,
    daily_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Metadata
    generated_by TEXT DEFAULT 'cortez', -- 'cortez' | 'manual' | 'import'
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Solo un planning activo por usuario
    CONSTRAINT one_active_per_user UNIQUE (user_id, is_active)
);

-- Índices
CREATE INDEX idx_user_planning_user_id ON user_planning(user_id);
CREATE INDEX idx_user_planning_active ON user_planning(user_id, is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE user_planning ENABLE ROW LEVEL SECURITY;

-- Usuario solo puede ver su propio planning
CREATE POLICY "Users can view own planning"
ON user_planning FOR SELECT
USING (auth.uid() = user_id);

-- Usuario puede insertar su propio planning
CREATE POLICY "Users can insert own planning"
ON user_planning FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Usuario puede actualizar su propio planning
CREATE POLICY "Users can update own planning"
ON user_planning FOR UPDATE
USING (auth.uid() = user_id);

-- Usuario puede eliminar su propio planning
CREATE POLICY "Users can delete own planning"
ON user_planning FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_user_planning_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_planning_updated_at
    BEFORE UPDATE ON user_planning
    FOR EACH ROW
    EXECUTE FUNCTION update_user_planning_updated_at();

-- Comentarios
COMMENT ON TABLE user_planning IS 'Planning dinámico generado por Cortez o importado manualmente';
COMMENT ON COLUMN user_planning.topic_time_estimates IS 'Array de objetos TopicTimeEstimate';
COMMENT ON COLUMN user_planning.daily_schedule IS 'Array de objetos DailyScheduleEntry';

