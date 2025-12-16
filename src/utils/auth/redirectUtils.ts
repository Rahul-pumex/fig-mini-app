/**
 * Session Storage Flag Management Utilities
 *
 * Provides a clean interface for managing authentication redirect flags.
 * This prevents redirect loops while ensuring legitimate redirects work properly.
 */

import { REDIRECT_FLAG_KEY, REDIRECT_FLAG_TIMEOUT } from "./authConstants";

/**
 * Check if a redirect is currently in progress and not stale
 *
 * @returns true if redirect is in progress and flag is fresh (< REDIRECT_FLAG_TIMEOUT old)
 */
export const isRedirectInProgress = (): boolean => {
    if (typeof sessionStorage === "undefined") return false;

    const redirectFlag = sessionStorage.getItem(REDIRECT_FLAG_KEY);
    if (!redirectFlag) return false;

    try {
        const redirectTime = parseInt(redirectFlag, 10);
        const elapsed = Date.now() - redirectTime;
        return elapsed < REDIRECT_FLAG_TIMEOUT;
    } catch {
        // Invalid timestamp, clear it
        clearRedirectFlag();
        return false;
    }
};

/**
 * Set the redirect flag to indicate a redirect is in progress
 * Stores current timestamp for staleness checking
 */
export const setRedirectFlag = (): void => {
    if (typeof sessionStorage === "undefined") return;

    sessionStorage.setItem(REDIRECT_FLAG_KEY, Date.now().toString());
    console.log("[RedirectFlag] Set redirect flag");
};

/**
 * Clear the redirect flag
 * Should be called when:
 * - Landing on the auth page
 * - Successfully completing authentication
 * - Detecting a stale flag
 */
export const clearRedirectFlag = (): void => {
    if (typeof sessionStorage === "undefined") return;

    sessionStorage.removeItem(REDIRECT_FLAG_KEY);
    console.log("[RedirectFlag] Cleared redirect flag");
};

/**
 * Check if we should redirect to auth
 * Returns true if:
 * - No redirect is currently in progress, OR
 * - The redirect flag is stale
 *
 * This prevents redirect loops while allowing legitimate redirects
 */
export const shouldRedirectToAuth = (): boolean => {
    return !isRedirectInProgress();
};

/**
 * Safely redirect to auth page with flag management
 *
 * @param preservePath - If true, adds current path as redirectTo query param
 */
export const redirectToAuth = (preservePath: boolean = false): void => {
    if (typeof window === "undefined") return;

    // Don't redirect if already on auth page
    if (window.location.pathname.includes("/auth")) {
        console.log("[RedirectFlag] Already on auth page, skipping redirect");
        return;
    }

    // Don't redirect if already redirecting
    if (!shouldRedirectToAuth()) {
        console.log("[RedirectFlag] Redirect already in progress, skipping");
        return;
    }

    setRedirectFlag();

    let redirectUrl = "/auth";
    if (preservePath) {
        const currentPath = window.location.pathname;
        const currentSearch = window.location.search;
        const fullPath = currentPath + currentSearch;

        // Don't preserve root or auth paths
        if (currentPath !== "/" && !currentPath.includes("/auth")) {
            redirectUrl = `/auth?redirectTo=${encodeURIComponent(fullPath)}`;
        }
    }

    console.log("[RedirectFlag] Redirecting to:", redirectUrl);
    window.location.href = redirectUrl;
};

