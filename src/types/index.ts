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

