import { REFRESH_TOKEN_COOKIE, SUPERTOKENS_LOCALSTORAGE_PATTERNS, SUPERTOKENS_COOKIE_NAMES } from "./authConstants";
import { clearAuth, setTokens, updateAccessToken } from "@redux/slices/authSlice";
import { tokenRefreshQueue } from "./tokenRefreshQueue";
import { setCookie, deleteCookie } from "./cookieUtils";
import { getTokenExpiry } from "./authConfig";
import { resetAuthState } from "./withAuth";
import { store } from "@redux/store";

/**
 * AuthService: Non-hook authentication utilities for use in non-React contexts
 *
 * VALIDATION STRATEGY:
 * - Session validation happens ONLY at page load in withAuth HOC
 * - API interceptors handle 401/403 errors by redirecting to /auth
 * - No per-request validation (improves performance)
 */
export const AuthService = {
    /**
     * Validate session through backend API
     *
     * This is the SINGLE SOURCE OF TRUTH for session validation.
     * Called only by withAuth HOC at page load, not on every API request.
     *
     * @returns Promise<boolean> - true if session is valid, false otherwise
     */
    validateSession: async (): Promise<boolean> => {
        try {
            const accessToken = AuthService.getAccessToken();
            const sessionId = AuthService.getSessionId();

            // No access token = not authenticated
            if (!accessToken) {
                console.log("[AuthService] No access token, validation failed");
                return false;
            }

            // No session ID = incomplete session, clear tokens
            if (!sessionId) {
                console.warn("[AuthService] No session ID, clearing tokens");
                AuthService.clearAllTokens();
                return false;
            }

            console.log("[AuthService] Validating session with backend...");

            const response = await fetch(`/api/auth/validate-session`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "x-session_id": sessionId,
                    "Content-Type": "application/json"
                }
            });

            if (response.ok) {
                console.log("[AuthService] Session is valid");
                return true;
            }

            // Do not refresh on session expiry in mini-app; force logout flow.
            if (response.status === 401 || response.status === 403) {
                console.warn("[AuthService] Session expired/unauthorized, clearing auth state");
                AuthService.clearAllTokens();
                return false;
            }

            console.warn("[AuthService] Validation failed with status:", response.status);
            return false;
        } catch (error) {
            // Gracefully handle session errors
            if (error instanceof Error && error.message?.includes("No session exists")) {
                console.warn("[AuthService] No session exists");
                return false;
            }
            console.error("[AuthService] Validation error:", error);
            return false;
        }
    },

    /**
     * Refresh session using refresh token
     *
     * Uses tokenRefreshQueue to prevent concurrent refresh attempts.
     * Multiple simultaneous calls will be queued and resolved with the same result.
     *
     * @returns Promise<boolean> - true if refresh succeeded, false otherwise
     */
    refreshSession: async (): Promise<boolean> => {
        return tokenRefreshQueue.executeRefresh(async () => {
            try {
                const refreshToken = AuthService.getRefreshToken() || AuthService.getRefreshTokenFromCookie();

                if (!refreshToken) {
                    console.error("[AuthService] No refresh token available");
                    return false;
                }

                console.log("[AuthService] Refreshing session...");

                const response = await fetch(`/api/auth/session/refresh`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${refreshToken}`
                    }
                });

                if (!response.ok) {
                    console.warn("[AuthService] Refresh failed:", response.status);

                    // Clear tokens if refresh token is invalid
                    if (response.status === 401 || response.status === 403) {
                        console.warn("[AuthService] Refresh token invalid");
                        AuthService.clearAllTokens();
                    }

                    return false;
                }

                const data = await response.json();
                if (data.status !== "OK" || !data.tokens) {
                    console.warn("[AuthService] Invalid refresh response");
                    return false;
                }

                // Get new session ID from response headers
                const newSessionId = response.headers.get("x-session_id");
                const state = store.getState();
                const currentAuth = state?.auth;

                // Update Redux with new tokens
                store.dispatch(
                    setTokens({
                        accessToken: data.tokens.accessToken,
                        refreshToken: refreshToken, // Keep existing refresh token
                        accessTokenExpiry: data.tokens.accessTokenExpiry || getTokenExpiry(data.tokens.accessToken),
                        refreshTokenExpiry: currentAuth?.tokens?.refreshTokenExpiry || Date.now() + 30 * 24 * 60 * 60 * 1000,
                        sessionId: newSessionId || currentAuth?.tokens?.sessionId || ""
                    })
                );

                console.log("[AuthService] Session refreshed successfully");
                return true;
            } catch (error) {
                console.error("[AuthService] Refresh error:", error);
                return false;
            }
        });
    },

    // Check if access token is expired
    isAccessTokenExpired: (): boolean => {
        const state = store.getState();
        const auth = state ? state.auth : undefined;
        if (!auth?.tokens?.accessTokenExpiry) return true;
        return Date.now() >= auth.tokens.accessTokenExpiry;
    },

    // Get access token from Redux store
    getAccessToken: (): string | null => {
        const state = store.getState();
        const auth = state ? state?.auth : undefined;
        return auth?.tokens?.accessToken || null;
    },

    // Get refresh token from Redux store
    getRefreshToken: (): string | null => {
        const state = store.getState();
        const auth = state ? state.auth : undefined;
        return auth?.tokens?.refreshToken || null;
    },

    // Get session ID from Redux store
    getSessionId: (): string | null => {
        const state = store.getState();
        const auth = state ? state.auth : undefined;
        const sessionId = auth?.tokens?.sessionId;
        return sessionId && sessionId !== "" ? sessionId : null;
    },

    // Get User ID from Redux store
    getUserId: (): string | null => {
        const state = store.getState();
        const auth = state ? state.auth : undefined;
        const userId = auth?.user?.userId;
        // Return null if userId is empty string, null, or undefined
        return userId && userId !== "" ? userId : null;
    },

    getRefreshTokenFromCookie: (): string | null => {
        if (typeof document === "undefined") return null;
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith(REFRESH_TOKEN_COOKIE + "=")) {
                return cookie.substring(REFRESH_TOKEN_COOKIE.length + 1);
            }
        }
        return null;
    },

    storeTokens: (tokens: {
        accessToken: string;
        refreshToken: string;
        accessTokenExpiry: number;
        refreshTokenExpiry: number;
        sessionId: string;
    }): void => {
        // Store all tokens in Redux (will be persisted automatically)
        store.dispatch(setTokens(tokens));

        // Store only refresh token in cookie as backup
        setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
            expires: tokens.refreshTokenExpiry,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            path: "/"
        });
    },

    // Check if user is authenticated (more lenient check)
    isAuthenticated: (): boolean => {
        const state = store.getState();
        const auth = state ? state.auth : undefined;
        // Consider authenticated if we have valid access token, even without session ID
        return !!(auth?.tokens?.accessToken && !AuthService.isAccessTokenExpired());
    },

    // Check if we have a complete session (including session ID)
    hasCompleteSession: (): boolean => {
        const state = store.getState();
        const auth = state ? state.auth : undefined;
        return !!(auth?.tokens?.accessToken && auth?.tokens?.sessionId && !AuthService.isAccessTokenExpired());
    },

    /**
     * Clear all authentication data
     *
     * Clears:
     * - Redux auth state
     * - Refresh token cookie
     * - SuperTokens conflicting data
     * - Token refresh queue
     */
    clearAllTokens: (): void => {
        console.log("[AuthService] Clearing all authentication data");

        // Clear Redux state
        store.dispatch(clearAuth());

        // Clear refresh token cookie
        deleteCookie(REFRESH_TOKEN_COOKIE);

        // Reset global auth state in withAuth
        resetAuthState();

        // Clear token refresh queue
        tokenRefreshQueue.clear();

        // Clear SuperTokens localStorage
        if (typeof localStorage !== "undefined") {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && SUPERTOKENS_LOCALSTORAGE_PATTERNS.some((pattern) => key.includes(pattern))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach((key) => localStorage.removeItem(key));
        }

        // Clear SuperTokens cookies
        if (typeof document !== "undefined") {
            SUPERTOKENS_COOKIE_NAMES.forEach((cookieName) => {
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
            });
        }

    },

    /**
     * Clear SuperTokens data that might conflict with our auth system
     *
     * Called when not authenticated to prevent SuperTokens from interfering
     */
    clearConflictingSuperTokensData: (): void => {
        if (typeof localStorage !== "undefined") {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && SUPERTOKENS_LOCALSTORAGE_PATTERNS.some((pattern) => key.includes(pattern))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach((key) => localStorage.removeItem(key));
        }

        if (typeof document !== "undefined") {
            SUPERTOKENS_COOKIE_NAMES.forEach((cookieName) => {
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
            });
        }
    },

    // Set access token in Redux store (for token refresh scenarios)
    storeAccessToken: (token: string, expiry: number): void => {
        store.dispatch(
            updateAccessToken({
                accessToken: token,
                accessTokenExpiry: expiry
            })
        );
    }
};

