// ChartContainer for mini app - using Plotly (matching main app)
"use client";
import { ChartSpec } from "@/types";
import { renderChartByType } from "./chartBreakdowns";
import { useEffect, useRef } from "react";

interface ChartContainerProps {
    charts: ChartSpec[];
    showItemActions?: boolean;
}

// Responsive container that observes width changes and triggers Plotly relayout
function ResponsiveChartContainer({
    children,
    onGraphDiv
}: {
    children: (onDiv: (el: any) => void) => React.ReactNode;
    onGraphDiv?: (el: any) => void;
}) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const graphRef = useRef<any>(null);
    
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w = entry.contentRect.width;
                if (graphRef.current && (window as any).Plotly) {
                    try {
                        (window as any).Plotly.relayout(graphRef.current, { width: w });
                    } catch {}
                }
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    
    const handleGraphDiv = (div: any) => {
        graphRef.current = div;
        onGraphDiv?.(div);
    };
    
    return (
        <div ref={wrapperRef} className="relative max-h-[400px] w-full overflow-hidden">
            {children(handleGraphDiv)}
        </div>
    );
}

export const ChartContainer = ({ charts, showItemActions = false }: ChartContainerProps) => {
    if (!charts || charts.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="grid w-full grid-cols-1 gap-5 text-sm">
                {charts.map((spec) => {
                    // Extract title from chart options (matching main app)
                    const chartTitle = spec.options?.plugins?.title?.text ?? spec.chart_id;
                    
                    return (
                        <div 
                            key={spec.chart_id} 
                            className="relative w-full min-w-0 rounded bg-white p-3 transition-all duration-150 hover:bg-[#faf5f8]"
                        >
                            <h4 className="mb-1 text-sm font-semibold">{chartTitle}</h4>
                            <ResponsiveChartContainer onGraphDiv={() => {}}>
                                {(onDiv) => renderChartByType(spec, { showModeBar: true, isFullscreen: false, onGraphDiv: onDiv })}
                            </ResponsiveChartContainer>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

