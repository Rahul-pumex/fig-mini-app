// ChartContainer for mini app
import { ChartSpec } from "@/types";
import ChartClient from "./Charts/ChartClient";

interface ChartContainerProps {
    charts: ChartSpec[];
    showItemActions?: boolean;
}

export const ChartContainer = ({ charts, showItemActions = false }: ChartContainerProps) => {
    if (!charts || charts.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            {charts.map((chart, index) => {
                const chartType = chart.chart_type || chart.type || "line";
                const chartTitle = chart.title || chart.chart_id || `Chart ${index + 1}`;
                
                return (
                    <div 
                        key={chart.chart_id || index} 
                        className="rounded-lg border border-gray-200 bg-white p-4"
                    >
                        <div className="mb-2 text-sm font-semibold uppercase text-gray-600">
                            {chartTitle}
                        </div>
                        <ChartClient
                            type={chartType}
                            title={chartTitle}
                            labels={chart.labels}
                            datasets={chart.datasets}
                            data={chart.data}
                        />
                    </div>
                );
            })}
        </div>
    );
};

