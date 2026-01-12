/**
 * WebRenderPayloadRenderer
 *
 * Renders structured UI components from the render_web state field.
 * Layout matches StructuredMessageRenderer for consistency.
 */

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { useCopilotChat } from "@copilotkit/react-core";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";
import { ChartContainer } from "@/components/molecules/ChartContainer";
import { formatShortDate } from "@/utils/parseStructuredMessage";
import { ExportTableButton } from "@/components/atoms/ExportTableButton";
import type {
    WebRenderPayload,
    TileSpec,
    InsightSpec,
    BlockSpec,
    NextAction,
    ChartSpec,
    EvidenceTab,
    AuditItem,
} from "@/types";

interface WebRenderPayloadRendererProps {
    payload: WebRenderPayload;
    charts?: ChartSpec[];
}

// ============================================================================
// Header Section
// ============================================================================
const HeaderSection: React.FC<{
    title?: string;
    subtitle?: string;
    contextChips?: string[];
}> = ({ title, subtitle, contextChips }) => {
    const responseTime = useMemo(() => formatShortDate(new Date().toISOString()), []);

    if (!title) return null;

    return (
        <div className="rounded border border-[#e4e4e4] bg-white px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <div className="text-sm font-semibold text-gray-900">{title}</div>
                    {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
                    {contextChips && contextChips.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {contextChips.map((chip: string, idx: number) => (
                                <span
                                    key={`${chip}-${idx}`}
                                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600"
                                >
                                    {chip}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="text-xs text-gray-500">Response Datetime: {responseTime}</div>
            </div>
        </div>
    );
};

// ============================================================================
// Tiles Strip (KPI Metrics)
// ============================================================================
const TilesStrip: React.FC<{ tiles: TileSpec[] }> = ({ tiles }) => {
    if (!tiles || tiles.length === 0) return null;

    const trendBadge = (direction?: string) => {
        if (!direction) return null;
        const styles =
            direction === "up"
                ? "bg-green-100 text-green-700"
                : direction === "down"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600";
        const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "–";
        return <span className={`ml-1 rounded px-1 py-0.5 text-xs font-medium ${styles}`}>{arrow}</span>;
    };

    return (
        <div className="rounded border border-[#e4e4e4] bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-gray-500">At a glance</div>
            <div className="flex flex-wrap gap-3">
                {tiles.map((tile: any) => (
                    <div
                        key={tile.tile_id}
                        className="min-w-[160px] flex-1 rounded border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                        <div className="text-[11px] uppercase text-gray-500">{tile.label}</div>
                        <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-gray-900">
                            {tile.value}
                            {tile.delta && (
                                <span className="text-sm font-normal text-gray-600">
                                    {tile.delta}
                                    {trendBadge(tile.delta_direction)}
                                </span>
                            )}
                        </div>
                        {tile.subtitle && <div className="text-xs text-gray-500">{tile.subtitle}</div>}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// Insights Summary Card
// ============================================================================
const InsightsSummaryCard: React.FC<{ insights: InsightSpec[] }> = ({ insights }) => {
    if (!insights || insights.length === 0) return null;

    const importanceStyles = (importance?: string) => {
        switch (importance) {
            case "high":
                return "border-l-teal-600 bg-gradient-to-r from-teal-50 to-white";
            case "medium":
                return "border-l-emerald-500 bg-gradient-to-r from-emerald-50/60 to-white";
            default:
                return "border-l-gray-300 bg-gradient-to-r from-gray-50/40 to-white";
        }
    };

    return (
        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-gray-800">Key Insights</div>
            <div className="space-y-2.5">
                {insights.map((insight: any) => (
                    <div
                        key={insight.insight_id}
                        className={`rounded border-l-[3px] px-4 py-3 transition-all duration-200 hover:shadow-md ${importanceStyles(insight.importance)}`}
                    >
                        <div className="text-[13px] font-semibold text-gray-900">{insight.title}</div>
                        <div className="mt-1.5 text-xs leading-relaxed text-gray-600">{insight.body}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// Table Card with Pagination
// ============================================================================
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

const TableCard: React.FC<{ block: BlockSpec }> = ({ block }) => {
    const content = block.content;
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    if (!content || !content.columns || !content.rows) return null;

    const columns = content.columns;
    const rows = content.rows;

    const totalRows = rows.length;
    const totalPages = Math.ceil(totalRows / pageSize);
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalRows);
    const paginatedRows = rows.slice(startIdx, endIdx);

    // Prepare data for export (all rows, not just paginated)
    const exportRows = useMemo(() => {
        if (!columns || !rows || columns.length === 0 || rows.length === 0) {
            return [];
        }
        try {
            // Header row
            const headerRow = columns.map(col => col.label || col.key);
            // Data rows
            const dataRows = rows.map(row => 
                columns.map(col => String(row[col.key] ?? ""))
            );
            return [headerRow, ...dataRows];
        } catch (error) {
            console.error("Error preparing export rows:", error);
            return [];
        }
    }, [columns, rows]);

    // Reset to page 1 if current page exceeds total pages (e.g., when changing page size)
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1);
    };

    // Generate page numbers to display
    const getPageNumbers = (): (number | string)[] => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const pages: (number | string)[] = [];
        if (currentPage <= 3) {
            pages.push(1, 2, 3, 4, "...", totalPages);
        } else if (currentPage >= totalPages - 2) {
            pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
        } else {
            pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
        }
        return pages;
    };

    return (
        <>
            {/* Table Card - with border */}
            <div className="rounded border border-[#e4e4e4] bg-white">
                {block.title && (
                    <div className="border-b border-[#e4e4e4] px-4 py-3 text-sm font-semibold text-gray-800">
                        {block.title}
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {columns.map((col: { key: string; label?: string }, idx: number) => (
                                    <th
                                        key={col.key || idx}
                                        className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                                    >
                                        {col.label || col.key}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {paginatedRows.map((row: Record<string, unknown>, rowIdx: number) => (
                                <tr key={startIdx + rowIdx} className="hover:bg-gray-50">
                                    {columns.map((col: { key: string }, colIdx: number) => (
                                        <td
                                            key={`${startIdx + rowIdx}-${col.key || colIdx}`}
                                            className="whitespace-nowrap px-4 py-2 text-sm text-gray-700"
                                        >
                                            {String(row[col.key] ?? "—")}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer - Pagination only (if > 5 rows) */}
                {totalRows > 5 && (
                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2">
                        {/* Page size selector */}
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span>Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                            >
                                {PAGE_SIZE_OPTIONS.map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Row count info */}
                        <div className="text-xs text-gray-500">
                            {startIdx + 1}–{endIdx} of {totalRows} rows
                        </div>

                        {/* Page navigation */}
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Prev
                                </button>

                                {getPageNumbers().map((page, idx) =>
                                    page === "..." ? (
                                        <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400">
                                            ...
                                        </span>
                                    ) : (
                                        <button
                                            key={page}
                                            type="button"
                                            onClick={() => handlePageChange(page as number)}
                                            className={`min-w-[28px] rounded border px-2 py-1 text-xs ${
                                                currentPage === page
                                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    )
                                )}

                                <button
                                    type="button"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Export Button - Outside table card, below footer, right-aligned */}
            {exportRows.length > 0 && (
                <div className="flex justify-end mt-2">
                    <ExportTableButton
                        tableId={`web-render-table-${block.block_id}`}
                        tableName={block.title || "Table"}
                        rows={exportRows}
                        size="sm"
                    />
                </div>
            )}
        </>
    );
};

// ============================================================================
// Evidence Section
// ============================================================================
interface SourceTreeNode {
    id: string;
    label: string;
    kind?: string;
    children?: string[];
}

const EvidenceSection: React.FC<{ tabs: EvidenceTab[]; tablesUsed?: string[] }> = ({ tabs, tablesUsed }) => {
    const [isOpen, setIsOpen] = useState(false);

    const effectiveTabs = useMemo(() => {
        const result = [...tabs];
        const hasSourceTablesTab = tabs.some((tab) => tab.tab_id === "source_tables");

        if (tablesUsed && tablesUsed.length > 0 && !hasSourceTablesTab) {
            const distinctTables = Array.from(new Set(tablesUsed));
            result.unshift({
                tab_id: "tables_used",
                label: "Tables Used",
                content_type: "source_tree",
                content: {
                    type: "source_tree",
                    nodes: distinctTables.map((table) => ({
                        id: table,
                        label: table,
                        kind: "table"
                    }))
                } as any
            });
        }

        return result;
    }, [tabs, tablesUsed]);

    const [activeTab, setActiveTab] = useState(effectiveTabs[0]?.tab_id || "");

    // Update activeTab if effectiveTabs changes and current tab no longer exists
    useEffect(() => {
        if (effectiveTabs.length > 0 && !effectiveTabs.find((t) => t.tab_id === activeTab)) {
            setActiveTab(effectiveTabs[0].tab_id);
        }
    }, [effectiveTabs, activeTab]);

    if (!effectiveTabs || effectiveTabs.length === 0) return null;

    const currentTab = effectiveTabs.find((tab) => tab.tab_id === activeTab) || effectiveTabs[0];

    // Extract distinct tables from source_tree content
    const getDistinctTables = (content: { nodes?: SourceTreeNode[] }): string[] => {
        if (!content?.nodes) return [];
        const tables = content.nodes
            .filter((node) => node.kind === "table" || node.kind === "view" || !node.kind)
            .map((node) => node.label || node.id);
        return Array.from(new Set(tables));
    };

    return (
        <div className="rounded border border-[#e4e4e4] bg-white">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800 cursor-pointer"
            >
                <span>Show evidence ({effectiveTabs.length} {effectiveTabs.length === 1 ? "source" : "sources"})</span>
                <span className="text-xs text-gray-400">{isOpen ? "Hide" : "Show"}</span>
            </button>
            {isOpen && (
                <div className="border-t border-[#e4e4e4] p-4">
                    {effectiveTabs.length > 1 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                            {effectiveTabs.map((tab) => (
                                <button
                                    key={tab.tab_id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.tab_id)}
                                    className={`rounded px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                                        activeTab === tab.tab_id
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {(currentTab?.content_type === "source_tree" || currentTab?.tab_id === "source_tables" || currentTab?.tab_id === "tables_used") && currentTab.content && (
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {getDistinctTables(currentTab.content as any).map((tableName, idx) => (
                                    <span
                                        key={`${tableName}-${idx}`}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700"
                                    >
                                        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 11h16M9 7v10" />
                                        </svg>
                                        {tableName}
                                    </span>
                                ))}
                            </div>
                            {getDistinctTables(currentTab.content as any).length === 0 && (
                                <div className="text-sm text-gray-500">No tables found.</div>
                            )}
                        </div>
                    )}

                    {/* Table content */}
                    {currentTab?.content_type === "table" && currentTab.content && (
                        <div className="overflow-x-auto rounded border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {((currentTab.content as any).columns || []).map((col: { key: string; label?: string }, idx: number) => (
                                            <th key={col.key || idx} className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                                                {col.label || col.key}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {((currentTab.content as any).rows || []).slice(0, 5).map((row: Record<string, unknown>, rowIdx: number) => (
                                        <tr key={rowIdx}>
                                            {((currentTab.content as any).columns || []).map((col: { key: string }, colIdx: number) => (
                                                <td key={`${rowIdx}-${colIdx}`} className="px-3 py-2 text-gray-700">
                                                    {String(row[col.key] ?? "—")}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// Audit Trail Section
// ============================================================================
const AuditTrailSection: React.FC<{ items: AuditItem[] }> = ({ items }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!items || items.length === 0) return null;

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="rounded border border-[#e4e4e4] bg-white">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800"
            >
                <span>Audit trail</span>
                <span className="text-xs text-gray-400 cursor-pointer">{isOpen ? "Hide" : "Show"}</span>
            </button>
            {isOpen && (
                <div className="space-y-3 border-t border-[#e4e4e4] p-4">
                    {items.map((item: any, index) => (
                        <div key={item.item_id || index} className="rounded border border-gray-200 bg-gray-50 p-3">
                            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-800">
                                <span>{item.item_type === "sql" ? "SQL Query" : item.item_type}</span>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(item.content)}
                                    className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 cursor-pointer"
                                >
                                    Copy
                                </button>
                            </div>
                            <pre className="whitespace-pre-wrap text-xs text-gray-700">{item.content}</pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// Action Bar (Next Actions)
// ============================================================================
const ActionBar: React.FC<{ actions: NextAction[] }> = ({ actions }) => {
    const { appendMessage, isLoading } = useCopilotChat();

    const handleClick = useCallback(
        async (prompt: string) => {
            if (!prompt || isLoading) return;
            await appendMessage(
                new TextMessage({
                    content: prompt,
                    role: Role.User,
                })
            );
        },
        [appendMessage, isLoading]
    );

    if (!actions || actions.length === 0) return null;

    return (
        <div className="rounded border border-[#e4e4e4] bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-gray-500">Next best actions</div>
            <div className="flex flex-wrap gap-2">
                {actions.map((action: any) => (
                    <button
                        key={action.action_id}
                        type="button"
                        onClick={() => handleClick(action.prompt)}
                        disabled={isLoading}
                        className="rounded border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// Main Renderer Component
// ============================================================================
const WebRenderPayloadRenderer: React.FC<WebRenderPayloadRendererProps> = ({
    payload,
    charts = [],
}) => {
    const hasCharts = charts && charts.length > 0;
    const hasBlocks = payload.blocks && payload.blocks.length > 0;
    const hasInsights = payload.insights && payload.insights.length > 0;
    // Check both 'type' and 'block_type' for backward compatibility
    const hasTables = hasBlocks && payload.blocks.some((b: BlockSpec) => (b.type === "table" || (b as any).block_type === "table"));
    const isAnalyticsReport = payload.intent === "analytics_report";

    const [activeChartIndex, setActiveChartIndex] = useState(0);

    // Reset chart index when charts change
    useEffect(() => {
        if (charts.length === 0) {
            setActiveChartIndex(0);
            return;
        }
        setActiveChartIndex((current) => (current >= charts.length ? 0 : current));
    }, [charts.length]);

    const activeChart = charts[activeChartIndex] ?? charts[0];

    // Get table blocks - check both 'type' and 'block_type' for backward compatibility
    const tableBlocks = useMemo((): BlockSpec[] => {
        if (!payload.blocks) return [];
        return payload.blocks.filter((b: BlockSpec) => {
            const blockType = b.type || (b as any).block_type;
            return blockType === "table";
        });
    }, [payload.blocks]);

    // Table carousel state
    const [activeTableIndex, setActiveTableIndex] = useState(0);

    // Reset table index when tables change
    useEffect(() => {
        if (tableBlocks.length === 0) {
            setActiveTableIndex(0);
            return;
        }
        setActiveTableIndex((current) => (current >= tableBlocks.length ? 0 : current));
    }, [tableBlocks.length]);

    const activeTable = tableBlocks[activeTableIndex] ?? tableBlocks[0];

    // For analytics_report: show charts/tables on left, insights on right
    // For discovery: show insights full width
    const showSideBySide = isAnalyticsReport && (hasCharts || hasTables) && hasInsights;

    // Chart carousel controls component
    const ChartCarouselControls = () => {
        if (charts.length <= 1) return null;
        return (
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => setActiveChartIndex((current) => Math.max(0, current - 1))}
                    disabled={activeChartIndex === 0}
                    aria-label="Previous chart"
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {"<"}
                </button>
                <div className="text-xs text-gray-500">
                    {activeChartIndex + 1}/{charts.length}
                </div>
                <button
                    type="button"
                    onClick={() => setActiveChartIndex((current) => Math.min(charts.length - 1, current + 1))}
                    disabled={activeChartIndex >= charts.length - 1}
                    aria-label="Next chart"
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {">"}
                </button>
            </div>
        );
    };

    // Table carousel controls component
    const TableCarouselControls = () => {
        if (tableBlocks.length <= 1) return null;
        return (
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => setActiveTableIndex((current) => Math.max(0, current - 1))}
                    disabled={activeTableIndex === 0}
                    aria-label="Previous table"
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {"<"}
                </button>
                <div className="text-xs text-gray-500">
                    {activeTableIndex + 1}/{tableBlocks.length}
                </div>
                <button
                    type="button"
                    onClick={() => setActiveTableIndex((current) => Math.min(tableBlocks.length - 1, current + 1))}
                    disabled={activeTableIndex >= tableBlocks.length - 1}
                    aria-label="Next table"
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {">"}
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <HeaderSection
                title={payload.title}
                subtitle={payload.subtitle}
                contextChips={payload.context_chips}
            />

            {/* Tiles (KPI Metrics) */}
            {payload.tiles && payload.tiles.length > 0 && (
                <TilesStrip tiles={payload.tiles} />
            )}

            {/* Main Content: Side-by-side for analytics_report, stacked otherwise */}
            {showSideBySide ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {/* Left side: Charts/Tables (2 columns) */}
                    <div className="space-y-3 lg:col-span-2">
                        {hasCharts && (
                            <div className="rounded border border-[#e4e4e4] bg-white p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="text-xs font-semibold uppercase text-gray-500">
                                        {activeChart?.chart_id || "Chart"}
                                    </div>
                                    <ChartCarouselControls />
                                </div>
                                {activeChart && <ChartContainer charts={[activeChart]} showItemActions={false} />}
                            </div>
                        )}
                        {!hasCharts && tableBlocks.length > 0 && (
                            <div>
                                {tableBlocks.length > 1 && (
                                    <div className="mb-2 flex items-center justify-end">
                                        <TableCarouselControls />
                                    </div>
                                )}
                                {activeTable && <TableCard block={activeTable} />}
                            </div>
                        )}
                    </div>
                    {/* Right side: Insights (1 column) */}
                    <div className="space-y-3">
                        <InsightsSummaryCard insights={payload.insights} />
                    </div>
                </div>
            ) : (
                <>
                    {/* Discovery or other intents: Insights full width */}
                    {hasInsights && <InsightsSummaryCard insights={payload.insights} />}

                    {/* Charts with carousel */}
                    {hasCharts && (
                        <div className="rounded border border-[#e4e4e4] bg-white p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <div className="text-xs font-semibold uppercase text-gray-500">
                                    {activeChart?.chart_id || "Chart"}
                                </div>
                                <ChartCarouselControls />
                            </div>
                            {activeChart && <ChartContainer charts={[activeChart]} showItemActions={false} />}
                        </div>
                    )}

                    {/* Tables with carousel */}
                    {tableBlocks.length > 0 && (
                        <div>
                            {tableBlocks.length > 1 && (
                                <div className="mb-2 flex items-center justify-end">
                                    <TableCarouselControls />
                                </div>
                            )}
                            {activeTable && <TableCard block={activeTable} />}
                        </div>
                    )}
                </>
            )}

            {/* Evidence Section */}
            {((payload.evidence_tabs?.length ?? 0) > 0 || (payload.tables_used?.length ?? 0) > 0) && (
                <EvidenceSection
                    tabs={payload.evidence_tabs || []}
                    tablesUsed={payload.tables_used}
                />
            )}

            {/* Audit Trail Section */}
            {payload.audit_trail && payload.audit_trail.length > 0 && (
                <AuditTrailSection items={payload.audit_trail} />
            )}

            {/* Next Actions */}
            <ActionBar actions={payload.next_actions} />
        </div>
    );
};

export default WebRenderPayloadRenderer;
