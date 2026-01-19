import { handleNoSessionError } from "../../utils/auth/errorHandler";
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AuthService } from "../../utils/auth/authService";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    errorMessage?: string;
}

class AuthErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        // Check if this is a session-related error
        const isAuthError = 
            error.message?.includes("No session exists") ||
            error.message?.includes("SuperTokens") ||
            error.message?.includes("session") ||
            error.message?.includes("unauthorized") ||
            error.message?.includes("unauthorised");
        
        // Check if this is a hooks error (often caused by auth state changes)
        const isHooksError = 
            error.message?.includes("Rendered fewer hooks") ||
            error.message?.includes("Rendered more hooks") ||
            error.message?.includes("rendered fewer hooks") ||
            error.message?.includes("rendered more hooks") ||
            (error.message?.includes("hook") && (error.message?.includes("Provider") || error.message?.includes("Context")));
        
        if (isAuthError || isHooksError) {
            console.warn("Auth/Hooks error caught by boundary:", error.message?.substring(0, 200));
            return { hasError: true, errorMessage: error.message };
        }

        // For non-auth errors, don't catch them
        throw error;
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Auth error boundary caught error:", error.message?.substring(0, 200), errorInfo);

        const isAuthError = 
            error.message?.includes("No session exists") ||
            error.message?.includes("SuperTokens") ||
            error.message?.includes("session") ||
            error.message?.includes("unauthorized") ||
            error.message?.includes("unauthorised");
        
        const isHooksError = 
            error.message?.includes("Rendered fewer hooks") ||
            error.message?.includes("Rendered more hooks") ||
            error.message?.includes("rendered fewer hooks") ||
            error.message?.includes("rendered more hooks");

        // Handle session errors - clean up and redirect if needed
        if (isAuthError) {
            handleNoSessionError(error).catch(console.error);
        } 
        // Hooks errors are usually transient during unmount - just log
        else if (isHooksError) {
            console.warn("Hooks error during auth transition - safe defaults should handle this");
        }
    }

    render() {
        if (this.state.hasError) {
            // Check if user is still authenticated
            const isAuthenticated = AuthService.isAuthenticated();

            if (!isAuthenticated && typeof window !== "undefined" && !window.location.pathname.includes("/auth")) {
                // Redirect to auth if not authenticated - use setTimeout to avoid hooks errors
                setTimeout(() => {
                    window.location.href = "/auth";
                }, 0);
                return <div>Redirecting to login...</div>;
            }

            // If authenticated, just continue rendering the children
            // This prevents the error from breaking the app when user is actually logged in
            return this.props.children;
        }

        return this.props.children;
    }
}

export default AuthErrorBoundary;

