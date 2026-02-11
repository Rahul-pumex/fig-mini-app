import { EmailPasswordPreBuiltUI } from "supertokens-auth-react/recipe/emailpassword/prebuiltui";
import SuperTokens from "supertokens-auth-react/ui";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AuthService } from "@utils";
import { GridSpinner } from "@components/atoms/GridSpinner";

const PreBuiltUIList = [EmailPasswordPreBuiltUI];

export default function Auth() {
    const [loaded, setLoaded] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const checkAuthAndLoad = async () => {
            // Wait a moment for Redux to hydrate
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Check if already authenticated
            const isAuthenticated = AuthService.isAuthenticated();
            
            if (isAuthenticated) {
                router.replace("/chat");
                return;
            }

            // Only clear old login flags if they're actually old (not from a recent login attempt)
            const justLoggedInTs = sessionStorage.getItem("just_logged_in");
            if (justLoggedInTs) {
                const timeSinceLogin = Date.now() - Number(justLoggedInTs);
                
                // Only clear if more than 10 seconds old
                if (timeSinceLogin > 10000) {
                    sessionStorage.removeItem("just_logged_in");
                    sessionStorage.removeItem("login_timestamp");
                    localStorage.removeItem("fresh_login");
                }
            }

            // Clear redirect flags when landing on auth page
            sessionStorage.removeItem("auth_redirecting");
            sessionStorage.removeItem("auth_redirecting_time");

            // Clear stale SuperTokens data that could cause auth conflicts
            // This is critical when redirecting after session timeout
            AuthService.clearConflictingSuperTokensData();

            // Wait a bit for SuperTokens to initialize after clearing conflicting data
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check if SuperTokens can handle the route
            // This ensures SuperTokens is properly initialized before rendering
            const canHandle = SuperTokens.canHandleRoute(PreBuiltUIList);
            
            if (canHandle === true) {
                setLoaded(true);
            } else {
                // Retry after a short delay - SuperTokens might need more time to initialize
                // This is especially important after a session timeout redirect
                setTimeout(() => {
                    const retryCanHandle = SuperTokens.canHandleRoute(PreBuiltUIList);
                    if (retryCanHandle === true) {
                        setLoaded(true);
                    } else {
                        // Final fallback: render anyway after timeout to prevent infinite loading
                        // SuperTokens.getRoutingComponent will handle the route internally
                        setLoaded(true);
                    }
                }, 200);
            }
        };

        checkAuthAndLoad();
    }, [router]);

    if (loaded) {
        return (
            <div className="flex items-center justify-center min-h-screen w-full bg-white" >
                <div className="w-full max-w-md flex items-center justify-center" style={{ padding: '32px' }}>
                    {SuperTokens.getRoutingComponent(PreBuiltUIList)}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center h-screen bg-white">
            <GridSpinner height={48} width={48} />
        </div>
    );
}