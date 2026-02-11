import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { AuthService, withAuth, resetAuthState } from "@utils";
import ChatBox from "../../../components/templates/Chat/ChatBox";
import { ChatModeProvider } from "../../../components/ChatModeContext";
import { MessageMappingProvider } from "../../../components/MessageMappingContext";
import { SelectedContextsProvider } from "../../../components/SelectedContextsContext";
import { LucideLogOut, LucideMessageSquarePlus, LucideList, EllipsisVertical, Trash2 } from "lucide-react";
import { useFigAgent } from "@/hooks";
import { GridSpinner } from "@components/atoms/GridSpinner";
import ExistingChatIcon from "../../../components/icons/existingChat";

function ThreadPage() {
    const router = useRouter();
    const { query } = router;
    const { threadId, setThreadId, setThread } = useFigAgent();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showThreadList, setShowThreadList] = useState(false);

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
        // Use window.location for full page reload to bypass withAuth HOC checks
        window.location.href = "/auth";
    };

    const handleNewThread = () => {
        setShowThreadList(false);
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

    const toggleThreadList = () => {
        setShowThreadList((prev) => !prev);
    };

    // Hide list when navigating to a specific thread or new thread
    useEffect(() => {
        // Close thread list when URL changes (including when navigating to new thread)
        setShowThreadList(false);
    }, [router.asPath]);
    
    // Also close thread list when threadId changes to empty/new
    useEffect(() => {
        if (!threadId || threadId === "new" || threadId === "") {
            setShowThreadList(false);
        }
    }, [threadId]);

    return (
        <SelectedContextsProvider>
            <ChatModeProvider>
                <MessageMappingProvider>
                    <div className="flex h-screen flex-col overflow-hidden bg-white">
                        {/* Header */}
                        <div className="border-b border-gray-200 bg-white shadow-sm">
                                <div className="flex items-center justify-between h-10 w-[98%]">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={toggleThreadList}
                                            className="group relative flex items-center justify-center px-2 py-2 rounded-lg text-[#745263] transition-all hover:bg-[#FAF8F9] active:scale-95"
                                            aria-label="Threads"
                                        >
                                            <LucideList size={22} strokeWidth={2} />
                                        </button>
                                        <button
                                            onClick={handleNewThread}
                                            className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-medium text-[#745263] transition-colors hover:bg-[#FAF8F9] active:scale-95"
                                            aria-label="New Thread"
                                        >
                                            <LucideMessageSquarePlus size={20} strokeWidth={2} className="relative" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="group relative flex items-center justify-center p-2 rounded-lg text-gray-600 transition-all hover:bg-[#FAF8F9] hover:text-[#745263] active:scale-95"
                                        aria-label="Logout"
                                    >
                                        <LucideLogOut size={22} strokeWidth={2} />
                                        <span className="pointer-events-none absolute -bottom-10 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                            Logout
                                        </span>
                                    </button>
                                </div>
                        </div>

                        {/* Content Area: either Threads List or Chat */}
                        <div className="flex-1 overflow-hidden bg-white">
                            {showThreadList ? (
                                <ThreadListView
                                    onNewThread={handleNewThread}
                                    onDone={() => setShowThreadList(false)}
                                />
                            ) : (
                                <ChatBox
                                    threadId={threadId}
                                    onCollapseChange={(collapsed) => setIsCollapsed(collapsed)}
                                />
                            )}
                        </div>
                    </div>
                </MessageMappingProvider>
            </ChatModeProvider>
        </SelectedContextsProvider>
    );
}

export default withAuth(ThreadPage);

// Local component to list threads similar to main app's sidebar list
function ThreadListView({ onNewThread, onDone }: { onNewThread: () => void; onDone: () => void }) {
    const router = useRouter();
    const { thread_list = [], thread_list_status, fetchThreads, setThreadId, threadId, deleteThread } = useFigAgent();
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchThreads?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            // Check if click is on a menu button (3-dots) or inside the menu
            const isMenuButton = target.closest('button[aria-label="Thread options"]');
            const isInsideMenu = menuRef.current?.contains(target as Node);
            
            if (!isMenuButton && !isInsideMenu) {
                setActiveMenuId(null);
            }
        };

        if (activeMenuId) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeMenuId]);

    const openThread = (id: string) => {
        setThreadId(id);
        router.push(`/chat/${id}`, undefined, { shallow: true });
        onDone();
    };

    const handleDeleteThread = async (threadIdToDelete: string) => {
        setActiveMenuId(null);
        
        // If deleting the active thread, navigate to new thread
        if (threadIdToDelete === threadId) {
            setThreadId("");
            router.push("/chat/new", undefined, { shallow: true });
        }
        
        await deleteThread?.(threadIdToDelete);
    };

    const handleMenuClick = (e: React.MouseEvent, threadId: string) => {
        e.stopPropagation();
        setActiveMenuId(activeMenuId === threadId ? null : threadId);
    };

    return (
        <div className="flex h-full w-full flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-4">
                {thread_list_status === 'LOADING' ? (
                    <div className="flex h-full items-center justify-center">
                        <GridSpinner height={48} width={48} />
                    </div>
                ) : thread_list.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-500">
                        No threads yet.
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {thread_list.map((item: any) => {
                            const isActive = item.thread_id === threadId;
                            const isMenuOpen = activeMenuId === item.thread_id;
                            return (
                                <li key={item.thread_id} className="relative">
                                    <div className="relative">
                                        <button
                                            onClick={() => openThread(item.thread_id)}
                                            aria-selected={isActive}
                                            className={`group flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm shadow-sm transition-all duration-200
                                                ${isActive 
                                                    ? "bg-gray-100 border-gray-300 text-gray-900" 
                                                    : "bg-white border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-gray-300"
                                                }`}
                                        >
                                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <ExistingChatIcon 
                                                    color={isActive ? '#745263' : '#9ca3af'}
                                                    className="shrink-0"
                                                />
                                                <span className="truncate font-medium leading-relaxed text-sm">
                                                    {formatTitle(item.description)}
                                                </span>
                                            </div>
                                            <div className="flex items-center shrink-0">
                                                <button
                                                    onClick={(e) => handleMenuClick(e, item.thread_id)}
                                                    className={`p-1 rounded hover:bg-gray-200 transition-colors ${isActive ? "text-gray-700" : "text-gray-400 group-hover:text-gray-500"}`}
                                                    aria-label="Thread options"
                                                >
                                                    <EllipsisVertical size={16} />
                                                </button>
                                            </div>
                                        </button>
                                        
                                        {isMenuOpen && (
                                            <div 
                                                ref={menuRef}
                                                className="absolute right-1 top-full mt-1 z-50 w-32 rounded-lg border border-gray-200 bg-white shadow-lg"
                                            >
                                                <div className="py-1">
                                                    <button
                                                        onClick={() => handleDeleteThread(item.thread_id)}
                                                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                                                    >
                                                        <Trash2 size={16} />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}

function formatTitle(desc?: string) {
    const text = (desc || "Untitled thread").trim();
    return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}
