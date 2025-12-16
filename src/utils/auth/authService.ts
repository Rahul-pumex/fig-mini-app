import { clearAuth, setTokens, updateAccessToken } from "@redux/slices/authSlice";
import { setCookie, deleteCookie } from "./cookieUtils";
import { store, persistor } from "@redux/store";

// Token and session constants
const REFRESH_TOKEN_COOKIE = "refresh_token";

// Get token expiry from JWT
const getTokenExpiry = (token: string): number => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000;
    } catch (error) {
        return Date.now() + 3600000; // Default 1 hour
    }
};

// Non-hook version of auth functions for use in non-React contexts
export const AuthService = {
    isRefreshing: false,
    
    validateSession: async (): Promise<boolean> => {
        try {
            // CRITICAL: Check if we JUST logged in - if so, skip validation
            // This prevents the refresh API call loop
            const justLoggedInTs = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("just_logged_in") : null;
            if (justLoggedInTs) {
                const timeSinceLogin = Date.now() - Number(justLoggedInTs);
                // Extended grace period - don't validate for 30 seconds after login
                if (timeSinceLogin < 30000) {
                    return true; // Trust that login was successful
                }
            }
            
            const accessToken = AuthService.getAccessToken();
            const sessionId = AuthService.getSessionId();

            if (!accessToken) {
                return false;
            }

            // If no session ID but we have a token, allow it (backend might not provide sessionId)
            if (!sessionId) {
                // DON'T clear tokens - just proceed with validation
            }

            const headers: Record<string, string> = {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            };
            
            if (sessionId) {
                headers["x-session_id"] = sessionId;
            }
            
            const response = await fetch(`/api/auth/validate-session`, {
                method: "POST",
                headers
            });

            if (response.ok) {
                return true;
            }

            if (response.status === 401) {
                // Check if refresh is already in progress
                if (AuthService.isRefreshing) {
                    return false;
                }

                // Try to refresh token if session is invalid
                const refreshed = await AuthService.refreshSession();

                // Don't re-validate after refresh - just return the refresh result
                // The next API call will use the new tokens
                if (refreshed) {
                    return true;
                } else {
                    AuthService.clearAllTokens();
                    return false;
                }
            }

            console.error("[AuthService] Session validation failed with status:", response.status);
            return false;
        } catch (error) {
            console.error("[AuthService] Session validation error:", error);
            return false;
        }
    },

    refreshSession: async (): Promise<boolean> => {
        if (AuthService.isRefreshing) {
            return false;
        }

        AuthService.isRefreshing = true;

        try {
            const refreshToken = AuthService.getRefreshToken() || AuthService.getRefreshTokenFromCookie();

            if (!refreshToken) {
                return false;
            }

            const response = await fetch(`/api/auth/session/refresh`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${refreshToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === "OK" && data.tokens) {
                    const newSessionId = response.headers.get("x-session_id");
                    const currentRefreshToken = AuthService.getRefreshToken();
                    const state = store.getState();
                    const currentAuth = state?.auth;

                    store.dispatch(
                        setTokens({
                            accessToken: data.tokens.accessToken,
                            refreshToken: currentRefreshToken || refreshToken,
                            accessTokenExpiry: data.tokens.accessTokenExpiry || getTokenExpiry(data.tokens.accessToken),
                            refreshTokenExpiry: currentAuth?.tokens?.refreshTokenExpiry || Date.now() + 30 * 24 * 60 * 60 * 1000,
                            sessionId: newSessionId || currentAuth?.tokens?.sessionId || ""
                        })
                    );

                    return true;
                }
            }

            if (response.status === 401 || response.status === 403) {
                AuthService.clearAllTokens();
            }

            return false;
        } catch (error) {
            console.error("[AuthService] Session refresh error:", error);
            return false;
        } finally {
            AuthService.isRefreshing = false;
        }
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

    clearAllTokens: (): void => {
        store.dispatch(clearAuth());
        deleteCookie(REFRESH_TOKEN_COOKIE);

        if (typeof localStorage !== "undefined") {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes("supertokens") || key.includes("st-") || key.includes("front-token"))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach((key) => localStorage.removeItem(key));
            localStorage.removeItem("refreshToken");
        }

        if (typeof sessionStorage !== "undefined") {
            sessionStorage.removeItem("fresh_login");
            sessionStorage.removeItem("just_logged_in");
            sessionStorage.removeItem("login_redirect");
        }

        if (typeof document !== "undefined") {
            const cookiesToClear = ["st-access-token", "st-refresh-token", "front-token", "sessionId"];
            cookiesToClear.forEach((cookieName) => {
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

