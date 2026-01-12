import type { StructuredMessage } from "../types";

type ParseResult = { payload: StructuredMessage | null; error?: string; fallbackText?: string };

const stripCodeFence = (raw: string) =>
    raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

const extractCandidate = (raw: string): string | null => {
    const cleaned = stripCodeFence(raw);
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || start > end) return null;

    return cleaned.slice(start, end + 1);
};

export const parseStructuredMessage = (raw: string): ParseResult => {
    if (!raw || typeof raw !== "string") {
        return { payload: null };
    }
    const candidate = extractCandidate(raw);
    if (!candidate) {
        return { payload: null };
    }
    try {
        const parsed = JSON.parse(candidate);
        
        // Basic validation
        if (!parsed || typeof parsed !== "object") {
            return { payload: null, error: "Invalid payload structure" };
        }
        
        if (parsed.contract_version !== "fig.thread.render.v1") {
            return { payload: null, error: `Unsupported contract version: ${parsed.contract_version}` };
        }
        
        if (!parsed.intent || !parsed.title || !Array.isArray(parsed.blocks)) {
            return { payload: null, error: "Missing required fields" };
        }
        
        return { payload: parsed as StructuredMessage };
    } catch (error) {
        console.error('[parseStructuredMessage] JSON parse error:', error);
        return { payload: null, error: `Structured response parsing failed: ${error instanceof Error ? error.message : String(error)}` };
    }
};

export const formatShortDate = (timestamp: string): string => {
    try {
        const date = new Date(timestamp);

        const day = date.getDate().toString().padStart(2, "0");
        const month = date.toLocaleString("en-US", { month: "short" });
        const year = date.getFullYear().toString().slice(-2);

        const hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const isAM = hours < 12;
        const hour12 = hours % 12 === 0 ? 12 : hours % 12;
        const ampm = isAM ? "AM" : "PM";

        return `${day} ${month} ${year}, ${hour12}:${minutes} ${ampm}`;
    } catch (error) {
        return "Invalid date";
    }
};

