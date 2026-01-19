"use client";
import { normalise, buildConfig, enhanceLayout } from "./chartUtils";
import { BasePlot } from "./BasePlot";
import { ChartSpec } from "@/types";
import React from "react";

export interface GenericChartProps {
    spec: ChartSpec;
    isFullscreen?: boolean;
    showModeBar?: boolean;
    onGraphDiv?: (el: any) => void;
}

const GenericChart: React.FC<GenericChartProps> = ({ spec, isFullscreen = false, showModeBar = true, onGraphDiv }) => {
    const { data, layout } = normalise(spec);
    const config = buildConfig(spec, showModeBar, isFullscreen);
    const enhancedLayout = enhanceLayout(spec, layout, isFullscreen, showModeBar);
    return <BasePlot data={data} layout={enhancedLayout} config={config} isFullscreen={isFullscreen} onGraphDiv={onGraphDiv} />;
};

// For now, individual components just wrap GenericChart; left separate for future specialization
export const BarChart: React.FC<GenericChartProps> = (p) => <GenericChart {...p} />;
export const LineChart: React.FC<GenericChartProps> = (p) => <GenericChart {...p} />;
export const ScatterChart: React.FC<GenericChartProps> = (p) => <GenericChart {...p} />;
export const BoxChart: React.FC<GenericChartProps> = (p) => <GenericChart {...p} />;
export const DivergentBarChart: React.FC<GenericChartProps> = (p) => <GenericChart {...p} />;

export function renderChartByType(spec: ChartSpec, opts?: { isFullscreen?: boolean; showModeBar?: boolean; onGraphDiv?: (el: any) => void }) {
    const common = { spec, isFullscreen: opts?.isFullscreen, showModeBar: opts?.showModeBar, onGraphDiv: opts?.onGraphDiv };
    const chartType = spec.chart_type || spec.type || "line";
    switch (chartType) {
        case "line":
            return <LineChart {...common} />;
        case "bar":
            return <BarChart {...common} />;
        case "scatter":
            return <ScatterChart {...common} />;
        case "box":
            return <BoxChart {...common} />;
        case "divergent":
        case "divergent-bar":
            return <DivergentBarChart {...common} />;
        default:
            return <ScatterChart {...common} />;
    }
}

