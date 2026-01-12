"use client";

import {
    BarElement,
    BubbleController,
    CategoryScale,
    Chart as ChartJS,
    ChartTypeRegistry,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    RadialLinearScale,
    registerables,
    ScatterController,
    TimeScale,
    Title,
    Tooltip
} from "chart.js";
import { bandColor, generateRandomColors, isArrayOfNumbers, isArrayOfObjects, processTreemapData } from "@/utils/chartFunctions";
import { TreemapController, TreemapElement } from "chartjs-chart-treemap";
import { FunnelController, TrapezoidElement } from "chartjs-chart-funnel";
import { MatrixController, MatrixElement } from "chartjs-chart-matrix";
import { Flow, SankeyController } from "chartjs-chart-sankey";
import { Chart } from "react-chartjs-2";
import "chartjs-adapter-date-fns";
import React from "react";

ChartJS.register(
    ...registerables,
    Title,
    Tooltip,
    Legend,
    MatrixController,
    MatrixElement,
    CategoryScale,
    LinearScale,
    BarElement,
    TreemapController,
    TreemapElement,
    SankeyController,
    Flow,
    TimeScale,
    RadialLinearScale,
    LineElement,
    ScatterController,
    PointElement,
    BubbleController,
    FunnelController,
    TrapezoidElement
);

interface ChartClientProps {
    type: string;
    title?: string;
    labels?: string[];
    data?: any;
    datasets?: any[];
}

const ChartClient: React.FC<ChartClientProps> = (props) => {
    const { type, title, labels, data } = props;
    const datasets = props.datasets || [];
    let chartDataForChartJS: any;
    let heatMapChartOptions: any;
    let waterfallChartOptions: any;

    if (data && data.error) {
        return (
            <p className="text-red-500">
                Some Error Occurred: <b>{data.error}</b>
            </p>
        );
    }

    switch (type) {
        case "bubble":
            const maxR = datasets?.[0]?.data ? Math.max(...datasets[0].data?.map((d: any) => d.r || 0)) : 0;
            const color = generateRandomColors(1)[0];
            chartDataForChartJS = {
                datasets: [
                    {
                        label: data?.label,
                        data: datasets[0]?.data?.map((d: { x: number; y: number; r: number }) => ({
                            x: d.x,
                            y: d.y,
                            r: maxR > 0 ? (d.r / maxR) * 30 : d.r
                        })),
                        backgroundColor: color,
                        borderColor: color,
                        borderWidth: 1
                    }
                ]
            };
            break;

        case "scatter":
            const scatterColors = generateRandomColors(data?.data?.length || datasets.length || 1);

            chartDataForChartJS = {
                datasets: datasets.length > 0 
                    ? datasets.map((ds: any, idx: number) => ({
                        label: ds.label || `Scatter Dataset ${idx + 1}`,
                        data: ds.data?.map((d: { x: number; y: number }) => ({
                            x: d.x,
                            y: d.y
                        })) || [],
                        backgroundColor: scatterColors[idx % scatterColors.length],
                        borderColor: scatterColors[idx % scatterColors.length]
                    }))
                    : [{
                        label: data?.label || "Scatter Dataset",
                        data: data?.data?.map((d: { x: number; y: number }) => ({
                            x: d.x,
                            y: d.y
                        })) || [],
                        backgroundColor: scatterColors[0],
                        borderColor: scatterColors[0]
                    }]
            };
            break;

        case "bar":
        case "sankey":
            if (data?.data?.length > 0) {
                const barColors = generateRandomColors(data.data.length)[0];
                chartDataForChartJS = {
                    labels: labels || data.labels || [],
                    datasets: [
                        {
                            label: data.label || "Chart Bar Dataset",
                            data: data.data || [],
                            backgroundColor: barColors,
                            borderColor: barColors,
                            borderWidth: 1
                        }
                    ]
                };
            } else if (datasets && Array.isArray(datasets)) {
                if (isArrayOfNumbers(datasets)) {
                    const colors = generateRandomColors(datasets.length)[0];
                    chartDataForChartJS = {
                        labels: labels || data?.labels || [],
                        datasets: [
                            {
                                label: data?.label || "Chart Bar Dataset",
                                data: datasets,
                                backgroundColor: colors,
                                borderColor: colors,
                                borderWidth: 1
                            }
                        ]
                    };
                } else if (isArrayOfObjects(datasets)) {
                    chartDataForChartJS = {
                        labels: labels || data?.labels || [],
                        datasets: datasets.map((ds: { data: any[]; label?: string; backgroundColor?: string; borderColor?: string }) => ({
                            label: ds.label || "Dataset",
                            data: ds?.data?.map((d: { y: null } | null | number) => {
                                if (d != null && typeof d === "object" && "y" in d) return (d as any).y;
                                return d;
                            }) || ds.data || [],
                            backgroundColor: ds.backgroundColor || generateRandomColors(1)[0],
                            borderColor: ds.borderColor || generateRandomColors(1)[0],
                            borderWidth: 1
                        }))
                    };
                }
            }
            break;

        case "line":
            if (datasets?.length === 0 || datasets.length === 0) {
                chartDataForChartJS = {
                    labels: data?.labels || labels || [],
                    datasets: [
                        {
                            ...data,
                            label: data?.label || "Chart Line Dataset",
                            data: data?.data || [],
                            backgroundColor: generateRandomColors(1)[0]
                        }
                    ]
                };
            } else if (Array.isArray(datasets) && datasets.length > 0) {
                chartDataForChartJS = {
                    labels: data?.labels || labels || [],
                    datasets: datasets.map((ds: { data: any[]; label?: string }) => ({
                        ...ds,
                        label: ds.label || "Dataset",
                        data: ds?.data?.map((d: { y: null } | null | number) => {
                            if (d != null && typeof d === "object" && "y" in d) return (d as any).y;
                            return d;
                        }) || []
                    }))
                };
            }
            break;

        case "treemap":
            const colors = generateRandomColors(10);
            chartDataForChartJS = {
                datasets: [
                    {
                        label: "My treemap dataset",
                        tree: processTreemapData(datasets || []),
                        key: "value",
                        backgroundColor: (ctx: any) => {
                            return colors[ctx.dataIndex % colors.length];
                        },
                        borderColor: "green",
                        borderWidth: 2,
                        spacing: 0,
                        labels: {
                            display: true,
                            color: "black",
                            font: { weight: "bold" }
                        }
                    }
                ]
            };
            break;

        case "doughnut":
        case "pie":
            const doughnutColors = generateRandomColors((data?.labels || labels || []).length);
            chartDataForChartJS = {
                labels: data?.labels || labels || [],
                datasets: [
                    {
                        data: data?.data?.map((d: any) => (typeof d === "object" && d !== null && "y" in d ? d.y : d)) || [],
                        backgroundColor: doughnutColors,
                        borderColor: doughnutColors,
                        borderWidth: 1
                    }
                ]
            };
            break;

        case "heatmap":
            const xLabels = data?.xLabels?.filter((x: any) => x !== null) || [];
            const yLabels = data?.yLabels || [];
            const heatData = data?.data || [];

            const minValue = Math.min(...heatData.map((d: any) => d.v));
            const maxValue = Math.max(...heatData.map((d: any) => d.v));

            const getColorForValue = (v: number) => {
                const ratio = (v - minValue) / (maxValue - minValue);
                const interpolate = (start: number, end: number) => Math.round(start + ratio * (end - start));

                const r = interpolate(220, 130);
                const g = interpolate(180, 60);
                const b = interpolate(180, 60);

                return `rgb(${r}, ${g}, ${b})`;
            };

            chartDataForChartJS = {
                datasets: [
                    {
                        label: "Heatmap Dataset",
                        data: heatData.map((d: any) => ({
                            x: d.x,
                            y: d.y,
                            v: d.v,
                            backgroundColor: getColorForValue(d.v)
                        })),
                        backgroundColor: (ctx: any) => ctx.raw?.backgroundColor,
                        borderColor: "white",
                        borderWidth: 0.5,
                        width: ({ chart }: any) => ((chart.chartArea || {}).width / xLabels.length) * 3,
                        height: ({ chart }: any) => ((chart.chartArea || {}).height / yLabels.length) * 3
                    }
                ]
            };

            heatMapChartOptions = {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: false,
                        text: "Heatmap Chart",
                        font: { size: 12, weight: "bold" }
                    },
                    legend: {
                        display: true
                    },
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems: any[]) => {
                                if (tooltipItems.length > 0) {
                                    const item = tooltipItems[0];
                                    const xIndex = item.raw?.x;
                                    const yIndex = item.raw?.y;
                                    return `X: ${xLabels[xIndex]}, Y: ${yLabels[yIndex]}`;
                                }
                                return "";
                            },
                            label: (tooltipItem: { raw: { v: any } }) => {
                                return `Value: ${tooltipItem.raw?.v}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: data?.xLabel,
                            font: { size: 12, weight: "bold" }
                        },
                        ticks: {
                            callback: (val: string | number) => xLabels[val],
                            font: { size: 12 }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: data?.yLabel,
                            font: { size: 12, weight: "bold" }
                        },
                        ticks: {
                            callback: (val: string | number) => yLabels[val],
                            font: { size: 12 },
                            padding: 10
                        }
                    }
                }
            };
            break;

        case "radar":
            const radarColors = generateRandomColors((data?.labels || labels || []).length);
            chartDataForChartJS = {
                labels: data?.labels || labels || [],
                datasets: datasets.map((dataset: { data: number[]; label: string }, index: number) => ({
                    label: dataset.label || `Radar Dataset ${index + 1}`,
                    data: dataset.data,
                    borderColor: radarColors,
                    pointBackgroundColor: radarColors,
                    pointHoverBorderColor: radarColors
                }))
            };
            break;

        case "waterfall":
            const waterfallColors = generateRandomColors((data?.labels || labels || []).length);

            chartDataForChartJS = {
                labels: data?.labels || labels || [],
                datasets: [
                    {
                        label: datasets[0]?.label,
                        data: datasets[0]?.data,
                        backgroundColor: "rgba(0,0,0,0)",
                        stack: "stack1"
                    },
                    {
                        label: datasets[1]?.label,
                        data: datasets[1]?.data,
                        backgroundColor: waterfallColors,
                        stack: "stack1"
                    }
                ]
            };
            waterfallChartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: !!title, text: title }
                },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true }
                }
            };
            break;

        case "funnel":
            chartDataForChartJS = {
                labels: ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"],
                datasets: [
                    {
                        label: "Funnel Dataset",
                        data: [10, 9, 7, 5, 3],
                        backgroundColor: generateRandomColors(5),
                        borderColor: "black",
                        borderWidth: 1
                    }
                ]
            };
            break;

        default:
            return <p>Unsupported chart type: {type}</p>;
    }

    const radarOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            title: {
                display: false
            },
            legend: {
                display: true,
                position: "top" as const
            }
        },
        scales: {
            r: {
                angleLines: {
                    display: false
                },
                pointLabels: {
                    display: true
                },
                ticks: {
                    display: true,
                    font: { size: 10 }
                }
            }
        }
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: type === "funnel" ? "y" : "x",
        plugins: {
            title: {
                display: !!title,
                text: title || "Chart",
                font: { size: 16, weight: "bold" }
            },
            legend: {
                display: true,
                position: "bottom" as const
            },
            tooltip: {
                callbacks: {
                    label: function (tooltipItem: { dataset: any; dataIndex: string | number; formattedValue: any }) {
                        const dataset = tooltipItem.dataset;
                        const dataPoint = dataset.data[tooltipItem.dataIndex];

                        if (dataPoint && typeof dataPoint === "object" && "r" in dataPoint) {
                            const customLabel = (dataPoint as any).label || "Data Point";
                            return `${customLabel}: (${(dataPoint as any).x}, ${(dataPoint as any).y}, ${(dataPoint as any).r})`;
                        }

                        return tooltipItem.formattedValue;
                    }
                }
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: data?.xLabel || "X Axis",
                    font: { size: 12, weight: "bold" }
                }
            },
            y: {
                title: {
                    display: true,
                    text: data?.yLabel || "Y Axis",
                    font: { size: 12, weight: "bold" }
                }
            }
        }
    };

    const reconstructedPlugin = data?.bands?.length
        ? {
              id: "backgroundBands",
              beforeDraw: (chart: any) => {
                  const { ctx, scales, chartArea } = chart;
                  if (!chartArea || !scales.y) return;

                  if (data.bands)
                      data.bands.forEach((band: any) => {
                          const yStart = scales.y.getPixelForValue(band.start);
                          const yEnd = scales.y.getPixelForValue(band.end);

                          ctx.fillStyle = band.color ? band.color : bandColor(band.label || "Unknown Band");
                          ctx.globalAlpha = 0.2;
                          ctx.fillRect(chartArea.left, yEnd, chartArea.right - chartArea.left, yStart - yEnd);
                          ctx.globalAlpha = 1;
                      });
              }
          }
        : undefined;

    return (
        <div className="h-[400px] w-full">
            <Chart
                type={type === "heatmap" ? "matrix" : type === "waterfall" ? "bar" : (type as keyof ChartTypeRegistry)}
                data={chartDataForChartJS}
                plugins={reconstructedPlugin !== undefined ? [reconstructedPlugin] : []}
                options={
                    type === "heatmap"
                        ? heatMapChartOptions
                        : type === "waterfall"
                          ? waterfallChartOptions
                          : type === "radar"
                            ? radarOptions
                            : options
                }
            />
        </div>
    );
};

export default ChartClient;

