/**
 * useTableExport Hook
 * 
 * Reusable hook for exporting table data to Google Sheets via postMessage.
 * Can be used in any component that renders tables.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFigAgent } from './index';
import Swal from 'sweetalert2';

interface ExportTableOptions {
    tableName?: string;
    rows: string[][];
}

export const useTableExport = () => {
    const { threadInfo } = useFigAgent();
    const [exportingTableId, setExportingTableId] = useState<string | null>(null);
    const exportTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Listen for write response from Google Sheets
    useEffect(() => {
        const handleWriteResponse = (event: MessageEvent) => {
            if (event.data && event.data.type === 'WRITE_SHEET_RESPONSE' && event.data.source === 'google-sheets') {
                if (exportTimeoutRef.current) {
                    clearTimeout(exportTimeoutRef.current);
                    exportTimeoutRef.current = null;
                }

                setExportingTableId(null);

                const payload = event.data.payload;

                if (payload && payload.success) {
                    console.log(`✓ Successfully wrote table to Google Sheets!`);
                    
                    // Show success toast notification
                    Swal.fire({
                        title: 'Exported Successfully!',
                        icon: 'success',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000,
                        timerProgressBar: true,
                        width: 'auto'
                    });
                } else {
                    const errorMessage = payload?.message || payload?.error || 'Unknown error';
                    const isPermissionError = errorMessage.includes('PERMISSION_DENIED') || 
                                             errorMessage.includes('permission') ||
                                             errorMessage.includes('authorization') ||
                                             errorMessage.includes('access denied');
                    
                    console.error(`✗ Failed to write to Google Sheets: ${errorMessage}`);
                    
                    if (isPermissionError) {
                        // Show permission error as a modal (needs user action)
                        Swal.fire({
                            title: 'Permission Required',
                            html: `
                                <div style="text-align: left; font-size: 14px;">
                                    <p>The Google Sheets add-on needs permission to write data.</p>
                                    <br>
                                    <p>Please contact your administrator to grant permission.</p>
                                </div>
                            `,
                            icon: 'warning',
                            confirmButtonColor: '#1a1a1a',
                            confirmButtonText: 'OK',
                            width: '400px'
                        });
                    } else {
                        // Just log error, don't show notification for other errors
                        console.error('Export failed:', errorMessage);
                    }
                }
            }
        };

        window.addEventListener('message', handleWriteResponse);

        return () => {
            window.removeEventListener('message', handleWriteResponse);
            if (exportTimeoutRef.current) {
                clearTimeout(exportTimeoutRef.current);
            }
        };
    }, []);

    const exportTable = useCallback((options: ExportTableOptions, tableId: string) => {
        const { tableName = 'Table', rows } = options;

        if (exportingTableId !== null) {
            console.warn("Export already in progress, please wait...");
            return;
        }

        if (!rows || rows.length === 0) {
            console.warn("No data to export");
            return;
        }

        const tablePayload = [{
            name: tableName,
            rows
        }];

        console.log("📊 Extracting table data for Sheet export:", {
            tableName,
            rowCount: rows.length,
            columnCount: rows[0]?.length || 0,
            data: rows,
            tablePayload: tablePayload
        });

        const message = {
            type: "WRITE_SHEET_DATA",
            source: "omniscop-chat",
            payload: {
                tables: tablePayload,
                threadId: threadInfo?.threadId || null
            }
        };

        if (typeof window !== "undefined" && window.parent && window.parent !== window) {
            if (exportTimeoutRef.current) {
                clearTimeout(exportTimeoutRef.current);
            }

            setExportingTableId(tableId);
            window.parent.postMessage(message, "*");

            exportTimeoutRef.current = setTimeout(() => {
                console.warn("Export timeout - resetting state");
                setExportingTableId(null);
                exportTimeoutRef.current = null;
            }, 5000);
        } else {
            console.warn("Cannot export: not running inside the expected host/iframe.");
        }
    }, [exportingTableId, threadInfo?.threadId]);

    const isExporting = useCallback((tableId: string) => {
        return exportingTableId === tableId;
    }, [exportingTableId]);

    return {
        exportTable,
        isExporting,
        exportingTableId
    };
};




