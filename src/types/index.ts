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

