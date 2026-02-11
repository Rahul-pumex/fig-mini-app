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
            /**
             * Global error handlers for uncaught session errors
             * Prevents errors from crashing the app and handles redirects gracefully
             */
            const handleGlobalError = (event: ErrorEvent) => {
                const isSessionError =
                    event.error?.message?.includes("No session exists") ||
                    event.error?.message?.includes("SuperTokens") ||
                    event.message?.includes("No session exists") ||
                    event.message?.includes("SuperTokens");

                if (isSessionError) {
                    console.warn("[App] Global session error:", event.error || event.message);
                    event.preventDefault();

                    if (!AuthService.isAuthenticated()) {
                        console.log("[App] Redirecting to /auth due to session error");
                        redirectToAuth(true);
                    }
                }
            };

            const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
                const isSessionError = event.reason?.message?.includes("No session exists") || event.reason?.message?.includes("SuperTokens");

                if (isSessionError) {
                    console.warn("[App] Unhandled promise rejection:", event.reason);
                    event.preventDefault();

                    if (!AuthService.isAuthenticated()) {
                        console.log("[App] Redirecting to /auth due to promise rejection");
                        redirectToAuth(true);
                    }
                }
            };

            window.addEventListener("error", handleGlobalError);
            window.addEventListener("unhandledrejection", handleUnhandledRejection);

            /**
             * Clear conflicting SuperTokens data if not authenticated
             * This prevents SuperTokens from interfering with our auth system
             */
            if (!AuthService.isAuthenticated()) {
                try {
                    AuthService.clearConflictingSuperTokensData();
                } catch (error) {
                    console.warn("[App] Error clearing SuperTokens data:", error);
                }
            }

            return () => {
                window.removeEventListener("error", handleGlobalError);
                window.removeEventListener("unhandledrejection", handleUnhandledRejection);
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