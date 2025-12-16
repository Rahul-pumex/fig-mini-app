// Simplified Tabs component for mini app

interface TabsProps {
    data: Array<[string, string]>;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export const Tabs = ({ data, activeTab, setActiveTab }: TabsProps) => {
    return (
        <div className="flex space-x-1 border-b border-gray-200">
            {data.map(([value, label]) => (
                <button
                    key={value}
                    onClick={() => setActiveTab(value)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === value
                            ? 'border-b-2 border-primary text-primary'
                            : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
};

