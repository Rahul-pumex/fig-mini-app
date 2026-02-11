// Shared Plotly and chart typing utilities

// Preferred color palette (in priority order)
export const CHART_PALETTE: string[] = [
    "#745263", // Primary accent
    "#8A966E",
    "#BA675D",
    "#343434",
    "#646464",
    "#745263", // repeated intentionally from original list
    "#F0F0F0",
    "#AE3020"
];

export interface PlotlyData {
    x?: any[];
    y?: any[];
    type: "scatter" | "bar" | "box";
    mode?: "lines" | "markers" | "lines+markers";
    name?: string;
    marker?: {
        color?: string | string[];
        line?: {
            color?: string;
            width?: number;
        };
    };
    line?: {
        color?: string;
        width?: number;
    };
    orientation?: "h" | "v";
    [key: string]: any; // Allow extra plotly props
}

export interface PlotlyLayout {
    title?: {
        text?: string;
        font?: { size?: number; color?: string };
    };
    xaxis?: {
        title?: { text?: string };
        zeroline?: boolean;
        zerolinecolor?: string;
        zerolinewidth?: number;
        gridcolor?: string;
        showgrid?: boolean;
    };
    yaxis?: {
        title?: { text?: string };
        zeroline?: boolean;
        zerolinecolor?: string;
        zerolinewidth?: number;
        gridcolor?: string;
        showgrid?: boolean;
    };
    showlegend?: boolean;
    plot_bgcolor?: string;
    paper_bgcolor?: string;
    margin?: { l?: number; r?: number; t?: number; b?: number };
    height?: number;
    width?: number;
    [key: string]: any; // Additional layout props
}

export type NormalisedChart = { data: PlotlyData[]; layout: PlotlyLayout };

// Convenience type guard / helper placeholder (can expand later)
export const isDivergentType = (t: string) => t === "divergent" || t === "divergent-bar";




