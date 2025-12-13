export async function postWidgetGenerate(payload: unknown): Promise<any> {
    const res = await fetch("/api/widgets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        if (res.status === 401) {
            throw new Error("Necesitas iniciar sesión para generar widgets.");
        }
        throw new Error((data as any).error || "Error generando widget");
    }

    return data;
}

