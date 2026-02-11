import { setUser } from "@redux/slices/authSlice";
import { getTokenExpiry } from "./authConfig";
import { getDeviceFingerprint } from "@utils";
import { AuthService } from "./authService";
import { redirectToAuth, shouldRedirectToAuth } from "./redirectUtils";
import { store } from "@redux/store";
import { useEffect } from "react";

const AUTH_ENDPOINTS = [
    "/api/auth/signin",
    "/api/auth/logout",
    "/api/auth/signup",
    "/api/auth/validate-session",
    "/api/auth/session/refresh",
    "/api/auth/reset-password",
    "/api/auth/forgot-password",
    "/api/auth/user-info"
];

const isAuthEndpoint = (url: string): boolean => {
    return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
};

export const useFetchInterceptor = () => {
    useEffect(() => {
        const originalFetch = window.fetch;
        window.fetch = async (url, options = {}) => {
            const deviceId = await getDeviceFingerprint();
            const requestHeaders: Record<string, string> = {
                ...(options.headers as Record<string, string>),
                "device-id": deviceId
            };
            const modifiedOptions = {
                ...options,
                headers: requestHeaders
            };

            // Add authentication headers for copilotkit and other authenticated endpoints
            if (
                typeof url === "string" &&
                (url.includes("/api/copilotkit") || url.startsWith("/api/") || (url.startsWith("http") && !url.includes("/api/auth/signin")))
            ) {
                // Skip adding auth headers if refresh is in progress to prevent loops
                if (!(AuthService as any).isRefreshing) {
                    // Get fresh tokens from Redux state at request time
                    const accessToken = AuthService.getAccessToken();
                    const sessionId = AuthService.getSessionId();

                    if (accessToken) {
                        requestHeaders["Authorization"] = `Bearer ${accessToken}`;
                    }
                    if (sessionId) {
                        requestHeaders["x-session_id"] = sessionId;
                    }
                } else {
                    console.warn("Skipping auth headers because refresh is in progress for URL:", url);
                }
            }

            const response = await originalFetch(url, modifiedOptions);

            // Global unauthorized handling: clear auth and redirect once to /auth.
            if (typeof url === "string" && !isAuthEndpoint(url) && (response.status === 401 || response.status === 403)) {
                console.warn("[FetchInterceptor] Unauthorized response, redirecting to auth:", url, response.status);
                AuthService.clearAllTokens();
                if (shouldRedirectToAuth()) {
                    redirectToAuth(true);
                }
                return response;
            }

            // Check response for new tokens and update if present
            try {
                const headers = response.headers as Headers;

                const getHeaderValue = (h: Headers, name: string): string | null => {
                    return h.get(name) || h.get(name.toLowerCase()) || null;
                };

                const accessToken = getHeaderValue(headers, "st-access-token");
                const refreshToken = getHeaderValue(headers, "st-refresh-token");
                const frontToken = getHeaderValue(headers, "front-token");
                const sessionId = getHeaderValue(headers, "x-session_id") || "";

                // If both tokens present, store full token set
                if (accessToken && refreshToken) {
                    let accessTokenExpiry: number;
                    try {
                        accessTokenExpiry = getTokenExpiry(accessToken);
                    } catch {
                        accessTokenExpiry = Date.now() + 3600000; // 1h fallback
                    }
                    const refreshTokenExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

                    AuthService.storeTokens({
                        accessToken,
                        refreshToken,
                        accessTokenExpiry,
                        refreshTokenExpiry,
                        sessionId
                    });

                    // If front-token available, update user in store
                    if (frontToken) {
                        try {
                            const parts = frontToken.split(".");
                            if (parts.length > 0) {
                                const decodedFront = atob(parts[0]);
                                const front = JSON.parse(decodedFront);
                                if (front?.uid) {
                                    store.dispatch(
                                        setUser({
                                            userId: front.uid,
                                            emails: front.up?.email ? [front.up.email] : [],
                                            username: front.uid,
                                            tenantId: "",
                                            userRoles: [],
                                            onboarding_status: {
                                                onboarded: false,
                                                initialChoice: false
                                            }
                                        })
                                    );
                                }
                            }
                        } catch {}
                    }
                } else if (accessToken) {
                    // Only access token present: update it
                    let accessTokenExpiry: number;
                    try {
                        accessTokenExpiry = getTokenExpiry(accessToken);
                    } catch {
                        accessTokenExpiry = Date.now() + 3600000;
                    }
                    AuthService.storeAccessToken(accessToken, accessTokenExpiry);
                }
            } catch (e) {
                // Non-fatal
                console.warn("Auth fetch interceptor post-process error:", e);
            }

            return response;
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);
};

