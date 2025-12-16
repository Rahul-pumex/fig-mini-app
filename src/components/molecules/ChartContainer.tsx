// Simplified ChartContainer for mini app
// In a real implementation, this would render charts from your backend
import { Chart } from "../../types";

interface ChartContainerProps {
    charts: Chart[];
    showItemActions?: boolean;
}

export const ChartContainer = ({ charts, showItemActions = false }: ChartContainerProps) => {
    if (!charts || charts.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            {charts.map((chart, index) => (
                <div 
                    key={index} 
                    className="rounded-lg border border-gray-200 bg-white p-4"
                >
                    <div className="text-sm text-gray-600">
                        Chart: {chart.name || `Chart ${index + 1}`}
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                        (Chart rendering coming soon...)
                    </div>
                </div>
            ))}
        </div>
    );
};

