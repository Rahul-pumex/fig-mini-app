import { CookieValueTypes, deleteCookie as deleteNextCookie, getCookie as getNextCookie } from "cookies-next/client";
import { deleteCookie } from "./cookieUtils";
import { store } from "@redux/store";

// Simple utility functions for cookie-based session data
export const getSessionId = (): CookieValueTypes => {
    return getNextCookie("sessionId");
};

export const getUserId = (): CookieValueTypes => {
    return getNextCookie("userId");
};

export const clearCookies = () => {
    // Clear legacy cookies using cookies-next
    deleteNextCookie("userId");
    deleteNextCookie("sAccessToken");
    deleteNextCookie("sessionId");
    deleteNextCookie("st-last-access-token-update");

    // Clear any other auth-related cookies that might be present
    deleteNextCookie("st-access-token");
    deleteNextCookie("st-refresh-token");
    deleteNextCookie("st-auth-state");

    // Clear our refresh_token cookie
    deleteCookie("refresh_token");

    // Clear the Redux store
    store.dispatch({ type: "auth/clearAuth" });
};

