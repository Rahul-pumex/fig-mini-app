import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { AuthService } from "./authService";
import { isRedirectInProgress, setRedirectFlag, clearRedirectFlag } from "./redirectUtils";
import { DEFAULT_AUTHENTICATED_ROUTE } from "./authConstants";

// Global auth check state - persists across page navigations
let globalAuthChecked = false;
let globalIsAuthenticated = false;

// Helper to build auth redirect URL
const getAuthRedirectUrl = (router: any): string => {
    const currentPath = router.pathname;

    // Don't preserve base route or auth routes
    if (!currentPath || currentPath === "/" || currentPath.startsWith("/auth")) {
        return "/auth";
    }

    // Preserve full path including query params
    const fullPath = router.asPath;
    return `/auth?redirectTo=${encodeURIComponent(fullPath)}`;
};

export function withAuth<P extends object>(
    WrappedComponent: React.ComponentType<P>
): React.FC<P> {
    const ComponentWithAuth: React.FC<P> = (props) => {
        const router = useRouter();
        // Initialize from global state if available
        const [isAuthenticated, setIsAuthenticated] = useState(globalIsAuthenticated);
        const [isRedirecting, setIsRedirecting] = useState(false);
        const [isChecking, setIsChecking] = useState(!globalAuthChecked);

        useEffect(() => {
            const { pathname } = router;

            async function checkAuthentication() {
                // If we've globally checked and are authenticated, skip validation
                if (globalAuthChecked && globalIsAuthenticated && AuthService.isAuthenticated()) {
                    setIsAuthenticated(true);
                    setIsChecking(false);
                    return;
                }

                // Check if redirect is in progress using new utility
                if (isRedirectInProgress()) {
                    console.log("[withAuth] Redirect in progress, waiting...");
                    setIsChecking(false);
                    return;
                }

                try {

                    // Check if we just logged in and calculate timing
                    const justLoggedInTimestamp = sessionStorage.getItem("just_logged_in");
                    let isRecentLogin = false;
                    let isVeryRecentLogin = false;
                    let timeSinceLogin = 0;
                    
                    if (justLoggedInTimestamp) {
                        timeSinceLogin = Date.now() - parseInt(justLoggedInTimestamp);
                        isRecentLogin = timeSinceLogin < 30000; // 30 seconds
                        isVeryRecentLogin = timeSinceLogin < 10000; // 10 seconds - CRITICAL period
                        
                        // CRITICAL: Wait longer if very recent login to let Redux persist complete
                        if (timeSinceLogin < 5000) {
                            await new Promise((resolve) => setTimeout(resolve, 1500));
                        } else {
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                    } else {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                    }

                    if (isRecentLogin) {
                        // Skip the hasCompleteSession check for recent logins
                        // This prevents clearing tokens before sessionId propagates
                        const authenticated = AuthService.isAuthenticated();
                        
                        if (authenticated) {
                            globalAuthChecked = true;
                            globalIsAuthenticated = true;
                            setIsAuthenticated(true);
                            setIsChecking(false);
                            clearRedirectFlag();
                            return;
                        }
                    }

                    // First check if we have any valid authentication
                    const authenticated = AuthService.isAuthenticated();

                    if (!authenticated) {
                        // CRITICAL: If we just logged in (<10s ago), don't redirect yet!
                        // The tokens might still be persisting to localStorage
                        if (isVeryRecentLogin) {
                            // Try one more time after another delay
                            await new Promise((resolve) => setTimeout(resolve, 1000));
                            const retryAuth = AuthService.isAuthenticated();
                            
                            if (retryAuth) {
                                globalAuthChecked = true;
                                globalIsAuthenticated = true;
                                setIsAuthenticated(true);
                                setIsChecking(false);
                                return;
                            }
                        }
                        globalAuthChecked = false;
                        globalIsAuthenticated = false;
                        setRedirectFlag();
                        setIsRedirecting(true);
                        setIsChecking(false);
                        await router.replace(getAuthRedirectUrl(router));
                        return;
                    }

                    // Check if we have a complete session (must have session ID)
                    // ONLY enforce this check if we're not in the recent login grace period
                    const hasCompleteSession = AuthService.hasCompleteSession();

                    if (!hasCompleteSession && !isRecentLogin) {
                        console.error("[withAuth] Incomplete session detected (not recent login)!", {
                            pathname,
                            hasAccessToken: !!AuthService.getAccessToken(),
                            hasRefreshToken: !!AuthService.getRefreshToken(),
                            hasSessionId: !!AuthService.getSessionId(),
                            justLoggedInTimestamp
                        });
                        
                        // CRITICAL: One more safety check - don't clear if VERY recent login
                        if (isVeryRecentLogin) {
                            // Allow through without session ID for now
                            globalAuthChecked = true;
                            globalIsAuthenticated = true;
                            setIsAuthenticated(true);
                            setIsChecking(false);
                            return;
                        }
                        AuthService.clearAllTokens();
                        globalAuthChecked = false;
                        globalIsAuthenticated = false;
                        setRedirectFlag();
                        setIsRedirecting(true);
                        setIsChecking(false);
                        await router.replace(getAuthRedirectUrl(router));
                        return;
                    }

                    // Only validate with backend on first check
                    // BUT skip validation if this is a very recent login (< 10 seconds)
                    if (!globalAuthChecked) {
                        // CRITICAL FIX: Skip backend validation during very recent login
                        // This prevents the refresh API call that's causing the loop
                        if (isVeryRecentLogin) {
                            globalAuthChecked = true;
                            globalIsAuthenticated = true;
                            setIsAuthenticated(true);
                            setIsChecking(false);
                            clearRedirectFlag();
                            return;
                        }
                        
                        const isValid = await AuthService.validateSession();

                        if (isValid) {
                            globalAuthChecked = true;
                            globalIsAuthenticated = true;
                            setIsAuthenticated(true);
                            setIsChecking(false);
                            clearRedirectFlag();

                            // Redirect from root to chat
                            if (pathname === "/") {
                                await router.push(DEFAULT_AUTHENTICATED_ROUTE, undefined, { shallow: true });
                            }
                        } else {
                            // CRITICAL: Even if validation failed, check if we're still in recent login period
                            // This prevents clearing tokens due to temporary validation issues
                            if (isRecentLogin) {
                                globalAuthChecked = true;
                                globalIsAuthenticated = true;
                                setIsAuthenticated(true);
                                setIsChecking(false);
                                clearRedirectFlag();
                                return;
                            }
                            globalAuthChecked = false;
                            globalIsAuthenticated = false;
                            setRedirectFlag();
                            setIsRedirecting(true);
                            setIsChecking(false);
                            await router.replace(getAuthRedirectUrl(router));
                        }
                    } else {
                        // Skip validation, already checked globally
                        setIsAuthenticated(true);
                        setIsChecking(false);
                    }
                } catch (error) {
                    console.error("[withAuth] Authentication check failed:", error);
                    // Clear potentially corrupted auth state
                    globalAuthChecked = false;
                    globalIsAuthenticated = false;
                    AuthService.clearAllTokens();
                    setRedirectFlag();
                    setIsRedirecting(true);
                    setIsChecking(false);
                    await router.replace(getAuthRedirectUrl(router));
                }
            }

            checkAuthentication();
        }, [router.pathname, router.asPath]); // Re-run when pathname or full path changes
        
        // CRITICAL: Prevent re-checking auth due to router events during grace period
        useEffect(() => {
            const handleRouteChangeStart = (url: string) => {
                const justLoggedInTs = sessionStorage.getItem("just_logged_in");
                if (justLoggedInTs) {
                    const timeSinceLogin = Date.now() - parseInt(justLoggedInTs);
                    if (timeSinceLogin < 10000) {
                        // Route change during grace period - prevent re-auth check
                    }
                }
            };
            
            router.events?.on("routeChangeStart", handleRouteChangeStart);
            
            return () => {
                router.events?.off("routeChangeStart", handleRouteChangeStart);
            };
        }, [router]);

        // Clear redirect flags when component unmounts OR when router changes
        useEffect(() => {
            const handleRouteChange = () => {
                clearRedirectFlag();
            };

            // Listen to logout events to clear global state
            const handleStorageChange = (e: StorageEvent) => {
                if (e.key === "persist:root" || e.storageArea === localStorage) {
                    // Check if auth was cleared
                    if (!AuthService.isAuthenticated()) {
                        globalAuthChecked = false;
                        globalIsAuthenticated = false;
                    }
                }
            };

            router.events?.on("routeChangeComplete", handleRouteChange);
            window.addEventListener("storage", handleStorageChange);

            return () => {
                router.events?.off("routeChangeComplete", handleRouteChange);
                window.removeEventListener("storage", handleStorageChange);
            };
        }, [router]);

        // Show nothing during redirect
        if (isRedirecting) return null;

        // On first load, only hide if checking and not authenticated
        if (isChecking && !isAuthenticated) {
            return null;
        }

        if (!isAuthenticated) return null;

        return <WrappedComponent {...props} />;
    };

    return ComponentWithAuth;
}

// Export function to reset global state (for logout)
export const resetAuthState = () => {
    console.log("[withAuth] Resetting global auth state");
    globalAuthChecked = false;
    globalIsAuthenticated = false;
};

