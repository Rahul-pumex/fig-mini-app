import React from "react";

interface ImageUploadIconProps {
    size?: number;
    className?: string;
}

const ImageUploadIcon: React.FC<ImageUploadIconProps> = ({ size = 24, className = "" }) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className}>
            <path fill="currentColor" d="M11 13H5v-2h6V5h2v6h6v2h-6v6h-2z" />
        </svg>
    );
};

export default ImageUploadIcon;
