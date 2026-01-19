import { setUser } from "@redux/slices/authSlice";
import { AuthService, getTokenExpiry } from "./authService";
import { store } from "@redux/store";
import { redirectToAuth } from "./redirectUtils";
import { useEffect } from "react";

/**
 * Fetch interceptor that automatically adds auth headers to API requests
 * This ensures CopilotKit and other API calls include authentication
 */

// Flag to prevent multiple simultaneous redirects
let isRedirecting = false;

export const useFetchInterceptor = () => {
    useEffect(() => {
        const originalFetch = window.fetch;
        isRedirecting = false; // Reset on mount
        
        window.fetch = async (url, options = {}) => {
            const modifiedOptions: RequestInit = {
                ...options,
                headers: {
                    ...(options.headers as Record<string, string> || {})
                } as Record<string, string>
            };

            // Add authentication headers for API endpoints
            // This includes copilotkit and other authenticated endpoints
            if (
                typeof url === "string" &&
                (url.includes("/api/copilotkit") || 
                 url.startsWith("/api/") || 
                 (url.startsWith("http") && !url.includes("/api/auth/signin")))
            ) {
                // Skip adding auth headers if refresh is in progress to prevent loops
                if (!(AuthService as any).isRefreshing) {
                    // Get fresh tokens from Redux state at request time
                    const accessToken = AuthService.getAccessToken();
                    const sessionId = AuthService.getSessionId();

                    if (accessToken) {
                        (modifiedOptions.headers as Record<string, string>)["Authorization"] = `Bearer ${accessToken}`;
                    }
                    
                    if (sessionId) {
                        (modifiedOptions.headers as Record<string, string>)["x-session_id"] = sessionId;
                    }
                }
            }

            let response = await originalFetch(url, modifiedOptions);

            // Handle 401 Unauthorized responses - token expired or invalid
            if (response.status === 401) {
                const urlString = typeof url === "string" ? url : url.toString();
                
                console.log("[FetchInterceptor] Detected 401 for URL:", urlString);
                
                // Don't handle auth endpoints to avoid loops
                const isAuthEndpoint = urlString.includes("/api/auth/") || 
                                      urlString.includes("/auth/") ||
                                      urlString.includes("signin") ||
                                      urlString.includes("signup");
                
                if (!isAuthEndpoint) {
                    // If already redirecting, return the 401 response immediately
                    if (isRedirecting) {
                        console.log("[FetchInterceptor] Already redirecting, returning 401 for:", urlString);
                        return response;
                    }
                    
                    console.warn("[FetchInterceptor] 401 Unauthorized - session expired, attempting token refresh for:", urlString);
                    
                    // Try to refresh tokens first
                    try {
                        const refreshed = await AuthService.refreshSession();
                        
                        if (refreshed) {
                            console.log("[FetchInterceptor] Token refresh succeeded, retrying request");
                            
                            // Get fresh tokens
                            const newAccessToken = AuthService.getAccessToken();
                            const newSessionId = AuthService.getSessionId();
                            
                            // Retry the original request with new tokens
                            const retryOptions: RequestInit = {
                                ...modifiedOptions,
                                headers: {
                                    ...(modifiedOptions.headers as Record<string, string> || {}),
                                } as Record<string, string>
                            };
                            
                            if (newAccessToken) {
                                (retryOptions.headers as Record<string, string>)["Authorization"] = `Bearer ${newAccessToken}`;
                            }
                            
                            if (newSessionId) {
                                (retryOptions.headers as Record<string, string>)["x-session_id"] = newSessionId;
                            }
                            
                            // Retry the request
                            response = await originalFetch(url, retryOptions);
                            
                            // If retry also fails with 401, session is truly expired
                            if (response.status === 401) {
                                console.warn("[FetchInterceptor] Session expired - redirecting to login");
                                isRedirecting = true;
                                AuthService.clearAllTokens();
                                // Use setTimeout to redirect after current execution completes
                                setTimeout(() => redirectToAuth(true), 0);
                            }
                            
                            return response;
                        } else {
                            // Refresh failed - session expired after long inactivity
                            console.warn("[FetchInterceptor] Session expired (refresh failed) - redirecting to login");
                            isRedirecting = true;
                            AuthService.clearAllTokens();
                            // Use setTimeout to redirect after current execution completes
                            setTimeout(() => redirectToAuth(true), 0);
                        }
                    } catch (refreshError) {
                        // Suppress expected queue-cleared errors
                        if (!(refreshError instanceof Error && refreshError.message === "Token refresh queue cleared")) {
                            console.error("[FetchInterceptor] Refresh error:", refreshError);
                        }
                        isRedirecting = true;
                        AuthService.clearAllTokens();
                        // Use setTimeout to redirect after current execution completes
                        setTimeout(() => redirectToAuth(true), 0);
                    }
                }
                
                // Return the response so the caller can handle it if needed
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

                    // Mark fresh login moment
                    try {
                        sessionStorage.setItem("just_logged_in", Date.now().toString());
                    } catch {}

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
                // Non-fatal - some responses won't have tokens
            }

            return response;
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);
};

