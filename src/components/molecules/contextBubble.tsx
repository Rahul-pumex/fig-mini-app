import React from "react";
import { X } from "lucide-react";
import { inter } from "@/assets/fonts/inter";
import { useSelectedContexts } from "../SelectedContextsContext";

export const ContextBubble: React.FC = () => {
    const { selectedContexts, removeContext } = useSelectedContexts();

    if (selectedContexts.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 mb-2 ml-3">
            {selectedContexts.map((context) => (
                <div
                    key={context.id}
                    className={`inline-flex items-center p-1 ${context.type === 'prompt' ? 'bg-[#e4e4e4]' : 'bg-[#fdedf5]'} border border-[#e4e4e4] rounded-sm ${inter.className} text-black font-medium text-xs`}
                >
                    <span className="mr-1">{context.name}</span>
                    <button
                        onClick={() => removeContext(context.id)}
                        className="text-gray-500 hover:text-gray-700 cursor-pointer"
                    >
                        <X size={12} />
                    </button>
                </div>
            ))}
        </div>
    );
};
