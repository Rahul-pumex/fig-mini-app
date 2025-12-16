export * from "./auth";
import { AdminFlowAgentState, MetricOption } from "../types";

export function extractMetrics(
    threadInfo: AdminFlowAgentState,
    icon: React.ReactNode
): MetricOption[] {
    const metrics: MetricOption[] = [];

    // Extract metrics from charts if available
    if (threadInfo.charts && Array.isArray(threadInfo.charts)) {
        threadInfo.charts.forEach((chart: any, index: number) => {
            if (chart?.id || chart?.name || chart?.title) {
                metrics.push({
                    id: chart.id || chart.name || chart.title || `chart-${index}`,
                    label: chart.name || chart.title || chart.id || `Chart ${index + 1}`,
                    icon: icon,
                });
            }
        });
    }

    // Extract metrics from texts if available
    if (threadInfo.texts && Array.isArray(threadInfo.texts)) {
        threadInfo.texts.forEach((text: any, index: number) => {
            if (text?.id || text?.name || text?.title) {
                metrics.push({
                    id: text.id || text.name || text.title || `text-${index}`,
                    label: text.name || text.title || text.id || `Text ${index + 1}`,
                    icon: icon,
                });
            }
        });
    }

    return metrics;
}


