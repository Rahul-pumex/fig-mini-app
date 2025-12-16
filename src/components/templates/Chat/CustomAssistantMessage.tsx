import { AssistantMessageProps } from "@copilotkit/react-ui";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useState } from "react";
import { useMessageMapping } from "../../MessageMappingContext";
import { useFigAgent, useResponsiveChatPadding } from "../../../hooks";
import { GridSpinner } from "../../atoms/GridSpinner";
import { ChartContainer } from "../../molecules/ChartContainer";
import { ChartSqlPanel } from "../../molecules/ChartSqlPanel";
import { Tabs } from "../../molecules/Tabs";
import BallLoader from "../../atoms/BallLoader";

const CustomAssistantMessage = (props: AssistantMessageProps) => {
    const { message, isLoading, subComponent } = props;
    // useMessageMapping now returns safe defaults if provider isn't available
    const { getUserIdForAssistant, getLastUserMessageId, addMapping } = useMessageMapping();
    const { threadInfo } = useFigAgent();
    // Get responsive padding based on chat container width
    const horizontalPadding = useResponsiveChatPadding();
    
    // Get assistant message ID
    const rawData = (props as any)?.rawData;
    const assistantId = useMemo(() => {
        return rawData?.id || null;
    }, [rawData?.id]);
    
    // Get user message ID for this assistant message (check if mapping already exists)
    const userMessageId = useMemo(() => {
        if (assistantId) {
            return getUserIdForAssistant(assistantId);
        }
        return null;
    }, [assistantId, getUserIdForAssistant]);
    
    // Create mapping when assistant message is rendered (only once per assistantId)
    useEffect(() => {
        // Skip if mapping already exists
        if (assistantId && !userMessageId) {
            let lastUserId = getLastUserMessageId();
            
            // Fallback: try to get user message ID from DOM if context doesn't have it
            if (!lastUserId) {
                const messageContainer = document.querySelector('.copilot-kit-messages');
                if (messageContainer) {
                    // Find the most recent user message element
                    const userMessages = messageContainer.querySelectorAll('[data-message-role="user"]');
                    if (userMessages.length > 0) {
                        const lastUserMessage = userMessages[userMessages.length - 1];
                        // Try to get ID from the element or its parent
                        const userIdFromDom = (lastUserMessage as any)?.id || 
                                            (lastUserMessage as any)?.getAttribute?.('data-message-id') ||
                                            (lastUserMessage.parentElement as any)?.id;
                        if (userIdFromDom) {
                            lastUserId = userIdFromDom;
                        }
                    }
                }
            }
            
            if (lastUserId) {
                addMapping(assistantId, lastUserId);
            } else {
                const timeout = setTimeout(() => {
                    const retryUserId = getLastUserMessageId();
                    if (retryUserId) {
                        addMapping(assistantId, retryUserId);
                    }
                }, 100);
                return () => clearTimeout(timeout);
            }
        }
    }, [assistantId, userMessageId, getLastUserMessageId, addMapping]);
    
    // Keep currentMessageId for backward compatibility if needed
    const currentMessageId = useMemo(() => {
        if (!message) return null;
        
        const rawData = (props as any)?.rawData;
        if (rawData?.id) {
            return rawData.id;
        }
        
        return null;
    }, [message, props]);
    
    const [chartTab, setChartTab] = useState<"sql" | "charts">("charts");
    const [showLoader, setShowLoader] = useState(true);
    
    // Use userMessageId to filter charts and texts since they are associated with user messages
    const derivedState = useMemo(() => {
        // Use userMessageId if available, otherwise fall back to currentMessageId
        const messageIdToUse = userMessageId || currentMessageId;
        
        // Get charts and texts from threadInfo (real state) instead of mock data
        const allCharts = Array.isArray(threadInfo?.charts) ? threadInfo.charts : [];
        const allTexts = Array.isArray(threadInfo?.texts) ? threadInfo.texts : [];
        const allTopics = Array.isArray(threadInfo?.topics) ? threadInfo.topics : [];
        
        // Filter charts and texts by message_id - only show charts/texts that have a matching message_id
        // If there's no messageIdToUse, don't show any charts/texts (return empty arrays)
        // If a chart/text doesn't have a message_id field, exclude it to prevent showing for all messages
        const filteredCharts = messageIdToUse
            ? allCharts.filter((chart: any) => {
                // Only include charts that have a message_id and it matches
                return chart.message_id && chart.message_id === messageIdToUse;
            })
            : [];
        
        const filteredTexts = messageIdToUse
            ? allTexts.filter((text: any) => {
                // Only include texts that have a message_id and it matches
                return text.message_id && text.message_id === messageIdToUse;
            })
            : [];

        return {
            hasTopics: allTopics.length > 0,
            hasCharts: filteredCharts.length > 0,
            hasTexts: filteredTexts.length > 0,
            hasKnowledgeGraph: false,
            hasDashboardContent: filteredCharts.length > 0 || filteredTexts.length > 0,
            topics: allTopics,
            charts: filteredCharts,
            texts: filteredTexts
        };
    }, [userMessageId, currentMessageId, threadInfo]);
    
    useEffect(() => {
        setShowLoader(true);

        const timer = setTimeout(() => {
            setShowLoader(false);
        }, 10000);

        if (derivedState.hasCharts) {
            setShowLoader(false);
        }

        return () => clearTimeout(timer);
    }, [derivedState.hasCharts]);
    
    const shouldShowLoader = showLoader;
    const tabData: Array<[string, string]> = [
        ["sql", "Chart SQL"],
        ["charts", "Charts"]
    ];
    
    const handleTabChange = (tab: string) => {
        setChartTab(tab as "sql" | "charts");
    };
    
    const renderChartContent = () => {
        if (!derivedState.hasCharts && !shouldShowLoader) return null;

        if (shouldShowLoader && !derivedState.hasCharts) {
            return (
                <div className="flex min-h-70 items-center justify-center">
                    <GridSpinner height={32} width={32} />
                </div>
            );
        }

        if (chartTab === "sql") {
            return <ChartSqlPanel charts={derivedState.charts} />;
        }

        return <ChartContainer charts={derivedState.charts} showItemActions={true} />;
    };

    return (
        <div className={`py-6 ${horizontalPadding}`}>
            <div className="flex items-start">
                <div className="w-full overflow-x-auto overflow-y-visible wrap-break-word whitespace-pre-line text-black">
                    {message && (
                        <div className="prose prose-sm max-w-none">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: (props) => <h1 className="my-1.5 text-xl font-bold text-black" {...props} />,
                                    h2: (props) => <h2 className="my-1.5 text-lg font-semibold text-black" {...props} />,
                                    p: (props) => <p className="text-sm text-black" {...props} />,
                                    ul: (props) => <ul className="list-disc pl-10 text-black" {...props} />,
                                    ol: (props) => <ol className="list-decimal pl-10 text-black" {...props} />,
                                    li: (props) => <li className="text-black" {...props} />,
                                    code: (props) => (
                                        <pre className="overflow-x-auto rounded bg-gray-100 p-2">
                                            <code {...props} />
                                        </pre>
                                    ),
                                    table: (props) => <table className="my-4 w-full border-collapse text-black" style={{ borderSpacing: 0 }} {...props} />,
                                    th: (props) => (
                                        <th
                                            className="bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-black"
                                            style={{ border: "1px solid #e4e4e4" }}
                                            {...props}
                                        />
                                    ),
                                    td: (props) => <td className="px-3 py-2 text-sm text-black" style={{ border: "1px solid #e4e4e4" }} {...props} />,
                                    tr: (props) => <tr className="hover:bg-white" {...props} />,
                                    tbody: (props) => <tbody {...props} />
                                }}
                            >
                                {message}
                            </ReactMarkdown>
                        </div>
                    )}

                    {isLoading && (
                        <div className="mt-2 flex items-center gap-2 text-gray-500 py-2 px-1 overflow-visible">
                            <BallLoader />
                        </div>
                    )}
                </div>
            </div>

            {subComponent && <div className="my-2">{subComponent}</div>}
            
            {(derivedState.hasCharts || derivedState.hasTexts) && !isLoading && message && (
                <div className="mt-6 w-full">
                    <div className="relative mb-4 flex w-full items-center justify-between">
                        {derivedState.hasCharts && (
                            <Tabs data={tabData} activeTab={chartTab} setActiveTab={handleTabChange} />
                        )}
                    </div>
                    <div className="relative z-10">
                        {renderChartContent()}
                        {/* {derivedState.hasTexts && (
                            <TextContainer 
                                text={derivedState.texts} 
                                heightLimit="max-h-[400px]" 
                                showItemActions={true} 
                            />
                        )} */}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomAssistantMessage;