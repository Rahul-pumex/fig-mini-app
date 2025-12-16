/**
 * Debug utilities for session management
 * These can be called from the browser console to help diagnose session issues
 */

import { handleNoSessionError } from "./errorHandler";
import { AuthService } from "./authService";

declare global {
    interface Window {
        authDebug: {
            checkSession: () => void;
            clearSession: () => void;
            getAuthState: () => any;
            testSessionValidation: () => Promise<boolean>;
            simulateSessionError: () => void;
            manualCleanup: () => void;
        };
    }
}

export const setupAuthDebug = () => {
    if (typeof window === "undefined") return;

    window.authDebug = {
        checkSession: () => {
            console.log("Auth State Check:");
            console.log("- Access Token:", AuthService.getAccessToken() ? "Present" : "Missing");
            console.log("- Session ID:", AuthService.getSessionId() || "Missing");
            console.log("- Is Authenticated:", AuthService.isAuthenticated());
            console.log("- Has Complete Session:", AuthService.hasCompleteSession());
            console.log("- Token Expired:", AuthService.isAccessTokenExpired());
        },

        clearSession: () => {
            console.log("Clearing all auth data...");
            AuthService.clearAllTokens();
            console.log("Session cleared");
        },

        getAuthState: () => {
            return {
                accessToken: AuthService.getAccessToken(),
                sessionId: AuthService.getSessionId(),
                isAuthenticated: AuthService.isAuthenticated(),
                hasCompleteSession: AuthService.hasCompleteSession(),
                isTokenExpired: AuthService.isAccessTokenExpired()
            };
        },

        testSessionValidation: async () => {
            console.log("Testing session validation...");
            try {
                const result = await AuthService.validateSession();
                console.log("Session validation result:", result);
                return result;
            } catch (error) {
                console.error("Session validation error:", error);
                return false;
            }
        },

        simulateSessionError: () => {
            console.log("Simulating 'No session exists' error...");
            handleNoSessionError(new Error("No session exists"));
        },

        manualCleanup: () => {
            console.log("Performing manual cleanup...");

            // Clear localStorage
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes("supertokens") || key.includes("st-") || key.includes("front-token"))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach((key) => {
                localStorage.removeItem(key);
            });

            // Clear cookies
            const cookiesToClear = ["st-access-token", "st-refresh-token", "front-token", "sessionId", "refresh_token"];
            cookiesToClear.forEach((cookieName) => {
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
            });

            // Clear auth service
            AuthService.clearAllTokens();

            console.log("Manual cleanup completed");
        }
    };

    console.log("Auth debug utilities loaded. Use window.authDebug to access debugging functions.");
};

