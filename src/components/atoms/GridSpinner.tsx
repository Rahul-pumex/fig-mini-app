import React, { useEffect, useState } from "react";

interface GridSpinnerProps {
    height?: number;
    width?: number;
    radius?: number;
    ariaLabel?: string;
}

const GRID_COLORS = ["#343434", "#646464", "#745263", "#000000", "#606084", "#BA675D", "#8A966E", "#AE3020"];

export function GridSpinner({ height = 32, width = 32, radius = 12.5, ariaLabel = "loading" }: GridSpinnerProps) {
    const [colorIndex, setColorIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setColorIndex((prev) => (prev + 1) % GRID_COLORS.length);
        }, 200); // Change color every 200ms

        return () => clearInterval(interval);
    }, []);

    const gridSize = 3; // 3x3 grid
    const dotSize = radius / 2;

    return (
        <div
            role="status"
            aria-label={ariaLabel}
            style={{
                display: "inline-block",
                width: width,
                height: height,
                position: "relative"
            }}
        >
            {Array.from({ length: gridSize * gridSize }, (_, i) => {
                const row = Math.floor(i / gridSize);
                const col = i % gridSize;
                const delay = i * 100; // Stagger animation

                return (
                    <div
                        key={i}
                        style={{
                            position: "absolute",
                            width: dotSize,
                            height: dotSize,
                            borderRadius: "50%",
                            backgroundColor: GRID_COLORS[(colorIndex + i) % GRID_COLORS.length],
                            left: `${col * (width / gridSize) + (width / gridSize - dotSize) / 2}px`,
                            top: `${row * (height / gridSize) + (height / gridSize - dotSize) / 2}px`,
                            animation: `pulse 1.5s ease-in-out infinite`,
                            animationDelay: `${delay}ms`
                        }}
                    />
                );
            })}
            <style jsx>{`
                @keyframes pulse {
                    0%,
                    100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.3;
                    }
                }
            `}</style>
        </div>
    );
}
