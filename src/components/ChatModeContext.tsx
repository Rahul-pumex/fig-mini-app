import { createContext, useContext, useState, useMemo } from "react";

type ChatMode = "brain" | "search" | "brain-viz" | "brain-viz-chart";

interface ChatModeContextType {
    mode: ChatMode;
    setMode: (m: ChatMode) => void;
}

const ChatModeContext = createContext<ChatModeContextType | undefined>(undefined);

export const ChatModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<ChatMode>("brain");
    const value = useMemo(() => ({ mode, setMode }), [mode]);
    return <ChatModeContext.Provider value={value}>{children}</ChatModeContext.Provider>;
};

export const useChatMode = (): ChatModeContextType => {
    const context = useContext(ChatModeContext);
    if (!context) {
        throw new Error("useChatMode must be used within ChatModeProvider");
    }
    return context;
};
