import { AuthService } from "./authService";

/**
 * Handles "No session exists" errors by attempting to clean up and redirect if necessary
 */
export async function handleNoSessionError(error: Error): Promise<void> {
    console.warn("[ErrorHandler] Handling auth error:", error.message);

    // Check if user is actually authenticated
    const isAuthenticated = AuthService.isAuthenticated();

    if (!isAuthenticated) {
        console.log("[ErrorHandler] User not authenticated, clearing tokens");
        AuthService.clearAllTokens();

        // Only redirect if we're not already on the auth page
        if (typeof window !== "undefined" && !window.location.pathname.includes("/auth")) {
            console.log("[ErrorHandler] Redirecting to /auth");
            window.location.href = "/auth";
        }
    } else {
        console.log("[ErrorHandler] User is authenticated, ignoring session error");
    }
}

/**
 * Global error handler for session-related errors
 */
export function setupGlobalErrorHandlers(): void {
    if (typeof window === "undefined") return;

    // Handle unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
        if (
            event.reason?.message?.includes("No session exists") ||
            event.reason?.message?.includes("SuperTokens") ||
            event.reason?.message?.includes("session")
        ) {
            console.warn("[ErrorHandler] Unhandled promise rejection with session error");
            event.preventDefault();
            handleNoSessionError(event.reason).catch(console.error);
        }
    });

    // Handle general errors
    window.addEventListener("error", (event) => {
        if (
            event.error?.message?.includes("No session exists") ||
            event.error?.message?.includes("SuperTokens") ||
            event.error?.message?.includes("session")
        ) {
            console.warn("[ErrorHandler] Global error with session error");
            event.preventDefault();
            handleNoSessionError(event.error).catch(console.error);
        }
    });
}

