import { useState, useEffect } from "react";

// Simplified hook for mini app - returns consistent padding
export const useResponsiveChatPadding = (): string => {
    const [padding, setPadding] = useState("px-2");

    useEffect(() => {
        const updatePadding = () => {
            const width = window.innerWidth;
            if (width < 640) {
                setPadding("px-1");
            } else if (width < 1024) {
                setPadding("px-2");
            } else {
                setPadding("px-3");
            }
        };

        updatePadding();
        window.addEventListener("resize", updatePadding);
        return () => window.removeEventListener("resize", updatePadding);
    }, []);

    return padding;
};


