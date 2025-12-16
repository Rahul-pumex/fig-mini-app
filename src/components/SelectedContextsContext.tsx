import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface SelectedContext {
    id: string;
    type: string;
    label: string;
    name?: string;
    body?: string;
    metadata?: any;
}

interface SelectedContextsContextType {
    selectedContexts: SelectedContext[];
    setSelectedContexts: (contexts: SelectedContext[]) => void;
    clearContexts: () => void;
    removeContext: (id: string) => void;
}

const SelectedContextsContext = createContext<SelectedContextsContextType | undefined>(undefined);

export const SelectedContextsProvider = ({ children }: { children: ReactNode }) => {
    const [selectedContexts, setSelectedContexts] = useState<SelectedContext[]>([]);

    const clearContexts = () => {
        setSelectedContexts([]);
    };

    const removeContext = (id: string) => {
        setSelectedContexts(prev => prev.filter(context => context.id !== id));
    };

    return (
        <SelectedContextsContext.Provider
            value={{ selectedContexts, setSelectedContexts, clearContexts, removeContext }}
        >
            {children}
        </SelectedContextsContext.Provider>
    );
};

export const useSelectedContexts = () => {
    const context = useContext(SelectedContextsContext);
    if (!context) {
        throw new Error('useSelectedContexts must be used within SelectedContextsProvider');
    }
    return context;
};
