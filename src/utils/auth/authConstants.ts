/**
 * Centralized Authentication Constants
 *
 * This file contains all authentication-related constants used throughout the application.
 * Centralizing these values ensures consistency and makes maintenance easier.
 */

// ============================================================================
// TIMING CONSTANTS
// ============================================================================

/**
 * How long to consider a redirect flag valid before treating it as stale (5 seconds)
 * This prevents redirect loops while allowing legitimate redirects to complete
 */
export const REDIRECT_FLAG_TIMEOUT = 5000;

/**
 * How long after login to skip certain validation checks (10 seconds)
 * Provides a grace period for state to stabilize after authentication
 */
export const POST_LOGIN_GRACE_PERIOD = 10000;

/**
 * Delay before redirecting after successful login (500ms)
 * Ensures Redux state is fully updated before navigation
 */
export const POST_LOGIN_REDIRECT_DELAY = 500;

// ============================================================================
// SESSION STORAGE KEYS
// ============================================================================

/**
 * Flag indicating a redirect to /auth is in progress
 * Format: ISO timestamp string of when redirect was initiated
 */
export const REDIRECT_FLAG_KEY = "auth_redirecting";

// ============================================================================
// COOKIE NAMES
// ============================================================================

/**
 * Cookie storing the refresh token (as backup to Redux)
 */
export const REFRESH_TOKEN_COOKIE = "refresh_token";

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Endpoints that should skip session validation
 * These are authentication-related endpoints that don't require an active session
 */
export const AUTH_ENDPOINTS = [
    "/api/auth/signin",
    "/api/auth/logout",
    "/api/auth/signup",
    "/api/auth/validate-session",
    "/api/auth/session/refresh",
    "/api/auth/reset-password",
    "/api/auth/forgot-password",
    "/api/auth/user-info"
] as const;

// ============================================================================
// SUPERTOKENS STORAGE KEYS
// ============================================================================

/**
 * LocalStorage key patterns for SuperTokens data that may conflict
 * These are cleared when the user is not authenticated
 */
export const SUPERTOKENS_LOCALSTORAGE_PATTERNS = ["supertokens", "st-", "front-token"];

/**
 * Cookie names for SuperTokens that may conflict
 * These are cleared when the user is not authenticated
 */
export const SUPERTOKENS_COOKIE_NAMES = ["st-access-token", "st-refresh-token", "front-token", "sessionId"];

// ============================================================================
// DEFAULT ROUTES
// ============================================================================

/**
 * Default route for authenticated users
 */
export const DEFAULT_AUTHENTICATED_ROUTE = "/chat";

/**
 * Authentication page route
 */
export const AUTH_ROUTE = "/auth";

/**
 * Base/root route
 */
export const ROOT_ROUTE = "/";

