import { CHART_PALETTE, PlotlyData, PlotlyLayout, NormalisedChart, isDivergentType } from "./plotlyTypes";
import { ChartSpec } from "@/types";

export function getPlotlyType(chartType: string): PlotlyData["type"] {
    switch (chartType) {
        case "line":
            return "scatter";
        case "bar":
        case "divergent":
        case "divergent-bar":
            return "bar";
        case "scatter":
            return "scatter";
        case "box":
            return "box";
        default:
            return "scatter";
    }
}

export function normalise(spec: ChartSpec): NormalisedChart {
    const { labels = [], datasets, series, data } = spec;
    let plotlyData: PlotlyData[] = [];
    // Handle both chart_type and type fields for compatibility
    const chartType = spec.chart_type || spec.type || "line";
    const isScatter = chartType === "scatter";

    const scatterFromPoints = (raw: any) => {
        if (!Array.isArray(raw) || raw.length === 0) return null;
        const first = raw[0];
        if (!first || typeof first !== "object") return null;
        const xVals = raw.map((point: any) => point?.x ?? null);
        const yVals = raw.map((point: any) => point?.y ?? null);
        const hasPointData = xVals.some((val) => val != null) || yVals.some((val) => val != null);
        return hasPointData ? { x: xVals, y: yVals } : null;
    };

    if (Array.isArray(datasets)) {
        plotlyData = datasets.map((dataset: any, idx: number) => {
            const fallbackColor = CHART_PALETTE[idx % CHART_PALETTE.length];
            const isDivergent = isDivergentType(chartType);
            const isBar = chartType === "bar";
            const scatterPoints = isScatter ? scatterFromPoints(dataset.data) : null;
            const hasXYArrays = isScatter && Array.isArray(dataset.x) && Array.isArray(dataset.y);
            const trace: PlotlyData = {
                x: scatterPoints ? scatterPoints.x : hasXYArrays ? dataset.x : isDivergent ? dataset.data : labels,
                y: scatterPoints ? scatterPoints.y : hasXYArrays ? dataset.y : isDivergent ? labels : dataset.data,
                type: getPlotlyType(chartType),
                name: dataset.label || "Dataset",
                marker: {
                    color: fallbackColor,
                    line: { color: fallbackColor, width: 1 }
                }
            };
            if (chartType === "line") {
                trace.mode = "lines+markers";
                trace.line = { color: fallbackColor, width: 2 };
            }
            if (isDivergent) {
                trace.orientation = "h";
                const pos = dataset.positiveColor || "#8A966E";
                const neg = dataset.negativeColor || "#AE3020";
                const arr = Array.isArray(dataset.data) ? dataset.data : [];
                trace.marker!.color = arr.map((v: number) => (v >= 0 ? pos : neg));
            } else if (isBar) {
                trace.orientation = "v";
            }
            return trace;
        });
    } else if (Array.isArray(series)) {
        plotlyData = series.map((s: any, idx: number) => {
            const fallbackColor = CHART_PALETTE[idx % CHART_PALETTE.length];
            const values = s.values || s.data || [];
            const isDivergent = isDivergentType(chartType);
            const isBar = chartType === "bar";
            const scatterPoints = isScatter ? scatterFromPoints(values) : null;
            const hasXYArrays = isScatter && Array.isArray(s.x) && Array.isArray(s.y);
            const trace: PlotlyData = {
                x: scatterPoints ? scatterPoints.x : hasXYArrays ? s.x : isDivergent ? values : labels,
                y: scatterPoints ? scatterPoints.y : hasXYArrays ? s.y : isDivergent ? labels : values,
                type: getPlotlyType(chartType),
                name: s.label || "Series",
                marker: {
                    color: fallbackColor,
                    line: { color: fallbackColor, width: 1 }
                }
            };
            if (chartType === "line") {
                trace.mode = "lines+markers";
                trace.line = { color: fallbackColor, width: 2 };
            }
            if (isDivergent) {
                trace.orientation = "h";
                const pos = s.positiveColor || "#8A966E";
                const neg = s.negativeColor || "#AE3020";
                trace.marker!.color = values.map((v: number) => (v >= 0 ? pos : neg));
            } else if (isBar) {
                trace.orientation = "v";
            }
            return trace;
        });
    } else if (Array.isArray(data)) {
        const fallbackColor = CHART_PALETTE[0];
        const isDivergent = isDivergentType(chartType);
        const isBar = chartType === "bar";
        const scatterPoints = isScatter ? scatterFromPoints(data) : null;
        const trace: PlotlyData = {
            x: scatterPoints ? scatterPoints.x : isDivergent ? data : labels,
            y: scatterPoints ? scatterPoints.y : isDivergent ? labels : data,
            type: getPlotlyType(chartType),
            name: spec.chart_id || "Data",
            marker: { color: fallbackColor, line: { color: fallbackColor, width: 1 } }
        };
        if (chartType === "line") {
            trace.mode = "lines+markers";
            trace.line = { color: fallbackColor, width: 2 };
        }
        if (isDivergent) {
            trace.orientation = "h";
            const pos = "#8A966E";
            const neg = "#AE3020";
            trace.marker!.color = data.map((v: number) => (v >= 0 ? pos : neg));
        } else if (isBar) {
            trace.orientation = "v";
        }
        plotlyData = [trace];
    }

    const layout: PlotlyLayout = {
        title: {
            text: spec.options?.plugins?.title?.text || spec.chart_id || "Chart",
            font: { size: 16, color: "#333" }
        },
        showlegend: plotlyData.length > 1,
        plot_bgcolor: "transparent",
        paper_bgcolor: "transparent",
        margin: { l: 50, r: 50, t: 60, b: 50 },
        xaxis: {
            showgrid: true,
            gridcolor: "#F0F0F0",
            zeroline: isDivergentType(chartType),
            zerolinecolor: "#745263",
            zerolinewidth: 2
        },
        yaxis: {
            showgrid: !isDivergentType(chartType),
            gridcolor: "#F0F0F0"
        }
    };
    (layout as any).colorway = CHART_PALETTE;
    if (spec.options?.layout) Object.assign(layout, spec.options.layout);

    return { data: plotlyData, layout };
}

export function buildConfig(spec: ChartSpec, showModeBar = false, isFullscreen = false) {
    const isMiniModeBar = showModeBar && !isFullscreen;
    const config: any = {
        responsive: true,
        displayModeBar: showModeBar,
        displaylogo: false,
        doubleClick: "reset+autosize",
        scrollZoom: isFullscreen,
        toImageButtonOptions: {
            format: "png",
            filename: spec.chart_id || "chart",
            height: isFullscreen ? 800 : 400,
            width: isFullscreen ? 1200 : 800,
            scale: 2
        },
        locale: "en",
        plotGlPixelRatio: 2,
        watermark: false,
        editable: isFullscreen,
        staticPlot: false,
        modeBarStyle: {
            backgroundColor: "rgba(255,255,255,0.9)",
            border: "1px solid #ddd",
            borderRadius: "4px"
        }
    };
    if (isFullscreen || isMiniModeBar) {
        config.modeBarButtons = [["zoomIn2d", "zoomOut2d", "autoScale2d", "resetScale2d", "toImage"]];
        config.modeBarButtonsToRemove = [];
    } else {
        config.modeBarButtonsToRemove = ["pan2d", "lasso2d", "select2d"];
    }
    return config;
}

export function enhanceLayout(spec: ChartSpec, baseLayout: PlotlyLayout, isFullscreen: boolean, showModeBar: boolean): PlotlyLayout {
    const labels: string[] = (spec as any).labels || [];
    const chartType = spec.chart_type || spec.type || "line";
    const isBarLike = ["bar", "divergent", "divergent-bar"].includes(chartType);
    const isHorizontal = isDivergentType(chartType);
    const customLeftProvided = baseLayout.margin?.l != null;
    let dynamicLeft = baseLayout.margin?.l ?? 50;

    if (isBarLike && !customLeftProvided) {
        const longest = labels.reduce((m, l) => Math.max(m, String(l).length), 0);
        const estimated = 10 + longest * 5;
        dynamicLeft = Math.max(50, Math.min(130, estimated));
    }
    const addBottomForLegend = isBarLike && baseLayout.showlegend ? 30 : 0;
    return {
        ...baseLayout,
        plot_bgcolor: "transparent",
        paper_bgcolor: "transparent",
        autosize: true,
        hovermode: isFullscreen ? "x unified" : "closest",
        dragmode: isFullscreen ? "zoom" : "zoom",
        selectdirection: "diagonal",
        transition: { duration: 300, easing: "cubic-in-out" },
        margin: {
            ...(baseLayout.margin || {}),
            l: isBarLike ? dynamicLeft : (baseLayout.margin?.l ?? 50),
            b: (baseLayout.margin?.b ?? 50) + addBottomForLegend
        },
        xaxis: {
            ...baseLayout.xaxis,
            fixedrange: !(isFullscreen || (showModeBar && !isFullscreen)),
            rangeslider: undefined,
            rangeselector: undefined
        } as any,
        yaxis: {
            ...(baseLayout.yaxis as any),
            fixedrange: !(isFullscreen || (showModeBar && !isFullscreen)),
            automargin: true,
            ...(isHorizontal ? { type: "category", categoryorder: "array", categoryarray: labels } : {})
        },
        annotations: baseLayout.annotations || [],
        shapes: baseLayout.shapes || [],
        legend: baseLayout.showlegend
            ? isBarLike
                ? { orientation: "h", x: 0.5, y: -0.2, xanchor: "center", yanchor: "top" }
                : { orientation: "v", x: 1.02, y: 1, xanchor: "left", yanchor: "top" }
            : undefined
    };
}

