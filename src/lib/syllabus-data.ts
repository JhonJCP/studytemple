export interface Topic {
    id: string;
    title: string;
    zoneId: string;
    fileReference?: string;
}

export const SYLLABUS_DATA: Topic[] = [
    // ZONE A: CARRETERAS
    { id: "a1", zoneId: "A", title: "Ley de Carreteras de Canarias", fileReference: "Ley 9-1991.pdf" },
    { id: "a2", zoneId: "A", title: "Reglamento de Carreteras", fileReference: "Decreto 131-1995.pdf" },
    { id: "a3", zoneId: "A", title: "Trazado (3.1-IC)", fileReference: "Trazado.pdf" },
    { id: "a4", zoneId: "A", title: "Firmes y Pavimentos", fileReference: "Firmes.pdf" },
    { id: "a5", zoneId: "A", title: "Drenaje Superficial y Subterráneo", fileReference: "Drenaje.pdf" },

    // ZONE B: AGUAS
    { id: "b1", zoneId: "B", title: "Ley de Aguas (Texto Refundido)", fileReference: "TR Ley Aguas.pdf" },
    { id: "b2", zoneId: "B", title: "Reglamento DPH Canarias", fileReference: "Reglamento DPH.pdf" },

    // ZONE F: PRÁCTICA (WORKSHOP)
    { id: "f1", zoneId: "F", title: "El Informe Administrativo", fileReference: "El informe administrativo.pdf" },
    { id: "f2", zoneId: "F", title: "La Propuesta de Resolución", fileReference: "La propuesta de resolución.pdf" },
    { id: "f3", zoneId: "F", title: "Supuestos Prácticos 1-15", fileReference: "Supuestos.pdf" },
];

export function getTopicsByZone(zoneId: string) {
    return SYLLABUS_DATA.filter(t => t.zoneId === zoneId);
}
