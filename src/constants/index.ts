// Agent name for CopilotKit
export const CHAT_AGENT_NAME = "chat-agent";
export const ADMIN_AGENT_NAME = "knowledge_agent"; // Same as CHAT_AGENT_NAME for mini app

// Thread page prefix
export const THREAD_PAGE_PREFIX = "/chat";

// API endpoints
export const API_ENDPOINTS = {
    CHAT: "/api/chat",
    AUTH: "/api/auth"
};

// App configuration
export const APP_CONFIG = {
    APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "OmniScop Mini",
    WEBSITE_DOMAIN: process.env.NEXT_PUBLIC_WEBSITE_DOMAIN || "http://localhost:3001",
    AUTH_DOMAIN: process.env.NEXT_PUBLIC_AUTH_DOMAIN || "http://localhost:8000"
};

// Status constants
export const IDLE = "IDLE";
export const LOADING = "LOADING";
export const SUCCESS = "SUCCESS";
export const ERROR = "ERROR";
