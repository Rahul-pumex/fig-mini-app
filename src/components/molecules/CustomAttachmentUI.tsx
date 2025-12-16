import { CustomAttachmentUIProps, MetricOption } from "../../types";
import { IoCloseSharp } from "react-icons/io5";
import { LuSparkles } from "react-icons/lu";
import { extractMetrics } from "../../utils";
import { useFigAgent } from "../../hooks";

const CustomAttachmentUI = ({ isOpen, onClose, onSelect }: CustomAttachmentUIProps) => {
    const { threadInfo } = useFigAgent();
    let metricOptions: MetricOption[] | undefined;
    if (threadInfo) metricOptions = extractMetrics(threadInfo, <LuSparkles size={16} />);

    if (!isOpen) return null;

    return (
        <div className="mx-2 mt-2 mb-2 flex items-center gap-1 rounded border border-gray-200 bg-white p-2">
            <div className="p-2">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Set monitoring for</span>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <IoCloseSharp size={16} />
                    </button>
                </div>
                <div className="space-y-1">
                    {metricOptions && metricOptions.length > 0 ? (
                        metricOptions.map((option: MetricOption) => (
                            <button
                                key={option.id}
                                onClick={() => onSelect(option)}
                                className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                            >
                                <span>{option.icon}</span>
                                <span>{option.label}</span>
                            </button>
                        ))
                    ) : (
                        <p className="text-center text-[0.625rem] font-light text-gray-600 italic">No KPIs available for monitoring</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomAttachmentUI;
