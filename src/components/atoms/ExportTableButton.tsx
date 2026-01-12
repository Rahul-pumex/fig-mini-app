/**
 * ExportTableButton Component
 * 
 * Reusable button component for exporting tables to Google Sheets.
 * Uses the useTableExport hook internally.
 */

import React from 'react';
import { useTableExport } from '../../hooks/useTableExport';

interface ExportTableButtonProps {
    tableId: string;
    tableName?: string;
    rows: string[][];
    className?: string;
    size?: 'sm' | 'md';
}

export const ExportTableButton: React.FC<ExportTableButtonProps> = ({
    tableId,
    tableName = 'Table',
    rows,
    className = '',
    size = 'sm'
}) => {
    const { exportTable, isExporting } = useTableExport();

    const handleExport = () => {
        exportTable({ tableName, rows }, tableId);
    };

    const sizeClasses = size === 'sm' 
        ? 'text-xs px-2 py-1' 
        : 'text-sm px-3 py-1.5';

    return (
        <button
            type="button"
            onClick={handleExport}
            disabled={isExporting(tableId)}
            className={`inline-flex items-center gap-1.5 rounded-md bg-black font-semibold text-white transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70 ${sizeClasses} ${className}`}
        >
            {isExporting(tableId) ? "Exporting…" : "Export to Sheet"}
        </button>
    );
};

