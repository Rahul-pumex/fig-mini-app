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
        if (
            error.message?.includes("No session exists") ||
            error.message?.includes("SuperTokens") ||
            error.message?.includes("session") ||
            error.message?.includes("unauthorized") ||
            error.message?.includes("unauthorised")
        ) {
            console.warn("Auth error caught by boundary:", error.message);
            return { hasError: true, errorMessage: error.message };
        }

        // For non-auth errors, don't catch them
        throw error;
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Auth error boundary caught error:", error, errorInfo);

        // Handle session errors gracefully
        if (
            error.message?.includes("No session exists") ||
            error.message?.includes("SuperTokens") ||
            error.message?.includes("session") ||
            error.message?.includes("unauthorized") ||
            error.message?.includes("unauthorised")
        ) {
            // Use our error handler to clean up and redirect if needed
            handleNoSessionError(error).catch(console.error);
        }
    }

    render() {
        if (this.state.hasError) {
            // Check if user is still authenticated
            const isAuthenticated = AuthService.isAuthenticated();

            if (!isAuthenticated && typeof window !== "undefined" && !window.location.pathname.includes("/auth")) {
                // Redirect to auth if not authenticated
                window.location.href = "/auth";
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

