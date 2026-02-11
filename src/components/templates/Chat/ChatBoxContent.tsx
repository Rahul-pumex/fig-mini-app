import { CopilotChat, CopilotKitCSSProperties } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { useCoAgent, useCopilotContext } from "@copilotkit/react-core";
import { ChatBoxContentProps, AdminFlowAgentState } from "../../../types";
import { ADMIN_AGENT_NAME, THREAD_PAGE_PREFIX } from "../../../constants";
import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { ChatModeProvider } from "../../ChatModeContext";
import CustomUserMessage from "./CustomUserMessage";
import CustomChatInput from "./CustomChatInput";
import { useRouter } from "next/router";
import isEmpty from "lodash/isEmpty";
import isEqual from "lodash/isEqual";
import { useFigAgent } from "../../../hooks";
import { MessageMappingProvider } from "../../MessageMappingContext";
import CustomAssistantMessage from "./CustomAssistantMessage";

const ChatBoxContent: React.FC<ChatBoxContentProps> = ({ isCollapsed, setIsCollapsed, onCollapseChange }) => {
    const router = useRouter();
    const lastSyncedState = useRef<AdminFlowAgentState | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true); // auto scroll flag
    const userScrollLockRef = useRef(false); // user intentionally scrolled up
    const lastScrollTopRef = useRef(0);
    // const messageCountRef = useRef(0); // disabled suggestion tracking

    const { threadId, setThreadId, setThread, threadInfo, fetchThreads } = useFigAgent();
    const copilotContext = useCopilotContext();
    const { isLoading } = copilotContext;
    
    // Show initial message only for new threads (no threadId or "new")
    // Once thread has an ID, it means there are messages, so hide initial message
    const isNewThread = isEmpty(threadId) || threadId === "new";

    // Track generation state - use isLoading as the primary indicator
    const isGenerating = isLoading;

    // removed debug logging of generation state

    // Initialize suggestion bubbles
    // const { visible: suggestionsVisible, suggestions, showSuggestions, hideSuggestions, updateSuggestions } = useSuggestionBubbles(); // disabled

    // Memoize initialState to prevent unnecessary reloads when threadId hasn't actually changed
    const normalizedThreadId = isEmpty(threadId) || threadId === "new" ? undefined : threadId;
    const initialState = useMemo(() => ({
        threadId: normalizedThreadId
    }), [normalizedThreadId]);

    const { state, threadId: oid } = useCoAgent<AdminFlowAgentState>({
        name: ADMIN_AGENT_NAME,
        initialState
    });



    const scrollToBottom = useCallback(
        (force = false) => {
            if (!force && (!shouldAutoScroll || userScrollLockRef.current)) return;
            requestAnimationFrame(() => {
                const target = chatContainerRef.current || scrollRef.current;
                if (target) {
                    target.scrollTop = target.scrollHeight;
                    lastScrollTopRef.current = target.scrollTop;
                }
            });
        },
        [shouldAutoScroll]
    );

    const handleScroll = useCallback(() => {
        const target = chatContainerRef.current;
        if (!target) return;
        const { scrollTop, scrollHeight, clientHeight } = target;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 40;
        if (isNearBottom) {
            userScrollLockRef.current = false;
            setShouldAutoScroll(true);
        } else {
            // user scrolled up - lock auto scroll
            if (scrollTop < lastScrollTopRef.current) {
                userScrollLockRef.current = true;
            }
            setShouldAutoScroll(false);
        }
        lastScrollTopRef.current = scrollTop;
    }, []);

    useEffect(() => {
        const el = chatContainerRef.current;
        if (!el) return;
        el.addEventListener("scroll", handleScroll);
        return () => el.removeEventListener("scroll", handleScroll);
    }, [handleScroll]);

    useEffect(() => {
        const chatContainer = chatContainerRef.current;
        if (!chatContainer) return;
        let scrollTimeout: NodeJS.Timeout;
        const mutationObserver = new MutationObserver((mutations) => {
            let hasSignificantContent = false;
            
            for (const mutation of mutations) {
                if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                    for (let i = 0; i < mutation.addedNodes.length; i++) {
                        const node = mutation.addedNodes[i] as HTMLElement;
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if this is just a loader/spinner (small, minimal content)
                            const isLoaderOnly = node.querySelector?.('[class*="BallLoader"], [class*="GridSpinner"], [class*="animate-spin"]') &&
                                node.offsetHeight < 50 &&
                                (!node.textContent || node.textContent.trim().length < 10);
                            
                            // If it's not just a loader, or if it has significant height/content, trigger scroll
                            if (!isLoaderOnly || node.offsetHeight >= 50 || (node.textContent && node.textContent.trim().length >= 20)) {
                                hasSignificantContent = true;
                                break;
                            }
                        }
                    }
                }
            }
            
            if (hasSignificantContent) {
                // Debounce scroll to prevent rapid-fire scrolling during loading
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    // only auto-scroll if not locked
                    scrollToBottom(false);
                }, 100);
            }
        });
        mutationObserver.observe(chatContainer, { childList: true, subtree: true });
        return () => {
            clearTimeout(scrollTimeout);
            mutationObserver.disconnect();
        };
    }, [scrollToBottom]);

    useEffect(() => {
        onCollapseChange?.(isCollapsed);
    }, [isCollapsed, onCollapseChange]);

    useEffect(() => {
        if (!isLoading && state) {
            const isDifferentFromThreadInfo = !isEqual(threadInfo, state);
            const isDifferentFromLastSync = !isEqual(lastSyncedState.current, state);
            const stateHasContent = state && Object.keys(state).length > 0;

            if (isDifferentFromThreadInfo && isDifferentFromLastSync && stateHasContent) {
                lastSyncedState.current = state;

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

                setTimeout(() => {
                    setThread(state);
                    setTimeout(() => scrollToBottom(true), 200);
                }, 10);
            }
        }
    }, [isLoading, state, threadInfo, setThread, scrollToBottom]);
    useEffect(() => {
        if (!isLoading && isEmpty(threadId) && oid) {
            localStorage.removeItem("splitPos");
            setThreadId(oid);
            fetchThreads();
            setTimeout(() => {
                router.replace(`${THREAD_PAGE_PREFIX}/${oid}`, undefined, { shallow: true });
            }, 1000);
        }
    }, [isLoading, threadId, oid, fetchThreads, router, setThreadId]);

    useEffect(() => {
        scrollToBottom(false);
    }, [state, threadInfo, scrollToBottom]);

    return (
        <div className="flex h-full w-full flex-col bg-transparent transition-all duration-300 ease-in-out">
            <div className="flex min-h-0 flex-1 flex-col" ref={scrollRef}>
                <div
                    ref={chatContainerRef}
                    style={
                        {
                            "--copilot-kit-background-color": "transparent",
                            "--copilot-kit-primary-color": "#745263",
                            "--copilot-kit-separator-color": "transparent",
                            paddingBottom: "4px" // Ensure space for sticky input at bottom
                        } as CopilotKitCSSProperties & { paddingBottom: string }
                    }
                    className="copilot-chat-container flex flex-1 flex-col overflow-y-auto border-none"
                >
                    {/* Removed InlineLogTimeLine to hide logs at top; logs will show only within assistant messages */}
                    <ChatModeProvider>
                    <MessageMappingProvider>
                        <CopilotChat
                            labels={{
                                initial: isNewThread ? "Hello! What can I do for you?" : "",
                                title: "FIG Agent",
                                placeholder: "Ask me anything!",
                                stopGenerating: "Stop",
                                regenerateResponse: "Regenerate"
                            }}
                            Input={(inputProps) => (
                                <CustomChatInput
                                    {...inputProps}
                                    // suggestions disabled
                                    // suggestions={{ visible: suggestionsVisible, suggestions }}
                                    // onSuggestionClick={handleSuggestionClick}
                                    isGenerating={isGenerating}
                                />
                            )}
                            AssistantMessage={CustomAssistantMessage}
                            UserMessage={CustomUserMessage}
                        />
                        </MessageMappingProvider>
                    </ChatModeProvider>
                </div>
            </div>
        </div>
    );
};

export default ChatBoxContent;
