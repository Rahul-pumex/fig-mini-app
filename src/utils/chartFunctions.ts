export const bandColor = (label: string) => {
    if (
        label.includes("Safe") ||
        label.includes("Healthy") ||
        label.includes("Normal") ||
        label.includes("Good") ||
        label.includes("Optimal") ||
        label.includes("Expected")
    )
        return "#088c58"; // green
    else if (
        label.includes("Warning") ||
        label.includes("Moderate") ||
        label.includes("Elevated") ||
        label.includes("High") ||
        label.includes("Increased") ||
        label.includes("Above Normal") ||
        label.includes("Above Expected")
    )
        return "#f5a623"; // yellow
    else if (
        label.includes("Severe") ||
        label.includes("Critical") ||
        label.includes("Serious") ||
        label.includes("Danger") ||
        label.includes("Serious") ||
        label.includes("Above Critical") ||
        label.includes("Above Severe")
    )
        return "#b80d04"; // red
    return "#5c5757"; // gray
};

const interpolateColor = (color1: number[], color2: number[], factor: number): string => {
    const result = color1.map((c, i) => Math.round(c + factor * (color2[i] - c)));
    return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
};

export const generateHeatmapColors = (data: { v: number }[]): string[] => {
    const values = data.map((d) => d.v);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Define your gradient colors (blue → red)
    const startColor = [0, 0, 255]; // Blue
    const endColor = [255, 0, 0]; // Red

    return data.map(({ v }) => {
        const normalized = (v - min) / (max - min);
        return interpolateColor(startColor, endColor, normalized);
    });
};

export const generateRandomColors = (count: number): string[] => {
    return Array.from({ length: count }, () => {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        return `rgba(${r}, ${g}, ${b}, 0.8)`;
    });
};

export const flattenTreemapData = (data: any[], parentLabel = ""): Array<{ label: string; value: any }> => {
    return data.flatMap(({ name, value, children }): Array<{ label: string; value: any }> => {
        const label = parentLabel ? `${parentLabel} > ${name}` : name;
        return children ? [{ label, value }, ...flattenTreemapData(children, label)] : [{ label, value }];
    });
};

export const processTreemapData = (datasets: any[]) => {
    if (!Array.isArray(datasets) || datasets.length === 0) return [];
    return flattenTreemapData(datasets[0]?.data || []);
};

export const isArrayOfNumbers = (arr: any[]): boolean => {
    return arr.every((item) => typeof item === "number");
};

export const isArrayOfObjects = (arr: any[]): boolean => {
    return arr.every((item) => typeof item === "object" && item !== null);
};

