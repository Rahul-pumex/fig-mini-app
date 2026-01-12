// Basic types for mini app

export interface AdminFlowAgentState {
    threadId?: string;
    kg?: {
        nodes: any[];
        edges: any[];
    };
    logs?: any[];
    topics?: any[];
    messages?: any[];
    charts?: any[];
    texts?: any[];
    executionId?: string;
    // Client-specific render payloads (new architecture)
    client_type?: "web" | "spreadsheet" | "figma" | string;
    render_web?: WebRenderPayload[];  // List with message_id for per-message filtering
    render_spreadsheet?: SpreadsheetRenderPayload;
}

export interface ChatBoxContentProps {
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
    onCollapseChange?: (collapsed: boolean) => void;
}

export type LayoutType = "side-by-side" | "chat-only" | "canvas-only";

export interface UploadedFile {
    name: string;
    type: string;
    size: number;
    url?: string;
    data?: string;
}

export interface CustomChatInputProps {
    onSubmitMessage?: (message: string) => void;
    onSend?: (message: string) => void;
    onSubmit?: (message: string) => void;
    placeholder?: string;
    disabled?: boolean;
    isGenerating?: boolean;
    onStop?: () => void;
}

export interface MetricOption {
    id: string;
    label: string;
    icon: React.ReactNode;
}

export interface CustomAttachmentUIProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (option: MetricOption) => void;
}

export interface Chart {
    id?: string;
    name?: string;
    title?: string;
    sql?: string;
    query?: string;
    [key: string]: any;
}

// ============================================================================
// Client-specific render payloads (new architecture)
// These come from state.render_web / state.render_spreadsheet
// AIMessage.content stays as human-readable markdown
// ============================================================================

export interface TileSpec {
    tile_id: string;
    label: string;
    value: string;
    delta?: string;
    delta_direction?: "up" | "down" | "neutral";
    subtitle?: string;
}

export interface NextAction {
    action_id: string;
    label: string;
    prompt: string;
    intent_hint?: string;
}

export interface InsightSpec {
    insight_id: string;
    title: string;
    body: string;
    importance?: "high" | "medium" | "low";
}

export interface BlockSpec {
    block_id: string;
    type?: "table" | "text" | "chart";  // New format
    block_type?: "table" | "text" | "chart";  // Legacy format (backend sends this)
    title?: string;
    content?: {
        columns?: Array<{ key: string; label?: string }>;
        rows?: Array<Record<string, unknown>>;
        text?: string;
    };
}

export interface EvidenceTab {
    tab_id: string;
    label: string;
    content: string | any;
    content_type?: string;
}

export interface AuditItem {
    timestamp?: string;
    content: string;
    metadata?: any;
}

export interface WebRenderPayload {
    title?: string;
    subtitle?: string;
    context_chips?: string[];
    tiles: TileSpec[];
    blocks: BlockSpec[];
    insights: InsightSpec[];
    evidence_tabs: EvidenceTab[];
    audit_trail: AuditItem[];
    next_actions: NextAction[];
    tables_used?: string[];
    intent?: string;
    generated_at?: string;
    message_id?: string;  // Associates payload with a specific user message/turn
}

export interface ChartSpec {
    chart_id?: string;
    message_id?: string;
    type?: string;
    title?: string;
    sql?: string;
    query?: string;
    [key: string]: any;
}

export interface TextSpec {
    text_id?: string;
    message_id?: string;
    content?: string;
    [key: string]: any;
}

// ============================================================================
// Spreadsheet Mode Types
// ============================================================================

export interface MarkdownTable {
    table_id: string;
    title?: string;
    markdown: string;
    sql?: string;
    row_count?: number;
}

export interface SpreadsheetRenderPayload {
    tables: MarkdownTable[];
    summary?: string;
    generated_at?: string;
}

// ============================================================================
// Structured Message Types (Legacy format)
// ============================================================================

export interface StructuredMessage {
    contract_version?: string;
    intent: string;
    title: string;
    subtitle?: string;
    blocks: any[];
    next_actions?: NextAction[];
    [key: string]: any;
}

