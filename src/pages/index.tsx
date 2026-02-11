import { useRouter } from "next/router";
import { AuthService } from "@utils";
import { useEffect, useState } from "react";
import { GridSpinner } from "@components/atoms/GridSpinner";

export default function Home() {
    const router = useRouter();
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
        const handleRedirect = async () => {
            if (isRedirecting) return;
            
            setIsRedirecting(true);
            
            // CRITICAL: Wait longer for Redux persist to fully hydrate
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check if we just logged in
            const justLoggedInTs = sessionStorage.getItem("just_logged_in");
            const justLoggedIn = !!justLoggedInTs && Date.now() - Number(justLoggedInTs) < 30_000;
            
            const isAuthenticated = AuthService.isAuthenticated();

            if (isAuthenticated || justLoggedIn) {
                router.replace("/chat/new");
            } else {
                router.replace("/auth");
            }
        };

        handleRedirect();
    }, [router, isRedirecting]);

    return (
        <div className="flex items-center justify-center h-screen bg-white">
            <div className="flex flex-col items-center gap-4">
                <GridSpinner height={48} width={48} />
                <p className="text-sm text-gray-600">Loading...</p>
            </div>
        </div>
    );
}

