import { SuperTokensWrapper as OriginalSuperTokensWrapper } from "supertokens-auth-react";
import React, { useEffect, useState } from "react";
import { AuthService } from "@utils";

interface SuperTokensWrapperProps {
    children: React.ReactNode;
}

export function SafeSuperTokensWrapper({ children }: SuperTokensWrapperProps) {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Add a small delay to ensure AuthService is ready
        const timer = setTimeout(() => {
            setIsReady(true);
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    if (!isReady) {
        // Avoid mounting children until SuperTokens wrapper is ready to prevent duplicate auth flows
        return null;
    }

    return <OriginalSuperTokensWrapper>{children}</OriginalSuperTokensWrapper>;
}

