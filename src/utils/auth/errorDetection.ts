
export function shouldRedirectToAuth(error: Error | unknown): boolean {
    if (!error) return false;

    const errorMessage = getErrorMessage(error).toLowerCase();

    const isAuthError =
        errorMessage.includes("no session exists") ||
        errorMessage.includes("supertokens") ||
        errorMessage.includes("session") ||
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("unauthorised") ||
        errorMessage.includes("401") ||
        errorMessage.includes("authentication") ||
        errorMessage.includes("token expired") ||
        errorMessage.includes("invalid token");

    return isAuthError;
}

/**
 * Extracts a human-readable error message from various error types
 * 
 * @param error - The error to extract message from
 * @returns A string representation of the error
 */
export function getErrorMessage(error: Error | unknown): string {
    if (error instanceof Error) {
        return error.message || String(error);
    }
    
    if (typeof error === "string") {
        return error;
    }
    
    if (error && typeof error === "object" && "message" in error) {
        return String(error.message);
    }
    
    return String(error || "Unknown error");
}

/**
 * Logs an error with context information
 * 
 * @param error - The error to log
 * @param context - The context where the error occurred (e.g., 'ErrorHandler', 'AuthService')
 */
export function logError(error: Error | unknown, context: string = "Unknown"): void {
    const errorMessage = getErrorMessage(error);
    
    console.error(`[${context}] Error:`, errorMessage);
    
    // In development, also log the full error object for debugging
    if (process.env.NODE_ENV === "development" && error instanceof Error) {
        console.error(`[${context}] Full error:`, error);
        if (error.stack) {
            console.error(`[${context}] Stack trace:`, error.stack);
        }
    }
}
