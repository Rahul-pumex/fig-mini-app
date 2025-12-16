import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { AuthService, withAuth, resetAuthState } from "@utils";
import ChatBoxContent from "../../../components/templates/Chat/ChatBoxContent";
import { ChatModeProvider } from "../../../components/ChatModeContext";
import { MessageMappingProvider } from "../../../components/MessageMappingContext";
import { SelectedContextsProvider } from "../../../components/SelectedContextsContext";
import { LucideLogOut, LucideMessageSquarePlus } from "lucide-react";
import { useFigAgent } from "@/hooks/useFigAgent";

function ThreadPage() {
    const router = useRouter();
    const { query } = router;
    const { threadId, setThreadId, setThread } = useFigAgent();
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Update threadId from URL
    useEffect(() => {
        if (query.threadId !== undefined) {
            let id = query.threadId as string;
            if (id === "new") {
                id = "";
            }
            // Only update threadId if it's actually different
            if (id !== threadId) {
                console.log("[ThreadPage] Setting threadId from URL:", id);
                setThreadId(id);
            }
        }
    }, [query.threadId, threadId, setThreadId]);

    const handleLogout = async () => {
        resetAuthState(); // Reset global auth state
        AuthService.clearAllTokens();
        router.replace("/auth");
    };

    const handleNewThread = () => {
        console.log("[ThreadPage] Creating new thread");
        setThreadId("");
        setThread({
            kg: { nodes: [], edges: [] },
            logs: [],
            topics: [],
            messages: [],
            charts: [],
            texts: [],
            executionId: undefined,
            threadId: undefined
        });
        // Use shallow routing to prevent auth re-check
        router.push("/chat/new", undefined, { shallow: true });
    };

    return (
        <SelectedContextsProvider>
            <ChatModeProvider>
                <MessageMappingProvider>
                    <div className="flex h-screen flex-col overflow-hidden bg-white">
                        {/* Header */}
                        <div className="border-b border-gray-200 bg-white shadow-sm">
                            {/* Top Row - Title and Actions */}
                            <div className="flex items-center justify-between ">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-xl font-semibold bg-gradient-to-r from-[#745263] to-[#9B7080] bg-clip-text text-transparent">
                                        Fig Agent
                                    </h1>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleNewThread}
                                        className="group relative flex items-center justify-center p-2 rounded-lg text-[#745263] transition-all hover:bg-[#FAF8F9] active:scale-95"
                                        aria-label="New Thread"
                                    >
                                        <LucideMessageSquarePlus size={22} strokeWidth={2} />
                                        <span className="pointer-events-none absolute -bottom-10 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                            New Thread
                                        </span>
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="group relative flex items-center justify-center p-2 rounded-lg text-gray-600 transition-all hover:bg-red-50 hover:text-red-600 active:scale-95"
                                        aria-label="Logout"
                                    >
                                        <LucideLogOut size={22} strokeWidth={2} />
                                        <span className="pointer-events-none absolute -bottom-10 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                            Logout
                                        </span>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Bottom Row - Thread Info (if exists) */}
                            {threadId && threadId !== "new" && (
                                <div className="border-t border-gray-100 bg-gray-50 px-6 py-2">
                                    <div className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#745263]">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                        </svg>
                                        <span className="text-xs font-medium text-gray-600">Active Thread:</span>
                                        <code className="rounded bg-white px-2 py-0.5 text-xs font-mono text-gray-700 border border-gray-200 shadow-sm">
                                            {threadId.slice(0, 8)}...
                                        </code>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Chat Area - Using the same component from main app */}
                        <div className="flex-1 overflow-hidden bg-gradient-to-b from-white via-[#FDFCFD] to-[#F5F0F3]">
                            <ChatBoxContent
                                isCollapsed={isCollapsed}
                                setIsCollapsed={setIsCollapsed}
                                onCollapseChange={(collapsed) => setIsCollapsed(collapsed)}
                            />
                        </div>
                    </div>
                </MessageMappingProvider>
            </ChatModeProvider>
        </SelectedContextsProvider>
    );
}

export default withAuth(ThreadPage);

