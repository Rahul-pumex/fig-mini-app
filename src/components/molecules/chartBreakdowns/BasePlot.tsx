"use client";
import { PlotlyData, PlotlyLayout } from "./plotlyTypes";
import dynamic from "next/dynamic";
import React from "react";

export type BasePlotProps = {
    data: PlotlyData[];
    layout: PlotlyLayout;
    config: any;
    isFullscreen?: boolean;
    showModeBar?: boolean;
    style?: React.CSSProperties;
    onGraphDiv?: (el: any) => void;
};

const DynamicPlot = dynamic<any>(() => import("react-plotly.js"), { ssr: false });

export const BasePlot: React.FC<BasePlotProps> = ({ data, layout, config, isFullscreen, style, onGraphDiv }) => {
    if (typeof window === "undefined") {
        return <div className="flex h-[400px] w-full animate-pulse items-center justify-center rounded bg-gray-100">Loading chart...</div>;
    }
    return (
        <DynamicPlot
            data={data}
            layout={layout}
            config={config}
            style={{ width: "100%", height: isFullscreen ? "100%" : "400px", backgroundColor: "transparent", ...style }}
            useResizeHandler
            className="w-full transition-colors duration-150"
            onInitialized={(fig: any, gd: any) => onGraphDiv?.(gd)}
            onUpdate={(fig: any, gd: any) => onGraphDiv?.(gd)}
        />
    );
};

