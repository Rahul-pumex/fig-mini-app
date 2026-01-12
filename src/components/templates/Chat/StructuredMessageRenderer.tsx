import { useCallback, useEffect, useMemo, useState } from "react";
import { useCopilotChat } from "@copilotkit/react-core";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChartContainer } from "@/components/molecules/ChartContainer";
import { Tabs } from "@/components/molecules/Tabs";
import KpiTable from "@/components/molecules/Tables/KpiTable";
import { formatShortDate } from "@/utils/parseStructuredMessage";
import type { ChartSpec, NextAction } from "@/types";

const trendBadge = (trend?: string) => {
    if (!trend) return null;
    const styles =
        trend === "up"
            ? "text-emerald-600"
            : trend === "down"
            ? "text-rose-600"
            : "text-gray-500";
    const symbol = trend === "up" ? "^" : trend === "down" ? "v" : "-";
    return <span className={`text-xs font-semibold ${styles}`}>{symbol}</span>;
};

const mapChartType = (chartType: string) => {
    if (chartType === "bar") return "bar";
    if (chartType === "scatter") return "scatter";
    if (chartType === "table_chart") return "table_chart";
    return "line";
};

const toLabelString = (value: string | number | null | undefined) => {
    if (value == null) return "";
    return String(value);
};

const sortLabels = (labels: Array<string | number>, type: string) => {
    if (type === "number") {
        return [...labels].sort((a, b) => Number(a) - Number(b));
    }
    if (type === "time") {
        return [...labels].sort((a, b) => new Date(String(a)).getTime() - new Date(String(b)).getTime());
    }
    return labels;
};

const buildChartSpec = (block: any, index: number): ChartSpec | null => {
    const mappedType = mapChartType(block.chart_type);
    if (mappedType === "table_chart") return null;
    const rows = block.data_ref.inline_rows ?? [];
    const xKey = block.spec.x.field;
    const yKey = block.spec.y.field;
    const seriesKey = block.spec.series?.field;
    const labelsRaw = rows.map((row: any) => row[xKey]).filter((value: any) => value != null) as Array<string | number>;
    const labelsOrdered = sortLabels(Array.from(new Set(labelsRaw)), block.spec.x.type).map((value) => toLabelString(value));

    const datasets: any[] = [];
    if (mappedType === "scatter") {
        if (seriesKey) {
            const seriesValues = Array.from(new Set(rows.map((row: any) => row[seriesKey]).filter((value: any) => value != null)));
            seriesValues.forEach((seriesValue) => {
                const seriesRows = rows.filter((row: any) => row[seriesKey] === seriesValue);
                datasets.push({
                    label: toLabelString(seriesValue as string | number) || block.spec.series?.label || "Series",
                    data: seriesRows.map((row: any) => ({ x: row[xKey], y: row[yKey] }))
                });
            });
        } else {
            datasets.push({
                label: block.spec.y.label || yKey,
                data: rows.map((row: any) => ({ x: row[xKey], y: row[yKey] }))
            });
        }
    } else {
        if (seriesKey) {
            const seriesValues = Array.from(new Set(rows.map((row: any) => row[seriesKey]).filter((value: any) => value != null)));
            seriesValues.forEach((seriesValue) => {
                const seriesRows = rows.filter((row: any) => row[seriesKey] === seriesValue);
                const valueMap = new Map(seriesRows.map((row: any) => [toLabelString(row[xKey]), row[yKey] as number | null]));
                datasets.push({
                    label: toLabelString(seriesValue as string | number) || block.spec.series?.label || "Series",
                    data: labelsOrdered.map((label) => valueMap.get(label) ?? null)
                });
            });
        } else {
            const valueMap = new Map(rows.map((row: any) => [toLabelString(row[xKey]), row[yKey] as number | null]));
            datasets.push({
                label: block.spec.y.label || yKey,
                data: labelsOrdered.map((label) => valueMap.get(label) ?? null)
            });
        }
    }

    const annotations = (block.spec.annotations || []).map((annotation: any) => {
        if (annotation.type === "point") {
            return {
                x: annotation.x ?? "",
                y: annotation.y ?? 0,
                text: annotation.label,
                showarrow: true,
                arrowhead: 2,
                ax: 20,
                ay: -20
            };
        }
        return null;
    }).filter(Boolean);

    const shapes = (block.spec.annotations || [])
        .filter((annotation: any) => annotation.type === "range" && annotation.x_start != null && annotation.x_end != null)
        .map((annotation: any) => ({
            type: "rect",
            xref: "x",
            yref: "paper",
            x0: annotation.x_start,
            x1: annotation.x_end,
            y0: 0,
            y1: 1,
            fillcolor: "rgba(120,120,120,0.08)",
            line: { width: 0 }
        }));

    return {
        chart_id: `${block.title || "chart"}_${index + 1}`,
        chart_type: mappedType,
        labels: mappedType === "scatter" ? undefined : labelsOrdered,
        datasets,
        sql: "",
        options: {
            plugins: { title: { text: block.title } },
            layout: {
                annotations,
                shapes
            }
        }
    };
};

const coerceColumnText = (value: any, fallback: string): string => {
    if (value == null) return fallback;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    if (typeof value === "object") {
        const candidates = ["label", "key", "name", "field", "title"];
        for (const key of candidates) {
            if (value && key in value) {
                const inner: string = coerceColumnText((value as any)[key], fallback);
                if (inner) return inner;
            }
        }
    }
    return fallback;
};

const safeStringify = (value: any) => {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const normalizeRowValue = (value: any) => {
    if (value == null) return value;
    if (typeof value === "object") return safeStringify(value);
    return value;
};

const normalizeTable = (table: any): { columns: any; rows: any } => {
    const rows = Array.isArray(table.rows) ? table.rows : [];
    const sampleRow = rows[0];
    const sampleKeys = sampleRow && typeof sampleRow === "object" && !Array.isArray(sampleRow) ? Object.keys(sampleRow) : [];
    let columns: any[] = [];

    if (Array.isArray(table.columns) && table.columns.length > 0) {
        columns = table.columns.map((col: any, index: number) => {
            if (typeof col === "string") {
                return { key: col, label: col };
            }
            if (col && typeof col === "object") {
                const colAny = col as any;
                const key = coerceColumnText(colAny.key ?? colAny.field ?? colAny.name ?? colAny.label, `col_${index + 1}`);
                const label = coerceColumnText(colAny.label ?? colAny.name ?? colAny.title ?? colAny.key, key);
                return { key, label };
            }
            const fallback = `col_${index + 1}`;
            return { key: fallback, label: fallback };
        });
    }

    if (sampleKeys.length > 0) {
        const columnKeys = new Set(columns.map((col) => col.key));
        const hasMatchingKeys = sampleKeys.some((key) => columnKeys.has(key));
        if (columns.length === 0 || !hasMatchingKeys) {
            columns = sampleKeys.map((key) => ({ key, label: key }));
        }
    }

    if (columns.length === 0) {
        columns = [{ key: "value", label: "Value" }];
    }

    const normalizedRows = rows.map((row: any) => {
        if (row && typeof row === "object" && !Array.isArray(row)) {
            const mapped: Record<string, any> = {};
            let hasMatch = false;
            columns.forEach((col) => {
                if (col.key in row) {
                    mapped[col.key] = normalizeRowValue(row[col.key]);
                    hasMatch = true;
                }
            });
            if (!hasMatch) {
                Object.entries(row).forEach(([key, value]) => {
                    mapped[key] = normalizeRowValue(value);
                });
            }
            return mapped;
        }
        if (Array.isArray(row)) {
            const mapped: Record<string, any> = {};
            columns.forEach((col, index) => {
                mapped[col.key] = normalizeRowValue(row[index]);
            });
            return mapped;
        }
        return { value: normalizeRowValue(row) } as Record<string, any>;
    });

    return { columns, rows: normalizedRows };
};

const TableCard = ({
    table,
    enableSearch = false,
    enableSort = false,
    enableCopy = false,
    freezeFirstColumn = false
}: {
    table: any;
    enableSearch?: boolean;
    enableSort?: boolean;
    enableCopy?: boolean;
    freezeFirstColumn?: boolean;
}) => {
    const { columns, rows } = normalizeTable(table);
    return (
        <div className="rounded border border-[#e4e4e4] bg-white p-3">
            {table.title && <div className="mb-2 text-sm font-semibold text-gray-800">{table.title}</div>}
            <KpiTable
                columns={columns}
                data={rows}
                itemsPerPage={table.ui_hints?.default_page_size ?? 10}
                defaultPageSize={table.ui_hints?.default_page_size}
                enableSearch={table.ui_hints?.enable_search ?? enableSearch}
                enableSort={enableSort}
                enableCopy={enableCopy}
                freezeFirstColumn={table.ui_hints?.freeze_first_column ?? freezeFirstColumn}
                compact={table.ui_hints?.compact ?? false}
                showEmptyStateInTable={true}
                emptyStateLabel="No rows"
            />
        </div>
    );
};

const EvidenceTabs = ({ block }: { block: any }) => {
    const tabs = (block.tabs ?? []).filter((tab: any) => tab.tab_id !== "fields_used");
    const defaultTab = tabs[0]?.tab_id ?? "data_preview";
    const [activeTab, setActiveTab] = useState(defaultTab);
    const tabData = tabs.map((tab: any) => [tab.tab_id, tab.label] as [string, string]);

    if (tabs.length === 0) {
        return <div className="rounded border border-[#e4e4e4] bg-white p-3 text-sm text-gray-500">No evidence available.</div>;
    }

    const renderContent = () => {
        const current = tabs.find((tab: any) => tab.tab_id === activeTab);
        if (!current) return null;
        if (current.tab_id === "data_preview" || current.tab_id === "fields_used") {
            return (
                <TableCard
                    table={current.content}
                    enableSearch={current.tab_id === "data_preview"}
                    enableSort={true}
                    enableCopy={current.tab_id === "data_preview"}
                    freezeFirstColumn={current.tab_id === "data_preview"}
                />
            );
        }
        if (current.tab_id === "source_tables") {
            const content = current.content;
            const nodes = content.nodes ?? [];
            const nodeMap = new Map(nodes.map((node: any) => [node.id, node]));
            const childIds = new Set(nodes.flatMap((node: any) => node.children ?? []));
            const roots = nodes.filter((node: any) => !childIds.has(node.id));
            const tableChips = nodes.filter((node: any) => node.kind === "table" || node.kind === "view");

            const renderNode = (node: any, depth = 0) => {
                const children = (node.children || []).map((id: string) => nodeMap.get(id)).filter(Boolean) as any[];
                return (
                    <div key={node.id} className="space-y-2">
                        <div className="flex items-center gap-2" style={{ marginLeft: depth * 12 }}>
                            <span className="text-xs uppercase tracking-wide text-gray-400">{node.kind}</span>
                            <span className="text-sm text-gray-800">{node.label}</span>
                        </div>
                        {children.length > 0 && (
                            <div className="space-y-2">
                                {children.map((child: any) => renderNode(child, depth + 1))}
                            </div>
                        )}
                    </div>
                );
            };

            return (
                <div className="space-y-3 rounded border border-[#e4e4e4] bg-white p-3">
                    {tableChips.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {tableChips.map((node: any) => (
                                <span key={node.id} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700">
                                    {node.label}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="space-y-2">
                        {roots.length > 0 ? roots.map((node: any) => renderNode(node)) : <div className="text-sm text-gray-500">No sources listed.</div>}
                    </div>
                </div>
            );
        }
        if (current.tab_id === "assumptions") {
            const content = current.content;
            return (
                <div className="rounded border border-[#e4e4e4] bg-white p-3">
                    {content.title && <div className="mb-2 text-sm font-semibold text-gray-800">{content.title}</div>}
                    <div className="space-y-2">
                        {(content.items ?? []).map((item: any, index: number) => (
                            <div key={`${item.key}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                                <span className="text-gray-500">{item.key}</span>
                                <span className="text-gray-800">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-3">
            <Tabs data={tabData} activeTab={activeTab} setActiveTab={(tab: any) => setActiveTab(tab as typeof activeTab)} />
            {renderContent()}
        </div>
    );
};

const AuditTrailPanel = ({ block }: { block: any }) => {
    const [isOpen, setIsOpen] = useState(!block.default_collapsed);

    return (
        <div className="rounded border border-[#e4e4e4] bg-white">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800"
            >
                <span>{block.title || "Audit trail"}</span>
                <span className="text-xs text-gray-400 cursor-pointer">{isOpen ? "Hide" : "Show"}</span>
            </button>
            {isOpen && (
                <div className="space-y-3 border-t border-[#e4e4e4] p-4">
                    {block.items.map((item: any, index: number) => {
                        if (item.kind === "sql") {
                            return (
                                <div key={`${item.label}-${index}`} className="rounded border border-gray-200 bg-gray-50 p-3">
                                    <div className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-800">
                                        <span>{item.label}</span>
                                        <button
                                            type="button"
                                            onClick={() => navigator.clipboard.writeText(item.sql)}
                                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600"
                                        >
                                            Copy SQL
                                        </button>
                                    </div>
                                    <pre className="whitespace-pre-wrap text-xs text-gray-700">{item.sql}</pre>
                                </div>
                            );
                        }
                        if (item.kind === "filters") {
                            return (
                                <div key={`${item.label}-${index}`} className="rounded border border-gray-200 bg-gray-50 p-3">
                                    <div className="mb-2 text-sm font-semibold text-gray-800">{item.label}</div>
                                    <div className="space-y-1 text-sm text-gray-700">
                                        {item.filters.map((filter: any, idx: number) => (
                                            <div key={`${filter.field}-${idx}`}>
                                                {filter.field} {filter.op} {filter.value}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        }
                        if (item.kind === "row_counts") {
                            return (
                                <div key={`${item.label}-${index}`} className="rounded border border-gray-200 bg-gray-50 p-3">
                                    <div className="mb-2 text-sm font-semibold text-gray-800">{item.label}</div>
                                    <div className="grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                                        {item.counts.map((count: any, idx: number) => (
                                            <div key={`${count.name}-${idx}`} className="flex items-center justify-between">
                                                <span>{count.name}</span>
                                                <span className="font-semibold text-gray-900">{count.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div key={`${item.label}-${index}`} className="rounded border border-gray-200 bg-gray-50 p-3">
                                <div className="mb-2 text-sm font-semibold text-gray-800">{item.label}</div>
                                <div className="text-sm text-gray-700">{item.text}</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const StatusBanner = ({ block }: { block: any }) => {
    const styles =
        block.severity === "error"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : block.severity === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-sky-200 bg-sky-50 text-sky-700";
    return (
        <div className={`rounded border px-3 py-2 text-xs ${styles}`}>
            <div className="font-semibold">{block.message}</div>
            {block.details && <div className="mt-1 text-[11px] text-gray-600">{block.details}</div>}
        </div>
    );
};

const InsightsSummaryCard = ({ block }: { block: any }) => {
    const findings = (block.key_findings || []).slice(0, 4);
    const findingsMarkdown = findings.map((finding: string) => `- ${finding}`).join("\n");
    const markdownComponents = {
        p: (props: any) => <p className="text-sm text-gray-700" {...props} />,
        ul: (props: any) => <ul className="list-disc pl-5 text-sm text-gray-700" {...props} />,
        li: (props: any) => <li className="text-sm text-gray-700" {...props} />,
        strong: (props: any) => <strong className="font-semibold text-gray-900" {...props} />
    };

    return (
        <div className="rounded border border-[#e4e4e4] bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-gray-800">Summary</div>
            {findings.length > 0 && (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {findingsMarkdown}
                </ReactMarkdown>
            )}
            {block.why_it_matters && (
                <div className="mt-3">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {block.why_it_matters}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
};

const RichTextCard = ({ block }: { block: any }) => {
    const markdownComponents = {
        h1: (props: any) => <h1 className="text-base font-semibold text-gray-900" {...props} />,
        h2: (props: any) => <h2 className="text-sm font-semibold text-gray-900" {...props} />,
        h3: (props: any) => <h3 className="text-sm font-semibold text-gray-800" {...props} />,
        p: (props: any) => <p className="text-sm text-gray-700" {...props} />,
        ul: (props: any) => <ul className="list-disc pl-5 text-sm text-gray-700" {...props} />,
        ol: (props: any) => <ol className="list-decimal pl-5 text-sm text-gray-700" {...props} />,
        li: (props: any) => <li className="text-sm text-gray-700" {...props} />,
        strong: (props: any) => <strong className="font-semibold text-gray-900" {...props} />,
        blockquote: (props: any) => <blockquote className="border-l-2 border-gray-200 pl-3 text-sm text-gray-600" {...props} />
    };

    return (
        <div className="rounded border border-[#e4e4e4] bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-gray-800">{block.title || "Summary"}</div>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {block.markdown}
            </ReactMarkdown>
        </div>
    );
};

const TilesStrip = ({ block }: { block: any }) => {
    const markdownComponents = {
        p: (props: any) => <span {...props} />,
        strong: (props: any) => <strong className="font-semibold text-gray-900" {...props} />,
        em: (props: any) => <em className="text-gray-900" {...props} />,
    };
    return (
        <div className="rounded border border-[#e4e4e4] bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-gray-500">{block.title || "At a glance"}</div>
            <div className="flex flex-wrap gap-3">
                {block.tiles.map((tile: any, index: number) => (
                    <div key={`${tile.label}-${index}`} className="min-w-[160px] flex-1 rounded border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="text-[11px] uppercase text-gray-500">{tile.label}</div>
                        <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-gray-900">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                {tile.value != null ? String(tile.value) : ""}
                            </ReactMarkdown>
                            {trendBadge(tile.trend)}
                        </div>
                        {tile.subvalue && <div className="text-xs text-gray-500">{tile.subvalue}</div>}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ActionBar = ({ actions }: { actions: Array<NextAction | string> }) => {
    const { appendMessage, isLoading } = useCopilotChat();
    const normalizedActions = useMemo(() => {
        return actions
            .map((action, index) => {
                if (typeof action === "string") {
                    const label = action.trim();
                    if (!label) return null;
                    return { id: `action_${index + 1}`, label, prompt: label };
                }
                if (!action) return null;
                const label = action.label || action.prompt || `Action ${index + 1}`;
                const prompt = action.prompt || action.label || label;
                return { id: (action as any).action_id || `action_${index + 1}`, label, prompt };
            })
            .filter(Boolean) as Array<{ id: string; label: string; prompt: string }>;
    }, [actions]);

    const handleClick = useCallback(
        async (prompt: string) => {
            if (!prompt || isLoading) return;
            await appendMessage(
                new TextMessage({
                    content: prompt,
                    role: Role.User
                })
            );
        },
        [appendMessage, isLoading]
    );

    if (!normalizedActions.length) return null;
    return (
        <div className="rounded border border-[#e4e4e4] bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-gray-500">Next best actions</div>
            <div className="flex flex-wrap gap-2">
                {normalizedActions.map((action) => (
                    <button
                        key={action.id}
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

const computeEvidenceSummary = (block?: any) => {
    if (!block) return { tables: 0 };
    const sourceTab = block.tabs.find((tab: any) => tab.tab_id === "source_tables");
    const nodes = sourceTab ? (sourceTab.content as any).nodes ?? [] : [];
    const tables = new Set(nodes.filter((node: any) => node.kind === "table" || node.kind === "view").map((node: any) => node.id));
    return { tables: tables.size };
};

const normalizeTableColumns = (columns?: any) => {
    if (!Array.isArray(columns)) return [];
    return columns.map((column) => ({
        key: column?.key ?? "",
        label: column?.label ?? column?.key ?? ""
    }));
};

const normalizeTableRows = (rows?: any) => {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
        if (!row || typeof row !== "object") return [];
        return Object.keys(row)
            .sort()
            .map((key) => [key, row[key] ?? null] as const);
    });
};

const tablesMatch = (left?: any, right?: any) => {
    if (!left || !right) return false;
    const leftColumns = normalizeTableColumns(left.columns);
    const rightColumns = normalizeTableColumns(right.columns);
    if (leftColumns.length !== rightColumns.length) return false;
    for (let idx = 0; idx < leftColumns.length; idx += 1) {
        if (leftColumns[idx].key !== rightColumns[idx].key || leftColumns[idx].label !== rightColumns[idx].label) {
            return false;
        }
    }
    const leftRows = normalizeTableRows(left.rows);
    const rightRows = normalizeTableRows(right.rows);
    if (leftRows.length !== rightRows.length) return false;
    for (let rowIndex = 0; rowIndex < leftRows.length; rowIndex += 1) {
        if (leftRows[rowIndex].length !== rightRows[rowIndex].length) return false;
        for (let colIndex = 0; colIndex < leftRows[rowIndex].length; colIndex += 1) {
            const [leftKey, leftValue] = leftRows[rowIndex][colIndex];
            const [rightKey, rightValue] = rightRows[rowIndex][colIndex];
            if (leftKey !== rightKey || !Object.is(leftValue, rightValue)) {
                return false;
            }
        }
    }
    return true;
};

const StructuredMessageRenderer = ({
    payload,
    charts
}: {
    payload: any;
    charts?: ChartSpec[];
}) => {
    const responseTime = useMemo(() => formatShortDate(new Date().toISOString()), []);
    const blocks = payload.blocks || [];
    const header = blocks.find((block: any) => block.type === "header") as any;
    const tiles = blocks.find((block: any) => block.type === "tiles") as any;
    const statusBlocks = blocks.filter((block: any) => block.type === "status") as any[];
    const chartBlocks = blocks.filter((block: any) => block.type === "chart") as any[];
    const tableBlocks = blocks.filter((block: any) => block.type === "table") as any[];
    const insightsSummary = blocks.find((block: any) => block.type === "insights_summary" || block.type === "what_it_means") as any;
    const richText = blocks.find((block: any) => block.type === "rich_text") as any;
    const evidence = blocks.find((block: any) => block.type === "evidence") as any;
    const audit = blocks.find((block: any) => block.type === "audit_trail") as any;
    const shortText = blocks.find((block: any) => block.type === "short_text") as any;
    const discoveryShortText =
        payload.intent === "discovery"
            ? shortText?.text || payload.subtitle || "Here are suggested analyses based on the available data."
            : undefined;

    const chartSpecs = chartBlocks
        .map((block, index) => buildChartSpec(block, index))
        .filter(Boolean) as ChartSpec[];
    const fallbackCharts = Array.isArray(charts) ? charts : [];
    const effectiveCharts = chartSpecs.length > 0 ? chartSpecs : fallbackCharts;
    const primaryChartBlock = chartSpecs.length > 0 ? chartBlocks.find((block) => mapChartType(block.chart_type) !== "table_chart") : undefined;
    const tableChartBlocks = chartBlocks.filter((block) => block.chart_type === "table_chart");
    const fallbackDiscoveryTable = useMemo(() => {
        if (payload.intent !== "discovery") return undefined;
        const actions = Array.isArray(payload.next_actions) ? payload.next_actions : [];
        const rows = actions
            .map((action: NextAction | string) => {
                if (!action) return null;
                const label = typeof action === "string" ? action.trim() : String((action as NextAction).label || (action as NextAction).prompt || "").trim();
                if (!label) return null;
                return { analysis: label, required_tables: "", why: "Based on available schema" };
            })
            .filter(Boolean) as Array<{ analysis: string; required_tables: string; why: string }>;
        if (rows.length === 0) return undefined;
            return {
                type: "table",
                title: "Suggested analyses",
                columns: [
                    { key: "analysis", label: "Analysis" },
                    { key: "required_tables", label: "Required tables" },
                    { key: "why", label: "Why it matters" }
                ],
                rows,
                ui_hints: { enable_search: true, default_page_size: 5, freeze_first_column: true }
            } as any;
    }, [payload.intent, payload.next_actions]);
    const fallbackEvidenceTable = useMemo(() => {
        if (!evidence) return undefined;
        const dataTab = (evidence.tabs || []).find((tab: any) => tab.tab_id === "data_preview");
        if (!dataTab || !dataTab.content || dataTab.content.type !== "table") return undefined;
        const table = dataTab.content as any;
        return {
            ...table,
            title: table.title || "Data preview"
        };
    }, [evidence]);
    const visibleTableBlocks = useMemo(() => {
        if (!fallbackEvidenceTable) return tableBlocks;
        const nonPreviewTables = tableBlocks.filter((table) => !tablesMatch(table, fallbackEvidenceTable));
        const shouldDropPreviewTables = effectiveCharts.length > 0 || nonPreviewTables.length > 0;
        return shouldDropPreviewTables ? nonPreviewTables : tableBlocks;
    }, [tableBlocks, fallbackEvidenceTable, effectiveCharts.length]);
    const primaryTableBlock =
        chartSpecs.length === 0 && effectiveCharts.length === 0
            ? visibleTableBlocks[0] || fallbackDiscoveryTable || fallbackEvidenceTable
            : undefined;
    const mainTableBlock =
        chartSpecs.length === 0 && effectiveCharts.length === 0 && !primaryTableBlock ? tableChartBlocks[0] : undefined;
    const extraTables: any[] = chartSpecs.length === 0 && effectiveCharts.length === 0
        ? visibleTableBlocks.slice(primaryTableBlock ? 1 : 0).concat(tableChartBlocks.slice(mainTableBlock ? 1 : 0) as any)
        : visibleTableBlocks.concat(tableChartBlocks as any);
    const evidenceSummary = computeEvidenceSummary(evidence);
    const tablesUsedLabel = `${evidenceSummary.tables} ${evidenceSummary.tables === 1 ? "table" : "tables"}`;
    const [activeChartIndex, setActiveChartIndex] = useState(0);

    useEffect(() => {
        if (effectiveCharts.length === 0) {
            setActiveChartIndex(0);
            return;
        }
        setActiveChartIndex((current) => (current >= effectiveCharts.length ? 0 : current));
    }, [effectiveCharts.length]);

    const activeChart = effectiveCharts[activeChartIndex] ?? effectiveCharts[0];

    return (
        <div className="space-y-4">
            <div className="rounded border border-[#e4e4e4] bg-white px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <div className="text-sm font-semibold text-gray-900">{header?.title || payload.title}</div>
                        {payload.subtitle && <div className="text-xs text-gray-500">{payload.subtitle}</div>}
                        {header?.context_chips && header.context_chips.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {header.context_chips.map((chip: string) => (
                                    <span key={chip} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
                                        {chip}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="text-xs text-gray-500">Response Datetime: {responseTime}</div>
                </div>
            </div>

            {statusBlocks.length > 0 && (
                <div className="space-y-2">
                    {statusBlocks.map((block, index) => (
                        <StatusBanner key={`${block.message}-${index}`} block={block} />
                    ))}
                </div>
            )}

            {tiles && tiles.tiles?.length > 0 && <TilesStrip block={tiles} />}

            {payload.intent === "short_answer" && shortText ? (
                <div className="rounded border border-[#e4e4e4] bg-white p-4 text-sm text-gray-700">{shortText.text}</div>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className={`space-y-3 ${payload.intent === "analytics_report" ? "lg:col-span-2" : "lg:col-span-3"}`}>
                        {discoveryShortText && payload.intent === "discovery" && (
                            <div className="rounded border border-[#e4e4e4] bg-white p-4 text-sm text-gray-700">{discoveryShortText}</div>
                        )}
                        {effectiveCharts.length > 0 && (
                            <div className="rounded border border-[#e4e4e4] bg-white p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        {primaryChartBlock?.subtitle && <div className="mb-2 text-xs text-gray-500">{primaryChartBlock.subtitle}</div>}
                                    </div>
                                    {effectiveCharts.length > 1 && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setActiveChartIndex((current) => Math.max(0, current - 1))}
                                                disabled={activeChartIndex === 0}
                                                aria-label="Previous chart"
                                                className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {"<"}
                                            </button>
                                            <div className="text-xs text-gray-500">
                                                {activeChartIndex + 1}/{effectiveCharts.length}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setActiveChartIndex((current) => Math.min(effectiveCharts.length - 1, current + 1))}
                                                disabled={activeChartIndex >= effectiveCharts.length - 1}
                                                aria-label="Next chart"
                                                className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {">"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {activeChart && <ChartContainer charts={[activeChart]} showItemActions={false} />}
                            </div>
                        )}
                        {effectiveCharts.length === 0 && primaryTableBlock && (
                            <TableCard
                                table={primaryTableBlock}
                                enableSearch={true}
                                enableSort={true}
                                enableCopy={true}
                                freezeFirstColumn={true}
                            />
                        )}
                        {effectiveCharts.length === 0 && mainTableBlock && (
                            <TableCard
                                table={{
                                    type: "table",
                                    title: mainTableBlock.title || mainTableBlock.spec?.y?.label || "Data table",
                                    columns: [],
                                    rows: mainTableBlock.data_ref.inline_rows ?? []
                                }}
                                enableSearch={true}
                                enableSort={true}
                                enableCopy={true}
                                freezeFirstColumn={true}
                            />
                        )}
                    </div>
                    {payload.intent === "analytics_report" && (
                        <div className="space-y-3">
                            {richText ? (
                                <RichTextCard block={richText} />
                            ) : insightsSummary ? (
                                <InsightsSummaryCard block={insightsSummary} />
                            ) : (
                                <div className="rounded border border-[#e4e4e4] bg-white p-4 text-sm text-gray-500">Insights will appear here once available.</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {extraTables.length > 0 && (
                <div className="space-y-3">
                    {extraTables.map((table, index) => (
                        <TableCard key={`${table.title || "table"}-${index}`} table={table} enableSearch={true} enableSort={true} enableCopy={true} freezeFirstColumn={true} />
                    ))}
                </div>
            )}

            {payload.intent !== "discovery" && evidence && (
                <details className="rounded border border-[#e4e4e4] bg-white" open={!evidence.default_collapsed}>
                    <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800">
                        <span>{`Show evidence (${tablesUsedLabel})`}</span>
                    </summary>
                    <div className="border-t border-[#e4e4e4] p-4">
                        <EvidenceTabs block={evidence} />
                    </div>
                </details>
            )}

            {audit && <AuditTrailPanel block={audit} />}

            <ActionBar actions={payload.next_actions} />
        </div>
    );
};

export default StructuredMessageRenderer;
