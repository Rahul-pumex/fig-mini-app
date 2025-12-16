import { useState, useCallback } from 'react';
import { AdminFlowAgentState } from '../types';

// Simplified useFigAgent for mini app
export const useFigAgent = () => {
    const [threadId, setThreadIdState] = useState<string | undefined>();
    const [threadInfo, setThreadInfo] = useState<AdminFlowAgentState | null>(null);

    const setThreadId = useCallback((id: string | undefined) => {
        setThreadIdState(id);
    }, []);

    const setThread = useCallback((data: AdminFlowAgentState) => {
        setThreadInfo(data);
    }, []);

    const fetchThreads = useCallback(() => {
        // Simplified - no backend fetching in mini app
        console.log('[useFigAgent] fetchThreads called');
    }, []);

    return {
        threadId,
        setThreadId,
        threadInfo,
        setThread,
        fetchThreads,
        thread_list: [],
        thread_list_status: 'IDLE',
        delete_thread: null
    };
};


