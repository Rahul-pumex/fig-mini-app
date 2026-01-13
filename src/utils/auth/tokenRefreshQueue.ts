/**
 * Token Refresh Queue
 *
 * Manages a queue of pending requests during token refresh operations.
 * This prevents multiple concurrent refresh attempts and ensures all pending
 * requests are properly handled after refresh completes.
 */

type PendingRequest = {
    resolve: (value: boolean) => void;
    reject: (error: Error) => void;
};

class TokenRefreshQueue {
    private isRefreshing: boolean = false;
    private pendingRequests: PendingRequest[] = [];

    /**
     * Check if a refresh is currently in progress
     */
    public isRefreshInProgress(): boolean {
        return this.isRefreshing;
    }

    /**
     * Execute a refresh operation, queuing additional requests that come in during refresh
     *
     * @param refreshFn - The function that performs the actual token refresh
     * @returns Promise<boolean> - true if refresh succeeded, false otherwise
     */
    public async executeRefresh(refreshFn: () => Promise<boolean>): Promise<boolean> {
        // If refresh is already in progress, queue this request
        if (this.isRefreshing) {
            console.log("[RefreshQueue] Refresh in progress, queueing request");
            return new Promise<boolean>((resolve, reject) => {
                this.pendingRequests.push({ resolve, reject });
            });
        }

        // Mark refresh as in progress
        this.isRefreshing = true;
        console.log("[RefreshQueue] Starting token refresh");

        try {
            // Execute the refresh
            const result = await refreshFn();

            console.log(`[RefreshQueue] Refresh ${result ? "succeeded" : "failed"}`);

            // Resolve all pending requests with the same result
            if (this.pendingRequests.length > 0) {
                console.log(`[RefreshQueue] Resolving ${this.pendingRequests.length} pending requests`);
                this.pendingRequests.forEach((request) => request.resolve(result));
                this.pendingRequests = [];
            }

            return result;
        } catch (error) {
            console.error("[RefreshQueue] Refresh error:", error);

            // Reject all pending requests with the same error
            const errorObj = error instanceof Error ? error : new Error("Token refresh failed");
            this.pendingRequests.forEach((request) => request.reject(errorObj));
            this.pendingRequests = [];

            return false;
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Clear the queue (for logout or error scenarios)
     * Resolves pending requests with false instead of rejecting to avoid unhandled errors
     */
    public clear(): void {
        console.log("[RefreshQueue] Clearing queue");
        this.isRefreshing = false;

        // Resolve all pending requests with false (refresh failed) instead of rejecting
        // This prevents unhandled promise rejections when tokens are cleared during refresh
        if (this.pendingRequests.length > 0) {
            console.log(`[RefreshQueue] Resolving ${this.pendingRequests.length} pending requests with false (queue cleared)`);
            this.pendingRequests.forEach((request) => request.resolve(false));
            this.pendingRequests = [];
        }
    }
}

// Export a singleton instance
export const tokenRefreshQueue = new TokenRefreshQueue();

