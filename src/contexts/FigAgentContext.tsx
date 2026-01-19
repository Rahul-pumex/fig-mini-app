import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { AdminFlowAgentState } from '../types';
import { AuthService } from '../utils/auth/authService';

type ThreadItem = {
    thread_id: string;
    description?: string;
};

interface FigAgentContextType {
    threadId: string | undefined;
    setThreadId: (id: string | undefined) => void;
    threadInfo: AdminFlowAgentState | null;
    setThread: (data: AdminFlowAgentState) => void;
    fetchThreads: () => Promise<void>;
    thread_list: ThreadItem[];
    thread_list_status: 'IDLE' | 'LOADING' | 'SUCCESS' | 'FAILED';
    delete_thread: null;
}

const FigAgentContext = createContext<FigAgentContextType | undefined>(undefined);

export const FigAgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [threadId, setThreadIdState] = useState<string | undefined>();
    const [threadInfo, setThreadInfo] = useState<AdminFlowAgentState | null>(null);
    const [threadList, setThreadList] = useState<ThreadItem[]>([]);
    const [threadListStatus, setThreadListStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'FAILED'>('IDLE');

    const setThreadId = useCallback((id: string | undefined) => {
        setThreadIdState(id);
    }, []);

    const setThread = useCallback((data: AdminFlowAgentState) => {
        setThreadInfo(data);
    }, []);

    const fetchThreads = useCallback(async () => {
        if (threadListStatus === 'LOADING') return;
        try {
            setThreadListStatus('LOADING');
            const accessToken = AuthService.getAccessToken();
            const sessionId = AuthService.getSessionId();

            const res = await fetch('/api/threads', {
                method: 'GET',
                headers: {
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                    ...(sessionId ? { 'x-session_id': sessionId } : {})
                },
                credentials: 'include'
            });

            if (!res.ok) {
                setThreadListStatus('FAILED');
                return;
            }
            const data = await res.json();
            setThreadList(Array.isArray(data) ? data : []);
            setThreadListStatus('SUCCESS');
        } catch (e) {
            setThreadListStatus('FAILED');
        }
    }, [threadListStatus]);

    const value = useMemo(() => ({
        threadId,
        setThreadId,
        threadInfo,
        setThread,
        fetchThreads,
        thread_list: threadList,
        thread_list_status: threadListStatus,
        delete_thread: null
    }), [threadId, threadInfo, threadList, threadListStatus, setThreadId, setThread, fetchThreads]);

    return <FigAgentContext.Provider value={value}>{children}</FigAgentContext.Provider>;
};

export const useFigAgent = (): FigAgentContextType => {
    const context = useContext(FigAgentContext);
    if (context === undefined) {
        console.warn('useFigAgent called outside FigAgentProvider, returning safe defaults');
        // Return safe defaults to prevent hooks errors during unmount/auth redirect
        return {
            threadId: undefined,
            setThreadId: () => {},
            threadInfo: null,
            setThread: () => {},
            fetchThreads: async () => {},
            thread_list: [],
            thread_list_status: 'IDLE',
            delete_thread: null
        };
    }
    return context;
};

