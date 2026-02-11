import { isRedirectInProgress, setRedirectFlag, clearRedirectFlag } from "./redirectUtils";
import { DEFAULT_AUTHENTICATED_ROUTE } from "./authConstants";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AuthService } from "@utils";

/**
 * Global validation state
 * Tracks whether we've validated the session during this browser session
 * Reset on logout via resetAuthState()
 */
let hasValidatedThisSession = false;

export function withAuth<P>(WrappedComponent: React.ComponentType<P>): React.FC<P> {
    return (props: P) => {
        const router = useRouter();
        const [isAuthenticated, setIsAuthenticated] = useState(false);
        const [isChecking, setIsChecking] = useState(true);

        useEffect(() => {
            async function checkAuth() {
                const { pathname } = router;

                // Skip check if redirect is in progress
                if (isRedirectInProgress()) {
                    console.log("[withAuth] Redirect in progress, waiting...");
                    setIsChecking(false);
                    return;
                }

                try {
                    console.log("[withAuth] Checking auth for:", pathname);

                    // Step 1: Check if user has tokens
                    if (!AuthService.isAuthenticated()) {
                        console.log("[withAuth] No valid tokens found");
                        handleAuthFailure();
                        return;
                    }

                    // Step 2: Check if session is complete (has sessionId)
                    if (!AuthService.hasCompleteSession()) {
                        console.log("[withAuth] Incomplete session (missing sessionId)");
                        AuthService.clearAllTokens();
                        handleAuthFailure();
                        return;
                    }

                    // Step 3: Validate with backend (ONLY if not validated this session)
                    if (!hasValidatedThisSession) {
                        console.log("[withAuth] Validating session with backend...");
                        const isValid = await AuthService.validateSession();

                        if (!isValid) {
                            console.log("[withAuth] Session validation failed");
                            handleAuthFailure();
                            return;
                        }

                        // Mark as validated for this session
                        hasValidatedThisSession = true;
                        console.log("[withAuth] Session validated successfully");
                    } else {
                        console.log("[withAuth] Already validated this session, skipping backend check");
                    }

                    // Success: user is authenticated
                    clearRedirectFlag();
                    setIsAuthenticated(true);
                    setIsChecking(false);

                    // Redirect root to default authenticated route
                    if (pathname === "/") {
                        router.push(DEFAULT_AUTHENTICATED_ROUTE, undefined, { shallow: true });
                    }
                } catch (error) {
                    console.error("[withAuth] Auth check error:", error);
                    AuthService.clearAllTokens();
                    handleAuthFailure();
                }
            }

            function handleAuthFailure() {
                hasValidatedThisSession = false;
                setIsAuthenticated(false);
                setIsChecking(false);

                // Build redirect URL with current path
                const currentPath = router.pathname;
                const shouldPreservePath = currentPath !== "/" && !currentPath.includes("/auth");

                if (shouldPreservePath) {
                    const fullPath = router.asPath;
                    setRedirectFlag();
                    router.replace(`/auth?redirectTo=${encodeURIComponent(fullPath)}`);
                } else {
                    setRedirectFlag();
                    router.replace("/auth");
                }
            }

            checkAuth();
        }, [router.pathname]);

        // Listen for logout events to reset validation state
        useEffect(() => {
            const handleStorageChange = (e: StorageEvent) => {
                if (e.key === "persist:root" || e.storageArea === localStorage) {
                    if (!AuthService.isAuthenticated()) {
                        console.log("[withAuth] Auth cleared, resetting validation state");
                        hasValidatedThisSession = false;
                    }
                }
            };

            const handleRouteChange = () => {
                clearRedirectFlag();
            };

            window.addEventListener("storage", handleStorageChange);
            router.events?.on("routeChangeComplete", handleRouteChange);

            return () => {
                window.removeEventListener("storage", handleStorageChange);
                router.events?.off("routeChangeComplete", handleRouteChange);
            };
        }, [router]);

        // Don't render anything while checking or if not authenticated
        if (isChecking || !isAuthenticated) {
            return null;
        }

        return <WrappedComponent {...(props as any)} />;
    };
}

export const resetAuthState = () => {
    console.log("[withAuth] Resetting validation state");
    hasValidatedThisSession = false;
};

