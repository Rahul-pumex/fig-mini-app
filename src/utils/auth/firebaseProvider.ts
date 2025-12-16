// Firebase OAuth provider for SuperTokens
// Since Firebase Auth uses Google OAuth for web, we create a custom provider
// that integrates Firebase Authentication with SuperTokens

interface FirebaseProviderConfig {
    clientId?: string;
    scope?: string[];
}

export const Firebase = (config?: FirebaseProviderConfig) => {
    const { clientId = process.env.NEXT_PUBLIC_FIREBASE_WEB_CLIENT_ID || "", scope = ["openid", "profile", "email"] } = config || {};

    return {
        id: "firebase",
        name: "Firebase",

        getRedirectUri: () => {
            if (typeof window !== "undefined") {
                return `${window.location.origin}/api/auth/callback/firebase`;
            }
            return "";
        },

        getAuthorisationRedirectURL: async (redirectURIOnProviderDashboard: string) => {
            // Firebase typically uses Google OAuth for web authentication
            const params = new URLSearchParams({
                client_id: clientId,
                response_type: "code",
                scope: scope.join(" "),
                redirect_uri: redirectURIOnProviderDashboard,
                access_type: "offline",
                prompt: "consent",
                // Add state parameter for security
                state: btoa(
                    JSON.stringify({
                        provider: "firebase",
                        timestamp: Date.now()
                    })
                )
            });

            return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
        },

        exchangeAuthCodeForOAuthTokens: async (redirectURIOnProviderDashboard: string, authCodeFromProvider: string) => {
            const response = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: process.env.FIREBASE_CLIENT_SECRET || "",
                    code: authCodeFromProvider,
                    grant_type: "authorization_code",
                    redirect_uri: redirectURIOnProviderDashboard
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to exchange code for tokens: ${response.status} - ${error}`);
            }

            return await response.json();
        },

        getUserInfo: async (oAuthTokens: { access_token: string }) => {
            const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${oAuthTokens.access_token}`);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to get user info: ${response.status} - ${error}`);
            }

            const userInfo = await response.json();

            return {
                thirdPartyUserId: `firebase-${userInfo.id}`, // Prefix to distinguish from regular Google OAuth
                email: {
                    id: userInfo.email,
                    isVerified: userInfo.verified_email || false
                },
                rawUserInfoFromProvider: {
                    fromIdTokenPayload: {},
                    fromUserInfoAPI: {
                        ...userInfo,
                        provider: "firebase" // Mark this as Firebase auth
                    }
                }
            };
        }
    };
};

