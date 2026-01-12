import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@redux/hooks";
import { clearAuth, setLoading, setTokens, setUser, updateAccessToken } from "@redux/slices/authSlice";
import { AuthService } from "@utils";

export interface SignInCredentials {
    email: string;
    password: string;
}

export interface SignInResponse {
    status: "OK" | "WRONG_CREDENTIALS_ERROR" | "GENERAL_ERROR";
    tokens?: {
        accessToken: string;
        refreshToken: string;
        accessTokenExpiry: number;
        refreshTokenExpiry: number;
        sessionId: string;
    };
    user?: {
        id: string;
        emails: string[];
        userData: {
            username: string;
            tenantIds: string[];
            roles: string[];
        };
    };
    message?: string;
}

export const useAuth = () => {
    const dispatch = useAppDispatch();
    const auth = useAppSelector((state) => state.auth);
    const { tokens, user, isAuthenticated, isLoading } = auth || { tokens: null, user: null, isAuthenticated: false, isLoading: false };

    // Check if access token is expired
    const isAccessTokenExpired = useCallback(() => {
        return AuthService.isAccessTokenExpired();
    }, []);

    // Get valid access token (refresh if needed)
    const getValidAccessToken = useCallback(async (): Promise<string | null> => {
        // Use AuthService for access token checking
        const accessToken = AuthService.getAccessToken();

        if (!accessToken) return null;

        // Check if token is expired using AuthService
        if (!AuthService.isAccessTokenExpired()) {
            return accessToken;
        }

        // Try to refresh token using AuthService
        const refreshed = await AuthService.refreshSession();
        if (refreshed) {
            return AuthService.getAccessToken();
        }

        // If refresh fails, clear auth state
        dispatch(clearAuth());
        return null;
    }, [dispatch]);

    // Sign in function
    const signIn = useCallback(
        async (credentials: SignInCredentials): Promise<SignInResponse> => {
            dispatch(setLoading(true));
            try {
                // Use relative path to leverage Next.js proxy
                const response = await fetch(`/api/auth/signin`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        formFields: [
                            { id: "email", value: credentials.email },
                            { id: "password", value: credentials.password }
                        ]
                    })
                });

                const data: SignInResponse = await response.json();

                if (data.status === "OK" && data.tokens && data.user) {
                    // Extract session ID from response headers
                    const sessionId = response.headers.get("x-session_id");

                    if (!sessionId) {
                        console.error("No session ID received in signin response");
                        return {
                            status: "GENERAL_ERROR",
                            message: "Session ID missing from response"
                        };
                    }

                    // Add session ID to tokens
                    const tokensWithSessionId = {
                        ...data.tokens,
                        sessionId
                    };

                    // Use AuthService to store tokens (includes Redux + cookie)
                    AuthService.storeTokens(tokensWithSessionId);

                    // Store user data in Redux
                    dispatch(
                        setUser({
                            userId: data.user.id,
                            emails: data.user.emails,
                            username: data.user.userData.username,
                            tenantId: data.user.userData.tenantIds[0] || "",
                            userRoles: data.user.userData.roles,
                            onboarding_status: {
                                onboarded: false,
                                initialChoice: false
                            }
                        })
                    );

                    // Handle redirect after successful login
                    const redirectPath = window.location.search ? new URLSearchParams(window.location.search).get("redirectTo") : null;

                    // Short delay to ensure Redux state is fully updated
                    setTimeout(() => {
                        window.location.href = redirectPath || "/chat";
                    }, 500);
                }

                return data;
            } catch (error) {
                console.error("Sign in error:", error);
                return {
                    status: "GENERAL_ERROR",
                    message: "Network error occurred"
                };
            } finally {
                dispatch(setLoading(false));
            }
        },
        [dispatch]
    );

    // Sign out function
    const signOut = useCallback(async () => {
        try {
            // Call backend signout endpoint with current tokens
            const accessToken = AuthService.getAccessToken();
            const sessionId = AuthService.getSessionId();

            if (accessToken && sessionId) {
                // Use relative path to leverage Next.js proxy
                await fetch(`/api/auth/logout`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "x-session_id": sessionId,
                        "Content-Type": "application/json"
                    }
                });
            }
        } catch (error) {
            console.error("Sign out error:", error);
        } finally {
            // Clear all tokens using AuthService (includes Redux and cookies)
            AuthService.clearAllTokens();
        }
    }, []);

    // Refresh session function
    const refreshSession = useCallback(async (): Promise<boolean> => {
        try {
            console.log("[useAuth] Starting session refresh...");

            // Get refresh token from Redux store (now persisted)
            const refreshToken = AuthService.getRefreshToken();

            if (!refreshToken) {
                console.error("[useAuth] No refresh token available");
                return false;
            }

            // Use relative path to leverage Next.js proxy
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
                    // Extract new session ID from response headers
                    const newSessionId = response.headers.get("x-session_id");
                    console.log("[useAuth] Refresh successful, new session ID:", newSessionId ? "received" : "missing");

                    dispatch(
                        setTokens({
                            accessToken: data.tokens.accessToken,
                            refreshToken: refreshToken, // Keep existing refresh token
                            accessTokenExpiry: data.tokens.accessTokenExpiry,
                            refreshTokenExpiry: data.tokens.refreshTokenExpiry || Date.now() + 30 * 24 * 60 * 60 * 1000,
                            sessionId: newSessionId || "" // Use new session ID from response
                        })
                    );

                    console.log("[useAuth] Session refreshed successfully");
                    return true;
                }
            }

            console.warn("[useAuth] Session refresh failed with status:", response.status);
            return false;
        } catch (error) {
            console.error("[useAuth] Session refresh error:", error);
            return false;
        }
    }, [dispatch]);

    // Validate session through backend API - centralized session validation function
    // that can be used from API interceptors and other places in the app
    const validateSession = useCallback(async (): Promise<boolean> => {
        // Delegate to AuthService for consistent validation logic
        return await AuthService.validateSession();
    }, []);

    return {
        tokens,
        user,
        isAuthenticated,
        isLoading,
        signIn,
        signOut,
        getValidAccessToken,
        isAccessTokenExpired,
        validateSession,
        refreshSession
    };
};
