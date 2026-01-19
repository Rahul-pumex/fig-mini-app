import { AuthService } from "./authService";
import { shouldRedirectToAuth, logError } from "./errorDetection";

/**
 * Handles auth-related errors by cleaning up and redirecting if necessary
 */
export async function handleNoSessionError(error: Error): Promise<void> {
    // Use centralized logging
    logError(error, 'ErrorHandler');

    // Check if user is actually authenticated
    const isAuthenticated = AuthService.isAuthenticated();

    if (!isAuthenticated) {
        console.log("[ErrorHandler] User not authenticated, clearing tokens");
        AuthService.clearAllTokens();

        // Only redirect if we're not already on the auth page
        // Use setTimeout to avoid interrupting React's render cycle
        if (typeof window !== "undefined" && !window.location.pathname.includes("/auth")) {
            console.log("[ErrorHandler] Redirecting to /auth");
            setTimeout(() => {
                window.location.href = "/auth";
            }, 0);
        }
    } else {
        console.log("[ErrorHandler] User is authenticated, ignoring session error");
    }
}

/**
 * Global error handler for session-related errors
 * Note: This is mostly superseded by error handling in _app.tsx
 */
export function setupGlobalErrorHandlers(): void {
    if (typeof window === "undefined") return;

    // Handle unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
        // Use centralized error detection
        if (shouldRedirectToAuth(event.reason)) {
            logError(event.reason, 'ErrorHandler');
            event.preventDefault();
            handleNoSessionError(event.reason).catch(console.error);
        }
    });

    // Handle general errors
    window.addEventListener("error", (event) => {
        // Use centralized error detection
        if (shouldRedirectToAuth(event.error)) {
            logError(event.error, 'ErrorHandler');
            event.preventDefault();
            handleNoSessionError(event.error).catch(console.error);
        }
    });
}

