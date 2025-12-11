/**
 * SYLLABUS HIERARCHY - Parser de Estructura Jerárquica
 * 
 * Convierte smart-syllabus.json en una estructura navegable
 * y genera jerarquías para los temas.
 */

import smartSyllabus from './smart-syllabus.json';
import type { TopicSection, SectionLevel } from './widget-types';

// ============================================
// TIPOS INTERNOS
// ============================================

export interface SyllabusGroup {
    title: string;
    icon: string;
    description: string;
    topics: SyllabusTopic[];
}

export interface SyllabusTopic {
    title: string;
    originalFilename: string;
}

export interface TopicWithGroup extends SyllabusTopic {
    groupTitle: string;
    groupIndex: number;
    topicIndex: number;
    id: string;
}

// ============================================
// FUNCIONES DE ACCESO
// ============================================

/**
 * Obtiene todos los grupos del syllabus
 */
export function getAllGroups(): SyllabusGroup[] {
    return smartSyllabus.groups as SyllabusGroup[];
}

/**
 * Obtiene un grupo por índice
 */
export function getGroupByIndex(index: number): SyllabusGroup | undefined {
    return smartSyllabus.groups[index] as SyllabusGroup | undefined;
}

/**
 * Obtiene todos los temas con metadata de grupo
 */
export function getAllTopicsWithGroups(): TopicWithGroup[] {
    const result: TopicWithGroup[] = [];

    (smartSyllabus.groups as SyllabusGroup[]).forEach((group, groupIndex) => {
        group.topics.forEach((topic, topicIndex) => {
            result.push({
                ...topic,
                groupTitle: group.title,
                groupIndex,
                topicIndex,
                id: generateTopicId(groupIndex, topicIndex),
            });
        });
    });

    return result;
}

/**
 * Busca un tema por su ID
 */
export function getTopicById(topicId: string): TopicWithGroup | undefined {
    const allTopics = getAllTopicsWithGroups();
    // Try strict ID match
    const byId = allTopics.find(t => t.id === topicId);
    if (byId) return byId;

    // Fallback: Try matching originalFilename (URL decoded)
    // Normalize: strip extension, decode, and compare also against titles/slugs.
    const normalize = (s: string) => {
        const decoded = decodeURIComponent(s || "").trim();
        const withoutExt = decoded.replace(/\.[A-Za-z0-9]+$/, "");
        return withoutExt.toLowerCase();
    };
    const normalizedId = normalize(topicId);

    const slugify = (s: string) =>
        s.toLowerCase()
            .replace(/\.[A-Za-z0-9]+$/, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

    const loose = (s: string) =>
        s.toLowerCase()
            .replace(/\.[A-Za-z0-9]+$/, "")
            .replace(/[^a-z0-9]/g, ""); // remove all non-alnum for loose match

    const tokens = (s: string) =>
        slugify(s)
            .split("-")
            .filter(Boolean);

    try {
        return allTopics.find(t => {
            const normalizedOriginal = normalize(t.originalFilename);
            const normalizedTitle = normalize(t.title);
            const slugOriginal = slugify(normalizedOriginal);
            const slugTitle = slugify(normalizedTitle);
            const looseOriginal = loose(normalizedOriginal);
            const looseTitle = loose(normalizedTitle);
            const looseId = loose(normalizedId);
            const slugId = slugify(normalizedId);
            const idTokens = tokens(normalizedId);
            const titleTokens = tokens(normalizedTitle);
            return (
                normalizedOriginal === normalizedId ||
                normalizedTitle === normalizedId ||
                slugOriginal === slugId ||
                slugTitle === slugId ||
                looseOriginal === looseId ||
                looseTitle === looseId ||
                looseId.includes(looseTitle) ||
                looseTitle.includes(looseId) ||
                // token subset match (e.g., "carreteras-ley" vs "ley-de-carreteras-..."):
                (idTokens.length > 0 && idTokens.every(tok => slugTitle.includes(tok))) ||
                (idTokens.length > 0 && idTokens.every(tok => slugOriginal.includes(tok))) ||
                (titleTokens.length > 0 && titleTokens.every(tok => slugId.includes(tok)))
            );
        });
    } catch {
        return undefined;
    }
}

/**
 * Obtiene temas de un grupo específico
 */
export function getTopicsByGroupIndex(groupIndex: number): TopicWithGroup[] {
    const group = getGroupByIndex(groupIndex);
    if (!group) return [];

    return group.topics.map((topic, topicIndex) => ({
        ...topic,
        groupTitle: group.title,
        groupIndex,
        topicIndex,
        id: generateTopicId(groupIndex, topicIndex),
    }));
}

// ============================================
// GENERADOR DE IDs
// ============================================

/**
 * Genera un ID único para un tema basado en grupo e índice
 */
export function generateTopicId(groupIndex: number, topicIndex: number): string {
    return `g${groupIndex}-t${topicIndex}`;
}

/**
 * Parsea un ID de tema para obtener grupo e índice
 */
export function parseTopicId(topicId: string): { groupIndex: number; topicIndex: number } | null {
    const match = topicId.match(/^g(\d+)-t(\d+)$/);
    if (!match) return null;
    return {
        groupIndex: parseInt(match[1], 10),
        topicIndex: parseInt(match[2], 10),
    };
}

// ============================================
// GENERADOR DE JERARQUÍA
// ============================================

const slugify = (str: string) =>
    (str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

/**
 * Genera una estructura jerárquica base para un tema
 * Esta estructura será poblada por el orquestador de agentes
 */
export function generateBaseHierarchy(topic: TopicWithGroup): TopicSection[] {
    const slug = slugify(`${topic.originalFilename} ${topic.title}`);
    const isLeyCarreterasCanarias =
        slug.includes("ley-9-1991") ||
        slug.includes("carreteras-de-canarias");

    if (isLeyCarreterasCanarias) {
        const lawRoot: TopicSection = {
            id: `${topic.id}-ley-9-1991`,
            title: "Ley 9/1991 de Carreteras de Canarias",
            level: 'h1',
            sourceType: 'library',
            content: { text: '', widgets: [] },
            children: [
                {
                    id: `${topic.id}-t1`,
                    title: "Título I · Disposiciones Generales (arts. 1-11)",
                    level: 'h2',
                    sourceType: 'library',
                    content: { text: '', widgets: [] },
                    children: [
                        { id: `${topic.id}-t1-def`, title: "Objeto, definiciones y clasificación", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } },
                        { id: `${topic.id}-t1-comp`, title: "Competencias: CA, Cabildos y Ayuntamientos", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } },
                        { id: `${topic.id}-t1-catalogo`, title: "Catálogo y señalización", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } }
                    ]
                },
                {
                    id: `${topic.id}-t2`,
                    title: "Título II · Planificación, proyectos y financiación (arts. 12-23)",
                    level: 'h2',
                    sourceType: 'library',
                    content: { text: '', widgets: [] },
                    children: [
                        { id: `${topic.id}-t2-plan`, title: "Plan Regional de Carreteras y estudios", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } },
                        { id: `${topic.id}-t2-construccion`, title: "Construcción y coordinación urbanística", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } },
                        { id: `${topic.id}-t2-financiacion`, title: "Financiación y contribuciones especiales", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } },
                        { id: `${topic.id}-t2-explotacion`, title: "Explotación y áreas de servicio", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } }
                    ]
                },
                {
                    id: `${topic.id}-t3`,
                    title: "Título III · Uso y defensa de la carretera (arts. 24-43)",
                    level: 'h2',
                    sourceType: 'library',
                    content: { text: '', widgets: [] },
                    children: [
                        { id: `${topic.id}-t3-limit`, title: "Zonas: dominio público, servidumbre, afección y edificación", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } },
                        { id: `${topic.id}-t3-uso`, title: "Uso de la vía, publicidad y accesos", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } },
                        { id: `${topic.id}-t3-sanciones`, title: "Infracciones y sanciones", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } }
                    ]
                },
                {
                    id: `${topic.id}-t4`,
                    title: "Título IV · Redes arteriales y tramos urbanos (arts. 44-51)",
                    level: 'h2',
                    sourceType: 'library',
                    content: { text: '', widgets: [] },
                    children: [
                        { id: `${topic.id}-t4-coord`, title: "Coordinación con planeamiento urbano y licencias", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } },
                        { id: `${topic.id}-t4-financia`, title: "Financiación y conservación en tramos urbanos", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } }
                    ]
                },
                {
                    id: `${topic.id}-disp`,
                    title: "Disposición adicional, transitorias y final",
                    level: 'h2',
                    sourceType: 'library',
                    content: { text: '', widgets: [] },
                    children: [
                        { id: `${topic.id}-disp-adic`, title: "Disposición adicional", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } },
                        { id: `${topic.id}-disp-trans`, title: "Disposiciones transitorias", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } },
                        { id: `${topic.id}-disp-final`, title: "Disposición final", level: 'h3', sourceType: 'library', content: { text: '', widgets: [] } }
                    ]
                },
                {
                    id: `${topic.id}-practica`,
                    title: "Aplicación práctica · informes y propuestas de resolución",
                    level: 'h2',
                    sourceType: 'augmented',
                    content: { text: '', widgets: [] }
                }
            ]
        };

        return [lawRoot];
    }

    // Estructura base que será expandida por Librarian
    const baseSection: TopicSection = {
        id: `${topic.id}-intro`,
        title: topic.title,
        level: 'h1',
        sourceType: 'library',
        content: {
            text: '', // Será generado
            widgets: [],
        },
        children: [
            {
                id: `${topic.id}-overview`,
                title: 'Visión General',
                level: 'h2',
                sourceType: 'library',
                content: {
                    text: '',
                    widgets: [],
                },
            },
            {
                id: `${topic.id}-concepts`,
                title: 'Conceptos Clave',
                level: 'h2',
                sourceType: 'mixed',
                content: {
                    text: '',
                    widgets: [],
                },
            },
            {
                id: `${topic.id}-details`,
                title: 'Desarrollo del Contenido',
                level: 'h2',
                sourceType: 'library',
                content: {
                    text: '',
                    widgets: [],
                },
            },
            {
                id: `${topic.id}-practice`,
                title: 'Aplicación Práctica',
                level: 'h2',
                sourceType: 'augmented',
                content: {
                    text: '',
                    widgets: [],
                },
            },
        ],
    };

    return [baseSection];
}

// ============================================
// UTILIDADES DE NAVEGACIÓN
// ============================================

/**
 * Aplana una jerarquía de secciones para búsqueda
 */
export function flattenSections(sections: TopicSection[]): TopicSection[] {
    const result: TopicSection[] = [];

    function traverse(section: TopicSection) {
        result.push(section);
        section.children?.forEach(traverse);
    }

    sections.forEach(traverse);
    return result;
}

/**
 * Encuentra una sección por ID en una jerarquía
 */
export function findSectionById(sections: TopicSection[], sectionId: string): TopicSection | undefined {
    return flattenSections(sections).find(s => s.id === sectionId);
}

/**
 * Cuenta el total de secciones en una jerarquía
 */
export function countSections(sections: TopicSection[]): number {
    return flattenSections(sections).length;
}

/**
 * Calcula el progreso de generación (secciones con contenido)
 */
export function calculateGenerationProgress(sections: TopicSection[]): number {
    const all = flattenSections(sections);
    const withContent = all.filter(s => s.content.text.length > 0);
    return all.length > 0 ? withContent.length / all.length : 0;
}
