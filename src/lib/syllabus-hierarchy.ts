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
    return getAllTopicsWithGroups().find(t => t.id === topicId);
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

/**
 * Genera una estructura jerárquica base para un tema
 * Esta estructura será poblada por el orquestador de agentes
 */
export function generateBaseHierarchy(topic: TopicWithGroup): TopicSection[] {
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
