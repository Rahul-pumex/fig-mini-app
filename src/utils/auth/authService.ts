import { REFRESH_TOKEN_COOKIE, SUPERTOKENS_LOCALSTORAGE_PATTERNS, SUPERTOKENS_COOKIE_NAMES } from "./authConstants";
import { clearAuth, setTokens, updateAccessToken } from "@redux/slices/authSlice";
import { tokenRefreshQueue } from "./tokenRefreshQueue";
import { setCookie, deleteCookie } from "./cookieUtils";
import { store } from "@redux/store";

// Get token expiry from JWT
export const getTokenExpiry = (token: string): number => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000;
    } catch (error) {
        return Date.now() + 3600000; // Default 1 hour
    }
};

/**
 * AuthService: Non-hook authentication utilities for use in non-React contexts
 *
 * VALIDATION STRATEGY:
 * - Session validation happens ONLY at page load in withAuth HOC
 * - API interceptors handle 401 errors with automatic token refresh
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

            // If 401, try to refresh tokens
            if (response.status === 401) {
                console.log("[AuthService] Session expired (401), attempting refresh...");
                const refreshed = await AuthService.refreshSession();

                if (refreshed) {
                    console.log("[AuthService] Refresh succeeded, session now valid");
                    return true;
                }

                console.warn("[AuthService] Refresh failed, clearing auth state");
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

    isAccessTokenExpired: (): boolean => {
        const state = store.getState();
        const auth = state ? state.auth : undefined;
        if (!auth?.tokens?.accessTokenExpiry) return true;
        return Date.now() >= auth.tokens.accessTokenExpiry;
    },

    getAccessToken: (): string | null => {
        const state = store.getState();
        const auth = state ? state?.auth : undefined;
        let token = auth?.tokens?.accessToken || null;
        
        // Fall back to localStorage if Redux is empty
        if (!token && typeof window !== "undefined") {
            try {
                const persistedState = localStorage.getItem("persist:root");
                if (persistedState) {
                    const parsed = JSON.parse(persistedState);
                    const authState = parsed.auth ? JSON.parse(parsed.auth) : null;
                    token = authState?.tokens?.accessToken || null;
                }
            } catch (e) {}
        }
        return token;
    },

    getRefreshToken: (): string | null => {
        const state = store.getState();
        const auth = state ? state.auth : undefined;
        let token = auth?.tokens?.refreshToken || null;
        
        // Fall back to localStorage if Redux is empty
        if (!token && typeof window !== "undefined") {
            try {
                const persistedState = localStorage.getItem("persist:root");
                if (persistedState) {
                    const parsed = JSON.parse(persistedState);
                    const authState = parsed.auth ? JSON.parse(parsed.auth) : null;
                    token = authState?.tokens?.refreshToken || null;
                }
            } catch (e) {}
        }
        return token;
    },

    getSessionId: (): string | null => {
        const state = store.getState();
        const auth = state ? state.auth : undefined;
        let sessionId = auth?.tokens?.sessionId || null;
        
        // Fall back to localStorage if Redux is empty
        if (!sessionId && typeof window !== "undefined") {
            try {
                const persistedState = localStorage.getItem("persist:root");
                if (persistedState) {
                    const parsed = JSON.parse(persistedState);
                    const authState = parsed.auth ? JSON.parse(parsed.auth) : null;
                    sessionId = authState?.tokens?.sessionId || null;
                }
            } catch (e) {}
        }
        return sessionId && sessionId !== "" ? sessionId : null;
    },

    getUserId: (): string | null => {
        const state = store.getState();
        const auth = state ? state.auth : undefined;
        const userId = auth?.user?.userId;
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
        // Store tokens in Redux (this will be persisted to localStorage)
        store.dispatch(setTokens(tokens));

        // Store refresh token in cookie (same as main app)
        setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
            expires: new Date(tokens.refreshTokenExpiry), // Use Date object instead of timestamp
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            path: "/"
        });
    },

    // Check if user is authenticated (more lenient check)
    isAuthenticated: (): boolean => {
        const state = store.getState();
        const auth = state ? state.auth : undefined;
        let hasToken = !!auth?.tokens?.accessToken;
        let tokenExpiry = auth?.tokens?.accessTokenExpiry;
        let source = "redux";
        
        // CRITICAL FIX: If Redux is empty, check localStorage directly
        // This handles the case where PersistGate hasn't hydrated yet
        if (!hasToken && typeof window !== "undefined") {
            try {
                const persistedState = localStorage.getItem("persist:root");
                if (persistedState) {
                    const parsed = JSON.parse(persistedState);
                    const authState = parsed.auth ? JSON.parse(parsed.auth) : null;
                    if (authState?.tokens?.accessToken) {
                        hasToken = true;
                        tokenExpiry = authState.tokens.accessTokenExpiry;
                        source = "localStorage";
                    }
                }
            } catch (e) {
                // Error reading from localStorage
            }
        }
        
        const isExpired = tokenExpiry ? Date.now() >= tokenExpiry : true;
        const result = !!(hasToken && !isExpired);
        
        // Consider authenticated if we have valid access token, even without session ID
        return result;
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

        // Clear session storage flags
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.removeItem("just_logged_in");
            sessionStorage.removeItem("auth_redirecting");
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

    storeAccessToken: (token: string, expiry: number): void => {
        store.dispatch(
            updateAccessToken({
                accessToken: token,
                accessTokenExpiry: expiry
            })
        );
    }
};

