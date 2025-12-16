import { useEffect } from "react";
import { useRouter } from "next/router";
import { withAuth } from "@utils";

function ChatPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to /chat/new for new threads
        console.log("[Chat] Redirecting to /chat/new");
        router.replace("/chat/new");
    }, [router]);

    return (
        <div className="flex items-center justify-center h-screen bg-gradient-to-b from-white via-[#F5F0F3] to-[#E8DDE3]">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#745263]"></div>
                <p className="text-sm text-gray-600">Loading chat...</p>
            </div>
        </div>
    );
}

export default withAuth(ChatPage);

