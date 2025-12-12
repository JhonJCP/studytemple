# 🧪 Guía de Testing - Sistema Multi-Agente V2

## Pre-requisitos

✅ Build local exitoso (`npm run build`)  
✅ Código implementado y committeado  
⏸️ **PENDIENTE**: Deploy a Vercel

---

## Paso 1: Deploy a Producción

### Comandos

```bash
cd studytemple

# Ver estado actual
git status

# Añadir archivos nuevos
git add .

# Commit con mensaje descriptivo
git commit -m "feat: arquitectura multi-agente paralela v2

- Sistema paralelo: 3 expertos (Teórico, Práctico, Técnico)
- Global Planner lee planning real (Planing.txt)
- Curator con scoring basado en supuestos PRACTICE
- Strategist sintetiza con enfoque en parte práctica
- UI con practice metrics (readiness, fórmulas, supuestos)
- Queries especializadas por categoría (BOE/PRACTICE/CORE/SUPP)

Esperado: 800-1000 palabras, >90% practice readiness"

# Push (auto-deploy en Vercel)
git push
```

### Verificar Deploy

1. Ir a: https://vercel.com/dashboard
2. Verificar que el deployment está "Ready"
3. Tiempo esperado: 2-3 minutos
4. Verificar que no hay errores en build logs

---

## Paso 2: Test E2E #1 - Ley de Carreteras

### Objetivo

Verificar que tema de alta complejidad con RAG abundante genera contenido completo.

### Procedimiento

1. **Navegar a**: `https://tu-dominio.vercel.app/study/2025-12-15/carreteras-ley`

2. **Activar** "Ver proceso IA" (toggle superior)

3. **Click** "Generar Temario"

4. **Observar en tiempo real**:
   - [ ] **Planificador Global** (10s):
     - ✅ Aparece en UI con estado "running"
     - ✅ Reasoning menciona "90 min asignados"
     - ✅ Muestra "Frecuencia en supuestos: 8/15 (53%)"
   
   - [ ] **3 Expertos en PARALELO** (90s):
     - ✅ Los 3 aparecen "running" simultáneamente
     - ✅ Experto Teórico: "Buscando en CORE..."
     - ✅ Experto Práctico: "Analizando PRACTICE..."
     - ✅ Experto Técnico: "Consultando CORE+SUPP..."
     - ✅ Los 3 completan aproximadamente al mismo tiempo (±10s)
   
   - [ ] **Curator** (30s):
     - ✅ Reasoning muestra "X críticos, Y prescindibles"
     - ✅ Practice readiness >85%
   
   - [ ] **Strategist** (120s):
     - ✅ Reasoning menciona "Sintetizando X palabras"
     - ✅ Completa en 100-150s

5. **Verificar contenido final**:

   - [ ] **Palabras totales**: 800-1000 ✅
   - [ ] **Secciones**: 4-5 estructuradas ✅
   - [ ] **Practice Ready**: >90% (verde) ✅
   - [ ] **Conceptos de supuestos**: >15 ✅
   - [ ] **Fórmulas**: >4 ✅
   - [ ] **Aparece en**: Lista supuestos 1, 11, 13, 14 ✅

6. **Revisar Vercel Logs**:

```
Filtrar por: /api/generate-topic-stream

Buscar:
[GENERATOR-V2] Strategic plan: { time: 90, strategy: 'detailed', targetWords: 1000, practiceRelevance: 0.53 }
[EXPERT-TEORICO] Found 45 CORE chunks
[EXPERT-PRACTICAL] Found 28 practice chunks
[EXPERT-TECNICO] Found 32 CORE+SUPP chunks
[CURATOR] Analysis complete: { critical: 18, droppable: 5, practiceReadiness: 0.91 }
[STRATEGIST] Synthesis complete: { finalWords: 920, practiceReadiness: 0.94 }
```

### Criterios de Éxito

- ✅ Duración total: 3-5 minutos (acceptable)
- ✅ Palabras: 800-1000 (vs 203-574 en V1)
- ✅ Practice readiness: >90%
- ✅ Sin errores en logs
- ✅ UI muestra progress de todos los agentes
- ✅ Footer muestra métricas practice correctamente

---

## Paso 3: Test E2E #2 - Trazado (Tema Técnico)

### Objetivo

Verificar tema con muchos cálculos y fórmulas.

### Procedimiento

1. **Navegar a**: `/study/2025-12-16/trazado-31ic`

2. **Generar temario** (con "Ver proceso IA" activo)

3. **Verificar específicamente**:
   - [ ] Experto Técnico encuentra ROMs y normas IC en SUPPLEMENTARY
   - [ ] Curator identifica fórmulas como CRÍTICAS
   - [ ] Contenido final incluye:
     - [ ] Fórmulas de radios mínimos
     - [ ] Parámetros límite (pendientes, acuerdos verticales)
     - [ ] Ejemplos numéricos resueltos
     - [ ] Referencias a Norma 3.1-IC

4. **Métricas esperadas**:
   - Palabras: 900-1000 (High complexity)
   - Fórmulas: >6
   - Practice readiness: >85% (tema técnico)

---

## Paso 4: Test E2E #3 - Supuesto Práctico

### Objetivo

Verificar generación de contenido para supuestos prácticos.

### Procedimiento

1. **Navegar a**: `/study/2025-12-27/supuesto-03` o cualquier supuesto

2. **Generar temario**

3. **Verificar específicamente**:
   - [ ] Experto Práctico debe ser el que más peso tiene (40% de palabras)
   - [ ] Contenido incluye:
     - [ ] Estructura de solución paso a paso
     - [ ] Normativa aplicable específica
     - [ ] Errores comunes a evitar
     - [ ] Ejemplo resuelto condensado
   
4. **Métricas esperadas**:
   - Practice readiness: >95% (es un supuesto, 100% práctico)
   - Contenido debe ser guía de resolución, no teoría

---

## Paso 5: Verificación Global

### Temas a Probar (5 representativos)

1. **Ley de Carreteras** (High, legal, 90 min)
   - Espera: 1000 palabras, >90% readiness
   
2. **Trazado 3.1-IC** (High, técnico, 90 min)
   - Espera: 950 palabras, >85% readiness, >6 fórmulas
   
3. **Firmes/PG-3** (High, mixto, 100 min)
   - Espera: 1000 palabras, >90% readiness
   
4. **Obras de Paso** (Medium, 80 min)
   - Espera: 700 palabras, >85% readiness
   
5. **Supuesto 03** (supuesto práctico, 80 min)
   - Espera: 700 palabras, >95% readiness

### Checklist por Tema

- [ ] Tiempo de generación: 3-5 min
- [ ] Palabras generadas: según planning (700-1000)
- [ ] Practice readiness: >85%
- [ ] Conceptos críticos: >12
- [ ] Sin errores en consola
- [ ] Footer muestra métricas correctamente

---

## Debugging

### Si Practice Readiness <85%

1. **Ver logs del Curator**:
   ```
   [CURATOR] Analysis complete: { critical: X, droppable: Y, practiceReadiness: Z }
   ```
   
2. **Verificar**:
   - ¿Encontró suficientes PRACTICE chunks?
   - ¿Scoring de conceptos es correcto?
   - ¿Strategist está eliminando conceptos críticos por error?

3. **Ajuste**:
   - Modificar pesos en `expert-curator.ts` (línea del prompt)
   - Aumentar palabras de Experto Práctico

### Si Palabras <800

1. **Ver logs de Expertos**:
   ```
   [EXPERT-TEORICO] Generated X words
   [EXPERT-PRACTICAL] Generated Y words
   [EXPERT-TECNICO] Generated Z words
   ```

2. **Verificar suma**: X + Y + Z debería ser ~850

3. **Si un experto genera poco**:
   - Revisar query RAG (puede no estar encontrando docs)
   - Aumentar targetWords para ese experto
   - Verificar que el modelo no está timeouteando

### Si Falla Completamente

1. **Revisar API Key**: Debe estar en `GEMINI_API_KEY` (server-side)

2. **Verificar Supabase**: Categorías BOE/PRACTICE/CORE/SUPPLEMENTARY existen

3. **Rollback temporal**: 
   - Cambiar import en `route.ts` de V2 a V1
   - Re-deploy
   - V1 seguirá funcionando como backup

---

## Métricas de Éxito

### Sistema Funciona Correctamente Si:

✅ **Todos los temas** generan >800 palabras  
✅ **Practice readiness promedio** >88%  
✅ **Sin errores** en 5/5 temas probados  
✅ **UI muestra métricas** correctamente  
✅ **Duración** 3-5 min por tema (acceptable)  
✅ **Contenido enfocado** en supuestos prácticos  

### Sistema Necesita Ajustes Si:

⚠️ Practice readiness <85% → Ajustar prompts  
⚠️ Palabras <700 → Aumentar targetWords  
⚠️ Expertos tardan >180s → Revisar timeouts  
⚠️ Contenido genérico → Mejorar queries RAG  

---

**📝 Registrar resultados en master plan (Sección 29) después de las pruebas**



