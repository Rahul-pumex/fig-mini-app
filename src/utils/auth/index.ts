export * from "./authConfig";
export * from "./authService";
export * from "./fetchInterceptor";
export * from "./sessionCheck";
export * from "./withAuth";
export * from "./errorHandler";
export * from "./cookieUtils";
export * from "./debugUtils";
export * from "./redirectUtils";
export * from "./authConstants";

// Export backward compatibility functions
export const getUserId = () => {
    // For backward compatibility, delegate to AuthService or sessionCheck
    const { getSessionId, getUserId } = require("./sessionCheck");
    return getUserId();
};

export const getSessionId = () => {
    // For backward compatibility, delegate to AuthService or sessionCheck
    const { getSessionId } = require("./sessionCheck");
    return getSessionId();
};
