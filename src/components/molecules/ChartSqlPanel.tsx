// Simplified ChartSqlPanel for mini app
import { Chart } from "../../types";

interface ChartSqlPanelProps {
    charts: Chart[];
}

export const ChartSqlPanel = ({ charts }: ChartSqlPanelProps) => {
    if (!charts || charts.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            {charts.map((chart, index) => (
                <div 
                    key={index} 
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                    <div className="mb-2 text-sm font-medium text-gray-700">
                        Chart SQL {index + 1}
                    </div>
                    <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
                        <code>{chart.sql || chart.query || 'No SQL available'}</code>
                    </pre>
                </div>
            ))}
        </div>
    );
};

