import { AssistantMessageProps } from "@copilotkit/react-ui";
import BallLoader from "../../atoms/BallLoader";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useState, useRef } from "react";
import { ChartContainer } from "../../molecules/ChartContainer";
import { ChartSqlPanel } from "../../molecules/ChartSqlPanel";
import { Tabs } from "../../molecules/Tabs";
import { GridSpinner } from "../../atoms/GridSpinner";
import { useMessageMapping } from "../../MessageMappingContext";
import { useFigAgent, useResponsiveChatPadding, useTableExport } from "../../../hooks";
import StructuredMessageRenderer from "./StructuredMessageRenderer";
import WebRenderPayloadRenderer from "./WebRenderPayloadRenderer";
import SpreadsheetRenderPayloadRenderer from "./SpreadsheetRenderPayloadRenderer";
import { parseStructuredMessage } from "@/utils/parseStructuredMessage";
import type { WebRenderPayload, SpreadsheetRenderPayload } from "@/types";

// Base markdown components (will be extended with table wrapper in component)
const baseMarkdownComponents = {
    h1: (props: any) => <h1 className="my-1.5 text-xl font-bold text-black" {...props} />,
    h2: (props: any) => <h2 className="my-1.5 text-lg font-semibold text-black" {...props} />,
    p: (props: any) => <p className="text-sm text-black" {...props} />,
    ul: (props: any) => <ul className="list-disc pl-10 text-black" {...props} />,
    ol: (props: any) => <ol className="list-decimal pl-10 text-black" {...props} />,
    li: (props: any) => <li className="text-black" {...props} />,
    code: (props: any) => (
        <pre className="overflow-x-auto rounded bg-gray-100 p-2">
            <code {...props} />
        </pre>
    ),
    th: (props: any) => (
        <th
            className="bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-black"
            style={{ border: "1px solid #e4e4e4" }}
            {...props}
        />
    ),
    td: (props: any) => <td className="px-3 py-2 text-sm text-black" style={{ border: "1px solid #e4e4e4" }} {...props} />,
    tr: (props: any) => <tr className="hover:bg-white" {...props} />,
    tbody: (props: any) => <tbody {...props} />
};

const CustomAssistantMessage = (props: AssistantMessageProps) => {
    const { message, isLoading, subComponent } = props;
    
    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    // useMessageMapping now returns safe defaults if provider isn't available
    const { getUserIdForAssistant, getLastUserMessageId, addMapping } = useMessageMapping();
    const { threadInfo } = useFigAgent();
    // Get responsive padding based on chat container width
    const horizontalPadding = useResponsiveChatPadding();

    // Refs for table export functionality
    const contentRef = useRef<HTMLDivElement | null>(null);
    const tableIndexRef = useRef(0);

    // Use the table export hook
    const { exportTable, isExporting } = useTableExport();

    // State for table detection
    const [hasTable, setHasTable] = useState(false);

    // Skip rendering empty assistant messages (e.g., from __DISCOVER__ trigger)
    // These are placeholder responses that shouldn't display anything
    // IMPORTANT: This check happens AFTER all hooks are called
    const messageContent = typeof message === "string" ? message : "";
    if (!messageContent && !isLoading) {
        return null;
    }

    // Handle export to Google Sheets functionality
    const handleSendTableToSheet = (event: React.MouseEvent<HTMLButtonElement>) => {
        const button = event.currentTarget;
        const tableWrapper = button.closest('div.my-3') as HTMLElement;
        if (!tableWrapper) {
            console.warn("Table wrapper not found");
            return;
        }

        const table = tableWrapper.querySelector('table') as HTMLTableElement;
        if (!table) {
            console.warn("Table not found in wrapper");
            return;
        }

        const container = contentRef.current;
        if (!container) return;

        const allTables = Array.from(container.querySelectorAll("table"));
        const actualIndex = allTables.indexOf(table);

        if (actualIndex === -1) {
            console.warn("Could not determine table index");
            return;
        }

        const rows = Array.from(table.rows).map((row) =>
            Array.from(row.cells).map((cell) => cell.innerText.replace(/\s+/g, " ").trim())
        );

        exportTable({
            tableName: `Table ${actualIndex + 1}`,
            rows
        }, `markdown-table-${actualIndex}`);
    };

    // Detect tables in content and reset table index
    useEffect(() => {
        const container = contentRef.current;
        if (!container) {
            setHasTable(false);
            return;
        }

        const containsTable = container.querySelector("table") !== null;
        setHasTable(containsTable);

        // Reset table index counter when message changes
        tableIndexRef.current = 0;
    }, [message, isLoading]);
    
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

    const displayMessage = typeof message === "string" ? message : "";

    // Check client_type to determine rendering mode
    const clientType = threadInfo?.client_type || "spreadsheet";
    const isSpreadsheetMode = clientType === "spreadsheet";

    // New architecture: Check for render_spreadsheet first if in spreadsheet mode
    // render_spreadsheet contains markdown tables optimized for copy/paste
    const renderSpreadsheet: SpreadsheetRenderPayload | undefined = useMemo(() => {
        if (!isSpreadsheetMode) return undefined;
        const spreadsheetPayload = threadInfo?.render_spreadsheet;
        if (!spreadsheetPayload || !spreadsheetPayload.tables || spreadsheetPayload.tables.length === 0) {
            return undefined;
        }
        return spreadsheetPayload;
    }, [isSpreadsheetMode, threadInfo?.render_spreadsheet]);

    const hasRenderSpreadsheet = !!renderSpreadsheet;

    // New architecture: Check for render_web in state (for web mode)
    // render_web is now a list with message_id for per-message filtering
    // render_web contains structured UI components (tiles, tables, insights)
    // AIMessage.content contains human-readable markdown
    const allRenderWeb = Array.isArray(threadInfo?.render_web) ? threadInfo.render_web : [];

    // Filter render_web by message_id (similar to how charts are filtered)
    const renderWeb: WebRenderPayload | undefined = useMemo(() => {
        // Skip render_web if we have render_spreadsheet
        if (hasRenderSpreadsheet) return undefined;
        if (allRenderWeb.length === 0) return undefined;
        
        const messageIdToUse = userMessageId || currentMessageId;
        
        // First, try to find exact message_id match
        if (messageIdToUse) {
            const matched = allRenderWeb.find((p: WebRenderPayload) => p.message_id === messageIdToUse);
            if (matched) return matched;
        }
        
        // Fallback: In spreadsheet mode, if no match found, use the most recent render_web entry
        // This handles cases where message_id mapping hasn't been established yet
        if (isSpreadsheetMode && allRenderWeb.length > 0) {
            // Return the last entry (most recent)
            return allRenderWeb[allRenderWeb.length - 1];
        }
        
        return undefined;
    }, [allRenderWeb, userMessageId, currentMessageId, hasRenderSpreadsheet, isSpreadsheetMode]);

    const renderWebHasContent = !!renderWeb && (
        (renderWeb.tiles && renderWeb.tiles.length > 0) ||
        (renderWeb.blocks && renderWeb.blocks.length > 0) ||
        (renderWeb.insights && renderWeb.insights.length > 0) ||
        (renderWeb.next_actions && renderWeb.next_actions.length > 0)
    );

    // Only show render_web if:
    // 1. render_web has content
    // 2. AND either this message is not loading OR has actual content
    // 3. AND we don't have render_spreadsheet (spreadsheet takes priority)
    // This prevents showing stale render_web from previous response on a new loading message
    const hasRenderWeb = renderWebHasContent && (!isLoading || displayMessage.length > 0) && !hasRenderSpreadsheet;


    // Legacy: Parse structured message from JSON in message content
    // This is kept for backward compatibility with old message format
    const structuredParse = useMemo(() => {
        // Skip legacy parsing if we have render_spreadsheet or render_web
        if (hasRenderSpreadsheet || hasRenderWeb) {
            return { payload: null, error: null, fallbackText: null };
        }
        return parseStructuredMessage(displayMessage);
    }, [displayMessage, hasRenderSpreadsheet, hasRenderWeb]);
    const structuredPayload = structuredParse.payload;
    const structuredError = structuredParse.error;
    const structuredFallbackText = structuredParse.fallbackText;


    useEffect(() => {
        if (structuredError) {
            console.warn("Structured render fallback:", structuredError);
        }
    }, [structuredError]);
    
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
    const tabData: [string, string][] = [
        ["sql", "Chart SQL"],
        ["charts", "Charts"]
    ];
    
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
                <div className="w-full overflow-x-auto overflow-y-visible break-words whitespace-pre-line text-black">
                    {structuredError && (
                        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            We had trouble rendering this response. Here is a short summary instead.
                        </div>
                    )}
                    {/* New architecture: Check for render_spreadsheet first (spreadsheet mode) */}
                    {hasRenderSpreadsheet ? (
                        <div>
                            {/* Show ONLY the SpreadsheetRenderPayloadRenderer for spreadsheet mode */}
                            <SpreadsheetRenderPayloadRenderer payload={renderSpreadsheet!} />
                        </div>
                    ) : hasRenderWeb ? (
                        /* New architecture: render_web in state - show ONLY structured UI when available */
                        <div>
                            {/* Show ONLY the structured WebRenderPayloadRenderer - no markdown duplication */}
                            <WebRenderPayloadRenderer
                                payload={renderWeb!}
                                charts={derivedState.charts}
                            />
                        </div>
                    ) : structuredPayload ? (
                        /* Legacy: structured JSON in message content */
                        <StructuredMessageRenderer payload={structuredPayload} charts={derivedState.charts} />
                    ) : structuredError ? (
                        <div className="rounded border border-[#e4e4e4] bg-white p-4 text-gray-700">
                            <div className="prose prose-sm max-w-none" ref={contentRef}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        ...baseMarkdownComponents,
                                        table: (props) => {
                                            const currentIndex = tableIndexRef.current;
                                            tableIndexRef.current += 1;

                                            return (
                                                <div className="my-3" style={{ width: '100%' }}>
                                                    <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
                                                        <table
                                                            className="border-collapse text-sm text-black"
                                                            style={{ borderSpacing: 0, minWidth: '100%' }}
                                                            {...props}
                                                        />
                                                    </div>
                                                    {!isLoading && (
                                                        <div className="flex justify-end" style={{ marginTop: '8px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={handleSendTableToSheet}
                                                                disabled={isExporting(`markdown-table-${currentIndex}`)}
                                                                className="inline-flex items-center gap-1.5 rounded-md bg-black text-xs font-semibold text-white transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                                                                style={{ padding: '4px 8px' }}
                                                            >
                                                                {isExporting(`markdown-table-${currentIndex}`) ? "Exporting…" : "Export to Sheet"}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                    }}
                                >
                                    {structuredFallbackText || "We could not render this response. Please ask a follow-up question."}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ) : (
                        <div className="prose prose-sm max-w-none" ref={contentRef}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    ...baseMarkdownComponents,
                                    table: (props) => {
                                        const currentIndex = tableIndexRef.current;
                                        tableIndexRef.current += 1;

                                        return (
                                            <div className="my-3" style={{ width: '100%' }}>
                                                <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
                                                    <table
                                                        className="border-collapse text-sm text-black"
                                                        style={{ borderSpacing: 0, minWidth: '100%' }}
                                                        {...props}
                                                    />
                                                </div>
                                                {!isLoading && (
                                                    <div className="flex justify-end" style={{ marginTop: '8px' }}>
                                                        <button
                                                            type="button"
                                                            onClick={handleSendTableToSheet}
                                                            disabled={isExporting(`markdown-table-${currentIndex}`)}
                                                            className="inline-flex items-center gap-1.5 rounded-md bg-black text-xs font-semibold text-white transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                                                            style={{ padding: '4px 8px' }}
                                                        >
                                                            {isExporting(`markdown-table-${currentIndex}`) ? "Exporting…" : "Export to Sheet"}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                }}
                            >
                                {displayMessage}
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
            
            {/* Don't show charts/texts in spreadsheet mode - only show markdown tables */}
            {!hasRenderSpreadsheet && !hasRenderWeb && !structuredPayload && (derivedState.hasCharts || derivedState.hasTexts) && !isLoading && displayMessage && (
                <div className="mt-6 w-full">
                    <div className="relative mb-4 flex w-full items-center justify-between">
                        {derivedState.hasCharts && (
                            <Tabs data={tabData} activeTab={chartTab} setActiveTab={(tab) => setChartTab(tab as "sql" | "charts")} />
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