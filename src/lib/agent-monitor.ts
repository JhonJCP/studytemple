export interface AgentLog {
    id: string;
    agentName: "Bibliotecario" | "Auditor BOE" | "Estratega" | "Optimizador Tiempo" | "Orquestador Examen";
    timestamp: Date;
    action: string;
    promptUsed: string; // The raw prompt sent to LLM
    output: string;     // The raw answer
    status: "success" | "error" | "thinking";
    latencyMs: number;
}

class AgentMonitorService {
    private logs: AgentLog[] = [];
    private listeners: ((log: AgentLog) => void)[] = [];

    log(agentName: AgentLog["agentName"], action: string, prompt: string, output: string, latency: number) {
        const newLog: AgentLog = {
            id: Math.random().toString(36).substring(7),
            agentName,
            timestamp: new Date(),
            action,
            promptUsed: prompt,
            output,
            status: "success",
            latencyMs: latency
        };

        // In a real app, save to Supabase "system_logs" table.
        // For now, in-memory for the session (and redundant console log)
        this.logs.unshift(newLog);
        console.log(`[BRAIN] ${agentName}: ${action}`);

        this.notify(newLog);
    }

    getRecentLogs(): AgentLog[] {
        return this.logs;
    }

    subscribe(callback: (log: AgentLog) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notify(log: AgentLog) {
        this.listeners.forEach(l => l(log));
    }
}

export const agentMonitor = new AgentMonitorService();
