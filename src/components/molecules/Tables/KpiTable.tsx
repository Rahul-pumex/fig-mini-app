import React, { useState, useMemo } from "react";
import { inter } from "@/assets/fonts/inter";

interface Column {
    key: string;
    label: string;
}

interface KpiTableProps {
    columns: Column[];
    data: Record<string, any>[];
    itemsPerPage?: number;
    defaultPageSize?: number;
    enableSearch?: boolean;
    enableSort?: boolean;
    enableCopy?: boolean;
    freezeFirstColumn?: boolean;
    compact?: boolean;
    showEmptyStateInTable?: boolean;
    emptyStateLabel?: string;
}

const KpiTable: React.FC<KpiTableProps> = ({
    columns,
    data,
    itemsPerPage = 10,
    defaultPageSize,
    enableSearch = false,
    enableSort = false,
    enableCopy = false,
    freezeFirstColumn = false,
    compact = false,
    showEmptyStateInTable = false,
    emptyStateLabel = "No rows"
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize ?? itemsPerPage);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [copied, setCopied] = useState(false);

    const filteredData = useMemo(() => {
        if (!enableSearch || !search.trim() || columns.length === 0) return data;
        const query = search.trim().toLowerCase();
        return data.filter((row) =>
            columns.some((col) => String(row[col.key] ?? "").toLowerCase().includes(query))
        );
    }, [columns, data, enableSearch, search]);

    const sortedData = useMemo(() => {
        if (!enableSort || !sortKey) return filteredData;
        const sorted = [...filteredData];
        sorted.sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
            }
            const aStr = String(aVal).toLowerCase();
            const bStr = String(bVal).toLowerCase();
            if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
            if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [enableSort, filteredData, sortDirection, sortKey]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return sortedData.slice(startIndex, endIndex);
    }, [sortedData, currentPage, pageSize]);

    const totalPages = Math.ceil(sortedData.length / pageSize);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handlePageSizeChange = (newPageSize: number) => {
        setPageSize(newPageSize);
        setCurrentPage(1); // Reset to first page when changing page size
    };

    const handleSort = (key: string) => {
        if (!enableSort) return;
        if (sortKey === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
        setCurrentPage(1);
    };

    const handleCopy = async () => {
        if (!enableCopy) return;
        const rows = sortedData.length > 0 ? sortedData : [];
        const header = columns.map((col) => col.label).join("\t");
        const body = rows
            .map((row) => columns.map((col) => String(row[col.key] ?? "")).join("\t"))
            .join("\n");
        const payload = [header, body].filter(Boolean).join("\n");
        try {
            await navigator.clipboard.writeText(payload);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    const getPageNumbers = () => {
        const pages: number[] = [];
        const maxVisiblePages = 5;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }
        }

        return pages;
    };

    const cellPadding = compact ? "px-2 py-1 text-xs" : "px-4 py-2 text-sm";
    const headerPadding = compact ? "px-2 py-1 text-xs" : "px-4 py-2 text-sm";
    const hasRows = sortedData.length > 0;
    const showTable = hasRows || showEmptyStateInTable;
    return (
        <div className="w-full overflow-x-auto">
            {(enableSearch || enableCopy) && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    {enableSearch && (
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search"
                            className={`${inter.className} w-full max-w-xs rounded border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none`}
                        />
                    )}
                    {enableCopy && (
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={`${inter.className} rounded border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50`}
                        >
                            {copied ? "Copied" : "Copy"}
                        </button>
                    )}
                </div>
            )}

            {showTable ? (
                <table className="w-full border-collapse rounded border-2 border-[#e4e4e4] bg-white">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            {columns.map((col, index) => {
                                const isFrozen = freezeFirstColumn && index === 0;
                                const isActiveSort = enableSort && sortKey === col.key;
                                return (
                                <th
                                    key={col.key}
                                    onClick={() => handleSort(col.key)}
                                    className={`${inter.className} border-r border-gray-200 bg-[#F7F7F7] ${headerPadding} text-left font-medium text-gray-700 last:border-r-0 ${
                                        enableSort ? "cursor-pointer select-none" : ""
                                    } ${isFrozen ? "sticky left-0 z-10" : ""}`}
                                >
                                    <div className="flex items-center gap-1">
                                        <span>{col.label}</span>
                                        {isActiveSort && <span className="text-[10px]">{sortDirection === "asc" ? "▲" : "▼"}</span>}
                                    </div>
                                </th>
                            );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {hasRows ? (
                            paginatedData.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-b border-gray-200 transition-colors hover:bg-gray-50">
                                {columns.map((col, index) => {
                                    const isFrozen = freezeFirstColumn && index === 0;
                                    return (
                                    <td
                                        key={col.key}
                                        className={`${inter.className} border-r border-gray-200 ${cellPadding} text-gray-900 last:border-r-0 ${
                                            isFrozen ? "sticky left-0 bg-white" : ""
                                        }`}
                                    >
                                        {row[col.key] !== undefined ? row[col.key] : "-"}
                                    </td>
                                );
                                })}
                            </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={Math.max(columns.length, 1)} className={`${inter.className} ${cellPadding} text-center text-gray-500`}>
                                    {emptyStateLabel}
                                </td>
                            </tr>
                        )}
                    </tbody>

                    {/* Pagination */}
                    {hasRows && (
                        <tfoot>
                            <tr>
                                <td colSpan={columns.length} className="border-t border-gray-200 bg-white px-4 py-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <div className={`${inter.className} text-sm text-gray-700`}>
                                                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of{" "}
                                                {sortedData.length} results
                                            </div>

                                            {/* Page size selector */}
                                            <div className="flex items-center space-x-2">
                                                <span className={`${inter.className} text-sm text-gray-700`}>Show:</span>
                                                <select
                                                    value={pageSize}
                                                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                                    className={`${inter.className} rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:outline-none`}
                                                >
                                                    <option value={5}>5</option>
                                                    <option value={10}>10</option>
                                                    <option value={25}>25</option>
                                                    <option value={50}>50</option>
                                                    <option value={100}>100</option>
                                                </select>
                                                <span className={`${inter.className} text-sm text-gray-700`}>per page</span>
                                            </div>
                                        </div>

                                        {totalPages > 1 && (
                                            <div className="flex items-center space-x-1">
                                                {/* Previous button */}
                                                <button
                                                    onClick={() => handlePageChange(currentPage - 1)}
                                                    disabled={currentPage === 1}
                                                    className={`${inter.className} rounded border border-gray-200 bg-white px-3 py-1 text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50`}
                                                >
                                                    Previous
                                                </button>

                                                {/* Page numbers */}
                                                {getPageNumbers().map((page) => (
                                                    <button
                                                        key={page}
                                                        onClick={() => handlePageChange(page)}
                                                        className={`${inter.className} rounded border border-gray-200 px-3 py-1 text-sm transition-colors ${
                                                            currentPage === page
                                                                ? "bg-gray-100 font-medium text-gray-900"
                                                                : "bg-white text-gray-700 hover:bg-gray-50"
                                                        }`}
                                                    >
                                                        {page}
                                                    </button>
                                                ))}

                                                {/* Next button */}
                                                <button
                                                    onClick={() => handlePageChange(currentPage + 1)}
                                                    disabled={currentPage === totalPages}
                                                    className={`${inter.className} rounded border border-gray-200 bg-white px-3 py-1 text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50`}
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            ) : (
                <div className="flex items-center justify-center py-8 text-gray-500">No data available</div>
            )}
        </div>
    );
};

export default KpiTable;

