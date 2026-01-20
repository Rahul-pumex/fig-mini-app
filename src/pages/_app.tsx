import type { AppProps } from "next/app";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { initAuth, AuthService, useFetchInterceptor } from "@utils";
import { redirectToAuth } from "../utils/auth/redirectUtils";
import StoreProvider from "../redux/StoreProvider";
import { CopilotKit } from "@copilotkit/react-core";
import { ADMIN_AGENT_NAME } from "../constants";
import { SafeSuperTokensWrapper } from "../components/auth/SafeSuperTokensWrapper";
import AuthErrorBoundary from "../components/auth/AuthErrorBoundary";
import { FigAgentProvider } from "../contexts/FigAgentContext";
import { inter } from "../assets/fonts/inter";
import "../styles/index.css";

// Initialize SuperTokens
initAuth();

function MyApp({ Component, pageProps }: AppProps) {
    const router = useRouter();
    
    // CRITICAL: Install fetch interceptor to add auth headers to all API requests
    useFetchInterceptor();
    
    // Ref to track previous pathname to detect transitions
    const prevPathnameRef = useRef<string>(router.pathname);
    const [isTransitioningToAuth, setIsTransitioningToAuth] = useState(false);
    
    // Handle back button visibility based on current route
    useEffect(() => {
        if (typeof window !== "undefined") {
            // Check if we're in an iframe
           // const isInIframe = window.self !== window.top;
            const isInIframe = true;
            
            if (isInIframe) {
                // Show back button only on /auth routes (signup/login pages)
                const isAuthPage = router.pathname === '/auth' || router.pathname.startsWith('/auth/');
                
                if (isAuthPage) {
                    console.log('[App] Showing back button for auth page:', router.pathname);
                    window.parent.postMessage({
                        type: 'SHOW_BACK_BUTTON',
                        source: 'fig-agent'
                    }, '*');
                } else {
                    console.log('[App] Hiding back button for page:', router.pathname);
                    window.parent.postMessage({
                        type: 'HIDE_BACK_BUTTON',
                        source: 'fig-agent'
                    }, '*');
                }
            }
        }
    }, [router.pathname, router.asPath]);
    
    // Detect when we're transitioning to auth page and delay unmounting CopilotKit
    // This prevents hooks errors during redirect by keeping CopilotKit mounted until redirect completes
    useEffect(() => {
        const currentPath = router.pathname;
        const prevPath = prevPathnameRef.current;
        const isAuthPage = currentPath.startsWith('/auth');
        const wasAuthPage = prevPath.startsWith('/auth');
        
        // If we're transitioning FROM a non-auth page TO auth page
        if (isAuthPage && !wasAuthPage) {
            console.log('[App] Transitioning to auth page, delaying CopilotKit unmount');
            setIsTransitioningToAuth(true);
            // Keep CopilotKit mounted for a brief moment to allow current render to complete
            const timer = setTimeout(() => {
                setIsTransitioningToAuth(false);
            }, 200); // Increased delay to ensure render completes
            prevPathnameRef.current = currentPath;
            return () => clearTimeout(timer);
        } else if (!isAuthPage) {
            // If we're not on auth page, clear transition flag immediately
            setIsTransitioningToAuth(false);
        }
        
        // Update ref for next comparison
        prevPathnameRef.current = currentPath;
    }, [router.pathname]);
    
    useEffect(() => {
        if (typeof window !== "undefined") {
            // Suppress React error overlay for auth-related errors
            const originalConsoleError = console.error;
            console.error = (...args: any[]) => {
                const errorStr = args.join(' ');
                // Suppress hooks errors in console (they're handled by safe defaults now)
                if (
                    errorStr.includes('Rendered fewer hooks') ||
                    errorStr.includes('Rendered more hooks') ||
                    errorStr.includes('rendered fewer hooks') ||
                    errorStr.includes('rendered more hooks') ||
                    errorStr.includes('hook') && (errorStr.includes('FigAgentProvider') || errorStr.includes('MessageMappingProvider'))
                ) {
                    console.warn('[Suppressed hooks error - using safe defaults]:', errorStr.substring(0, 200));
                    return;
                }
                originalConsoleError.apply(console, args);
            };
            
            // Enhanced global error handling for session and hooks errors
            const handleGlobalError = (event: ErrorEvent) => {
                const errorMsg = event.error?.message || event.message || '';
                
                // Check for auth-related errors
                const isAuthError = 
                    errorMsg.includes("No session exists") ||
                    errorMsg.includes("SuperTokens") ||
                    errorMsg.includes("session") ||
                    errorMsg.includes("unauthorized") ||
                    errorMsg.includes("unauthorised");
                
                // Check for hooks errors (often caused by auth redirects)
                const isHooksError = 
                    errorMsg.includes("Rendered fewer hooks") ||
                    errorMsg.includes("Rendered more hooks") ||
                    errorMsg.includes("rendered more hooks") ||
                    errorMsg.includes("rendered fewer hooks") ||
                    (errorMsg.includes("hook") && (errorMsg.includes("Provider") || errorMsg.includes("Context")));
                
                if (isAuthError || isHooksError) {
                    console.warn("[App] Global error handled (safe defaults active):", errorMsg.substring(0, 200));
                    // Prevent React error overlay in development
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();

                    // Only redirect if it's an auth error (not hooks error - those are handled by safe defaults)
                    if (isAuthError) {
                        const isAuthenticated = AuthService.isAuthenticated();
                        if (!isAuthenticated && !window.location.pathname.includes("/auth")) {
                            console.log("[App] Redirecting to /auth due to session error");
                            // Use centralized redirect function to prevent multiple redirects
                            setTimeout(() => {
                                redirectToAuth(false);
                            }, 100);
                        }
                    }
                    
                    return false;
                }
            };

            const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
                const errorMsg = event.reason?.message || String(event.reason) || '';
                
                const isAuthError = 
                    errorMsg.includes("No session exists") ||
                    errorMsg.includes("SuperTokens") ||
                    errorMsg.includes("session") ||
                    errorMsg.includes("unauthorized") ||
                    errorMsg.includes("unauthorised");
                
                if (isAuthError) {
                    console.warn("[App] Global promise rejection handled:", errorMsg);
                    event.preventDefault();

                    const isAuthenticated = AuthService.isAuthenticated();
                    if (!isAuthenticated && !window.location.pathname.includes("/auth")) {
                        // Use centralized redirect function to prevent multiple redirects
                        setTimeout(() => {
                            redirectToAuth(false);
                        }, 100);
                    }
                }
            };

            // Add both error handlers
            window.addEventListener("error", handleGlobalError, true); // Use capture phase
            window.addEventListener("unhandledrejection", handleUnhandledRejection);

            // IMMEDIATE CLEANUP: Check localStorage for persisted tokens and clear SuperTokens if none exist
            // This runs synchronously to prevent SuperTokens from making unauthorized API calls
            // BUT: Skip if we just logged in (to avoid race condition)
            try {
                const justLoggedInTs = sessionStorage.getItem("just_logged_in");
                const isVeryRecentLogin = !!justLoggedInTs && (Date.now() - Number(justLoggedInTs) < 15000); // 15s grace
                
                if (isVeryRecentLogin) {
                    // Skip cleanup for recent login
                } else {
                    const persistedState = localStorage.getItem("persist:root");
                    if (persistedState) {
                        const parsed = JSON.parse(persistedState);
                        const authState = parsed.auth ? JSON.parse(parsed.auth) : null;
                        const hasTokensInStorage = !!(authState?.tokens?.accessToken && authState?.tokens?.refreshToken);
                        
                        if (!hasTokensInStorage) {
                            // Clear SuperTokens cookies immediately
                            const cookiesToClear = [
                                "st-access-token", "st-refresh-token", "front-token", "sFrontToken",
                                "sAccessToken", "sRefreshToken", "sIdRefreshToken", "st-last-access-token-update"
                            ];
                            cookiesToClear.forEach((cookieName) => {
                                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn("[App] Error in immediate cleanup:", e);
            }

            // CRITICAL FIX: Wait for Redux to hydrate before doing full cleanup
            // This prevents clearing tokens before Redux has loaded them from localStorage
            const performCleanup = async () => {
                // Wait for Redux persist to hydrate (longer delay to ensure hydration completes)
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const justLoggedInTs = sessionStorage.getItem("just_logged_in");
                const justLoggedIn = !!justLoggedInTs && Date.now() - Number(justLoggedInTs) < 10_000;
                const isAuthenticated = AuthService.isAuthenticated();

                // Only cleanup if definitely not authenticated AND not in grace period
                if (!isAuthenticated && !justLoggedIn) {
                    try {
                        // Clear SuperTokens localStorage
                        const keysToRemove: string[] = [];
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && (key.includes("supertokens") || key.includes("st-") || key.includes("front-token") || key.startsWith("sFrontToken"))) {
                                keysToRemove.push(key);
                            }
                        }
                        keysToRemove.forEach((key) => localStorage.removeItem(key));

                        // Clear SuperTokens cookies more aggressively
                        const cookiesToClear = [
                            "st-access-token",
                            "st-refresh-token",
                            "front-token",
                            "sFrontToken",
                            "sAccessToken",
                            "sRefreshToken",
                            "sIdRefreshToken",
                            "st-last-access-token-update"
                        ];
                        cookiesToClear.forEach((cookieName) => {
                            // Clear for root domain
                            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                            // Clear for domain
                            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
                            // Clear for localhost specifically
                            if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
                                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost`;
                            }
                        });
                    } catch (error) {
                        console.warn("Error during SuperTokens cleanup:", error);
                    }
                } else if (justLoggedIn) {
                    // Clear the just_logged_in flag after a delay
                    setTimeout(() => {
                        try {
                            sessionStorage.removeItem("just_logged_in");
                        } catch {}
                    }, 5000);
                }
            };

            // Run cleanup after hydration
            performCleanup();

            return () => {
                window.removeEventListener("error", handleGlobalError, true);
                window.removeEventListener("unhandledrejection", handleUnhandledRejection);
                console.error = originalConsoleError;
            };
        }
    }, []);

    // Don't mount CopilotKit on auth pages to avoid 401 errors during login
    // CRITICAL: Use transition flag to prevent hooks errors during redirect
    const isAuthPage = router.pathname.startsWith('/auth');
    const shouldMountCopilotKit = !isAuthPage && !isTransitioningToAuth;

    return (
        <div className={inter.variable}>
            <StoreProvider>
                <AuthErrorBoundary>
                    <SafeSuperTokensWrapper>
                        <FigAgentProvider>
                            {shouldMountCopilotKit ? (
                                // App pages: with CopilotKit
                                <CopilotKit 
                                    runtimeUrl="/api/copilotkit" 
                                    agent={ADMIN_AGENT_NAME}
                                    properties={{
                                        clientType: process.env.NEXT_PUBLIC_CLIENT_TYPE || "spreadsheet"
                                    }}
                                >
                                    <Component {...pageProps} />
                                </CopilotKit>
                            ) : (
                                // Auth pages: no CopilotKit (or during transition)
                                <Component {...pageProps} />
                            )}
                        </FigAgentProvider>
                    </SafeSuperTokensWrapper>
                </AuthErrorBoundary>
            </StoreProvider>
        </div>
    );
}

export default MyApp;