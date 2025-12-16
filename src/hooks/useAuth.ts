import { useCallback } from "react";
import { useRouter } from "next/router";
import { useAppDispatch, useAppSelector } from "@redux/hooks";
import { setUser, setTokens, clearAuth } from "@redux/slices/authSlice";
import { AuthService } from "@utils";

export const useAuth = () => {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const auth = useAppSelector((state) => state.auth);

    const signIn = useCallback(
        async (email: string, password: string) => {
            try {
                const response = await fetch("/api/auth/signin", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (data.status === "OK" && data.tokens && data.user) {
                    const sessionId = response.headers.get("x-session_id");

                    if (!sessionId) {
                        return {
                            status: "GENERAL_ERROR",
                            message: "Session ID missing from response"
                        };
                    }

                    const tokensWithSessionId = {
                        ...data.tokens,
                        sessionId
                    };

                    AuthService.storeTokens(tokensWithSessionId);

                    dispatch(
                        setUser({
                            userId: data.user.id,
                            email: data.user.email,
                            username: data.user.username
                        })
                    );

                    setTimeout(() => {
                        router.push("/chat");
                    }, 500);

                    return { status: "OK" };
                }

                return data;
            } catch (error) {
                console.error("Sign in error:", error);
                return {
                    status: "GENERAL_ERROR",
                    message: "An error occurred during sign in"
                };
            }
        },
        [dispatch, router]
    );

    const signOut = useCallback(async () => {
        AuthService.clearAllTokens();
        dispatch(clearAuth());
        router.push("/auth");
    }, [dispatch, router]);

    return {
        user: auth.user,
        tokens: auth.tokens,
        isAuthenticated: !!auth.user && !!auth.tokens,
        signIn,
        signOut
    };
};


