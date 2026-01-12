// Export authConfig (excluding getTokenExpiry to avoid conflict)
export { initAuth } from "./authConfig";

// Export authService (this is the main getTokenExpiry)
export { AuthService, getTokenExpiry } from "./authService";

// Export other modules
export { useFetchInterceptor } from "./fetchInterceptor";
export { withAuth, resetAuthState } from "./withAuth";
export { handleNoSessionError, setupGlobalErrorHandlers } from "./errorHandler";
export { getCookie, setCookie, deleteCookie } from "./cookieUtils";
export { setupAuthDebug } from "./debugUtils";
export {
    isRedirectInProgress,
    setRedirectFlag,
    clearRedirectFlag,
    shouldRedirectToAuth,
    redirectToAuth
} from "./redirectUtils";
export * from "./authConstants";

// Export sessionCheck functions (these are the canonical versions)
export { getSessionId, getUserId, clearCookies } from "./sessionCheck";
