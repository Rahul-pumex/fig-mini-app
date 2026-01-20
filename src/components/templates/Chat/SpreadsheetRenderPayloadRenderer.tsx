/**
 * SpreadsheetRenderPayloadRenderer
 *
 * Renders markdown tables optimized for copy/paste into Excel, Google Sheets, etc.
 * Used when client_type is "spreadsheet" and state.render_spreadsheet is available.
 */

import React, { useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExportTableButton } from "@/components/atoms/ExportTableButton";
import type { SpreadsheetRenderPayload } from "@/types";

interface SpreadsheetRenderPayloadRendererProps {
    payload: SpreadsheetRenderPayload;
}

const markdownComponents = {
    table: (props: any) => (
        <table
            className="my-4 w-full border-collapse text-black"
            style={{ borderSpacing: 0 }}
            {...props}
        />
    ),
    th: (props: any) => (
        <th
            className="bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-black"
            style={{ border: "1px solid #e4e4e4" }}
            {...props}
        />
    ),
    td: (props: any) => (
        <td
            className="px-3 py-2 text-sm text-black"
            style={{ border: "1px solid #e4e4e4" }}
            {...props}
        />
    ),
    tr: (props: any) => <tr className="hover:bg-white" {...props} />,
    tbody: (props: any) => <tbody {...props} />,
    p: (props: any) => <p className="text-sm text-black my-2" {...props} />,
};

// ============================================================================
// Table Card Component
// ============================================================================
interface MarkdownTable {
    table_id: string;
    title?: string;
    markdown: string;
    sql?: string;
    row_count?: number;
}

const TableCard: React.FC<{ table: MarkdownTable }> = ({ table }) => {
    const [showSql, setShowSql] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyTable = useCallback(async () => {
        try {
            // Copy the markdown table to clipboard
            await navigator.clipboard.writeText(table.markdown);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy table:", err);
        }
    }, [table.markdown]);

    // Clean markdown to remove heading if it matches the table title
    const cleanedMarkdown = useMemo(() => {
        if (!table.title) return table.markdown;
        
        // Remove markdown headings (###, ##, #) that match the table title
        const titleLower = table.title.toLowerCase().trim();
        const lines = table.markdown.split('\n');
        const cleanedLines: string[] = [];
        
        for (const line of lines) {
            // Check if line is a markdown heading (starts with #)
            const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
            if (headingMatch) {
                const headingText = headingMatch[1].trim().toLowerCase();
                // Skip this heading if it matches the table title
                if (headingText === titleLower) {
                    continue; // Don't add this line
                }
            }
            cleanedLines.push(line);
        }
        
        return cleanedLines.join('\n').trim();
    }, [table.markdown, table.title]);

    // Parse markdown table to rows for export
    const exportRows = useMemo(() => {
        try {
            const lines = table.markdown.trim().split('\n').filter(line => line.trim());
            
            // Filter to only include actual table rows (must start and end with |)
            // Also exclude separator lines (the one with --- )
            const tableRows = lines.filter(line => {
                const trimmed = line.trim();
                // Must start with | and end with |
                if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
                    return false;
                }
                // Exclude separator lines (containing only |, -, :, spaces)
                if (trimmed.match(/^\|[\s\-:|]+\|$/)) {
                    return false;
                }
                return true;
            });
            
            if (tableRows.length === 0) {
                console.warn("No valid table rows found in markdown");
                return [];
            }
            
            // Parse each table row
            const parsedRows = tableRows.map(line => {
                // Split by | and clean up
                const cells = line.split('|')
                    .slice(1, -1) // Remove empty first and last elements from split
                    .map(cell => cell.trim());
                
                // Filter out empty rows
                if (cells.length === 0 || cells.every(cell => !cell)) {
                    return null;
                }
                
                return cells;
            }).filter((row): row is string[] => row !== null && row.length > 0);
            
            if (parsedRows.length === 0) {
                console.warn("No valid data rows after parsing");
                return [];
            }
            
            // Validate that all rows have the same number of columns
            const columnCount = parsedRows[0]?.length || 0;
            if (columnCount === 0) {
                console.warn("First row has no columns");
                return [];
            }
            
            // Filter out rows with mismatched column counts (likely parsing errors)
            const validRows = parsedRows.filter(row => row.length === columnCount);
            
            if (validRows.length === 0) {
                console.warn("No rows with valid column count");
                return [];
            }
            
            return validRows;
        } catch (err) {
            console.error("Failed to parse markdown table:", err);
            return [];
        }
    }, [table.markdown]);

    return (
        <>
            {/* Table Card - with border */}
            <div className="mb-6 rounded border border-[#e4e4e4] bg-white">
                {/* Table Header */}
                <div className="border-b border-[#e4e4e4] px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            {table.title && (
                                <div className="text-sm font-semibold text-gray-900">{table.title}</div>
                            )}
                            {table.row_count !== undefined && (
                                <div className="mt-1 text-xs text-gray-500">
                                    {table.row_count} {table.row_count === 1 ? "row" : "rows"}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {table.sql && (
                                <button
                                    type="button"
                                    onClick={() => setShowSql(!showSql)}
                                    className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                                >
                                    {showSql ? "Hide SQL" : "Show SQL"}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleCopyTable}
                                className={`rounded border px-3 py-1.5 text-xs ${
                                    copied
                                        ? "border-green-500 bg-green-50 text-green-700"
                                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                }`}
                            >
                                {copied ? "✓ Copied" : "Copy Table"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* SQL Query (collapsible) */}
                {showSql && table.sql && (
                    <div className="border-b border-[#e4e4e4] bg-gray-50 px-4 py-3">
                        <div className="text-xs font-medium text-gray-600 mb-1">SQL Query:</div>
                        <pre className="overflow-x-auto rounded bg-white p-2 text-xs text-gray-800">
                            <code>{table.sql}</code>
                        </pre>
                    </div>
                )}

                {/* Markdown Table */}
                <div className="overflow-x-auto p-4">
                    <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                            {cleanedMarkdown}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>

            {/* Export Button - Outside table card, below footer, right-aligned */}
            {exportRows.length > 0 && (
                <div className="flex justify-end mb-6" style={{ overflow: 'hidden', minWidth: 0 }}>
                    <div style={{ 
                        overflow: 'visible', 
                        transform: 'translateZ(0)',
                        // Add padding to accommodate scale transform without triggering parent overflow
                        padding: '2px'
                    }}>
                        <ExportTableButton
                            tableId={`spreadsheet-table-${table.table_id}`}
                            tableName={table.title || "Table"}
                            rows={exportRows}
                            size="sm"
                        />
                    </div>
                </div>
            )}
        </>
    );
};

// ============================================================================
// Main Renderer Component
// ============================================================================
const SpreadsheetRenderPayloadRenderer: React.FC<SpreadsheetRenderPayloadRendererProps> = ({
    payload,
}) => {
    const [copiedAll, setCopiedAll] = useState(false);

    const handleCopyAllTables = useCallback(async () => {
        try {
            // Combine all markdown tables with spacing
            const allTables = payload.tables.map((table) => {
                let text = "";
                if (table.title) {
                    text += `${table.title}\n\n`;
                }
                text += table.markdown;
                if (table.row_count !== undefined) {
                    text += `\n\n(${table.row_count} ${table.row_count === 1 ? "row" : "rows"})`;
                }
                return text;
            });
            const combinedText = allTables.join("\n\n---\n\n");

            await navigator.clipboard.writeText(combinedText);
            setCopiedAll(true);
            setTimeout(() => setCopiedAll(false), 2000);
        } catch (err) {
            console.error("Failed to copy all tables:", err);
        }
    }, [payload.tables]);

    if (!payload || !payload.tables || payload.tables.length === 0) {
        return null;
    }

    return (
        <div className="w-full">
            {/* Summary (if provided) */}
            {payload.summary && (
                <div className="mb-4 rounded border border-[#e4e4e4] bg-white px-4 py-3">
                    <div className="text-sm text-gray-700">{payload.summary}</div>
                </div>
            )}

            {/* Copy All Button (if multiple tables) */}
            {payload.tables.length > 1 && (
                <div className="mb-4 flex justify-end">
                    <button
                        type="button"
                        onClick={handleCopyAllTables}
                        className={`rounded border px-4 py-2 text-sm font-medium ${
                            copiedAll
                                ? "border-green-500 bg-green-50 text-green-700"
                                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                        {copiedAll ? "✓ All Tables Copied" : "Copy All Tables"}
                    </button>
                </div>
            )}

            {/* Render Tables */}
            <div>
                {payload.tables.map((table) => (
                    <TableCard key={table.table_id} table={table} />
                ))}
            </div>
        </div>
    );
};

export default SpreadsheetRenderPayloadRenderer;

