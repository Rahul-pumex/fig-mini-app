import SuperTokens from "supertokens-auth-react";
import EmailPassword from "supertokens-auth-react/recipe/emailpassword";
import Session from "supertokens-auth-react/recipe/session";
import { jwtDecode } from "jwt-decode";
import { store, persistor } from "@redux/store";
import { setTokens, setUser } from "@redux/slices/authSlice";
import { AuthService } from "./authService";

const COMPANY_NAME = "OmniScop Mini";

let websiteDomain = "http://localhost:3001";
if (typeof window !== "undefined") {
    websiteDomain = window.location.origin;
}

export const getTokenExpiry = (token: string): number => {
    try {
        const decoded: any = jwtDecode(token);
        if (decoded && decoded.exp) {
            return decoded.exp * 1000;
        }
        return Date.now() + 3600000;
    } catch (error) {
        console.error("Failed to decode token:", error);
        return Date.now() + 3600000;
    }
};

// Helper function to get header value with case-insensitive lookup
const getHeaderValue = (headers: Headers, headerName: string): string | null => {
    // Try exact case first
    let value = headers.get(headerName);
    if (value) return value;

    // Try lowercase
    value = headers.get(headerName.toLowerCase());
    if (value) return value;

    // Manual iteration through all headers
    for (const [key, val] of Array.from(headers.entries())) {
        if (key.toLowerCase() === headerName.toLowerCase()) {
            return val;
        }
    }

    return null;
};

// Helper function to perform redirect with history replacement
const performSecureRedirect = (redirectPath: string) => {
    if (typeof window !== "undefined") {
        // Clear the current page from history first
        window.history.replaceState(null, "", redirectPath);
        // Then navigate to the new page
        window.location.replace(redirectPath);
    }
};

export const initAuth = () => {
    if (typeof window !== "undefined") {
        try {
            const dynamicRecipes: any[] = [];

            // EmailPassword recipe with full token handling override
            dynamicRecipes.push(
                EmailPassword.init({
                    signInAndUpFeature: {
                        signUpForm: {
                            formFields: [
                                {
                                    id: "email",
                                    label: "Email",
                                    placeholder: "Email address"
                                },
                                {
                                    id: "password",
                                    label: "Password",
                                    placeholder: "Password"
                                }
                            ]
                        }
                    },
                    override: {
                        functions: (originalImplementation) => {
                            return {
                                ...originalImplementation,
                                signIn: async function (input) {
                                    const response = await originalImplementation.signIn(input);
                                    try {
                                        const accessToken = getHeaderValue(response.fetchResponse.headers, "st-access-token");
                                        const refreshToken = getHeaderValue(response.fetchResponse.headers, "st-refresh-token");
                                        const frontToken = getHeaderValue(response.fetchResponse.headers, "front-token");
                                        const sessionId = getHeaderValue(response.fetchResponse.headers, "x-session_id");
                                        
                                        if (accessToken && refreshToken) {
                                            let accessTokenExpiry;
                                            try {
                                                accessTokenExpiry = getTokenExpiry(accessToken);
                                            } catch (_decodeError) {
                                                accessTokenExpiry = Date.now() + 3600000;
                                            }
                                            
                                            const refreshTokenExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
                                            
                                            AuthService.storeTokens({
                                                accessToken,
                                                refreshToken,
                                                accessTokenExpiry,
                                                refreshTokenExpiry,
                                                sessionId: sessionId || ""
                                            });
                                            
                                            // CRITICAL: Wait for the flush to complete BEFORE continuing
                                            await persistor.flush(); // Force immediate persist
                                            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms for persistence
                                            
                                            // Set login timestamp flag (EXACT same as main app)
                                            try {
                                                sessionStorage?.setItem("just_logged_in", Date.now().toString());
                                            } catch (_) {}
                                            
                                            if (frontToken) {
                                                try {
                                                    const frontTokenParts = frontToken.split(".");
                                                    if (frontTokenParts.length > 0) {
                                                        const decodedFrontToken = atob(frontTokenParts[0]);
                                                        const frontTokenData = JSON.parse(decodedFrontToken);
                                                        if (frontTokenData?.uid) {
                                                            store.dispatch(
                                                                setUser({
                                                                    userId: frontTokenData.uid,
                                                                    email: frontTokenData.up?.email || undefined,
                                                                    username: frontTokenData.uid
                                                                })
                                                            );
                                                            
                                                            // Wait again after user dispatch
                                                            await persistor.flush(); // Flush again after user dispatch
                                                            await new Promise(resolve => setTimeout(resolve, 500)); // Extra safety
                                                            
                                                            const redirectPath = window.location.search
                                                                ? new URLSearchParams(window.location.search).get("redirectTo")
                                                                : null;
                                                            
                                                            performSecureRedirect(
                                                                redirectPath && redirectPath !== "undefined" && redirectPath !== "null"
                                                                    ? redirectPath
                                                                    : "/chat/new"
                                                            );
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.error("Error processing front token:", e);
                                                    
                                                    // Still wait before redirect
                                                    await new Promise(resolve => setTimeout(resolve, 300));
                                                    
                                                    const redirectPath = window.location.search
                                                        ? new URLSearchParams(window.location.search).get("redirectTo")
                                                        : null;
                                                    
                                                    performSecureRedirect(
                                                        redirectPath && redirectPath !== "undefined" && redirectPath !== "null"
                                                            ? redirectPath
                                                            : "/chat/new"
                                                    );
                                                }
                                            }
                                        }
                                    } catch (error) {
                                        console.error("Error extracting tokens:", error);
                                    }
                                    return response;
                                }
                            };
                        }
                    }
                })
            );

            // Session recipe with signOut override
            dynamicRecipes.push(
                Session.init({
                    tokenTransferMethod: "header",
                    override: {
                        functions: (originalImplementation) => {
                            return {
                                ...originalImplementation,
                                signOut: async function (input) {
                                    try {
                                        const accessToken = AuthService.getAccessToken();
                                        const sessionId = AuthService.getSessionId();
                                        if (accessToken && sessionId) {
                                            try {
                                                await fetch("/api/auth/logout", {
                                                    method: "POST",
                                                    headers: {
                                                        Authorization: `Bearer ${accessToken}`,
                                                        "x-session_id": sessionId,
                                                        "X-Skip-Session-Validation": "true",
                                                        "Content-Type": "application/json"
                                                    }
                                                });
                                            } catch (apiError) {
                                                console.warn("Backend logout API call failed:", apiError);
                                            }
                                        }
                                    } catch (e) {
                                        console.warn("Error during pre-logout tasks:", e);
                                    }
                                    AuthService.clearAllTokens();
                                    return originalImplementation.signOut(input);
                                }
                            };
                        }
                    }
                })
            );

            SuperTokens.init({
                enableDebugLogs: process.env.NEXT_PUBLIC_SUPERTOKENS_LOGGING_ENABLED === "true",
                defaultToSignUp: false,
                appInfo: {
                    appName: process.env.NEXT_PUBLIC_APP_NAME || COMPANY_NAME,
                    apiDomain: websiteDomain,
                    websiteDomain,
                    apiBasePath: "/api/auth",
                    websiteBasePath: "/auth"
                },
                recipeList: dynamicRecipes,
                getRedirectionURL: async (context) => {
                    if (context.action === "SUCCESS" && context.newSessionCreated) {
                        if (context.redirectToPath !== undefined && context.redirectToPath !== "undefined" && context.redirectToPath !== "null") {
                            return context.redirectToPath;
                        }
                        return "/chat/new";
                    }

                    if (context.action === "TO_AUTH") {
                        const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
                        if (currentPath && currentPath !== "/auth" && currentPath !== "/") {
                            return `/auth?redirectTo=${encodeURIComponent(currentPath)}`;
                        }

                        return "/auth";
                    }

                    return undefined;
                }
            });
        } catch (error) {
            console.error("SuperTokens initialization error (continuing anyway):", error);
        }
    }
};
