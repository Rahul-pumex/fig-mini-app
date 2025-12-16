import { copilotKitEndpoint, CopilotRuntime, copilotRuntimeNextJSPagesRouterEndpoint, OpenAIAdapter } from "@copilotkit/runtime";
import { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

// Get runtime environment variables
const getAuthDomain = () => {
    return process.env.NEXT_PUBLIC_AUTH_DOMAIN || process.env.AUTH_DOMAIN || "";
};

const getAdminAgent = () => {
    return process.env.COPILOT_BACKEND_URL || process.env.NEXT_PUBLIC_ADMIN_AGENT || process.env.ADMIN_AGENT || "";
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    console.log("[CopilotKit API] Request received:", {
        method: req.method,
        hasAuthHeader: !!req.headers.authorization,
        hasSessionId: !!req.headers["x-session_id"]
    });

    // Extract authentication data from request headers
    const authHeader = req.headers.authorization;
    const sessionId = req.headers["x-session_id"] as string;

    // Extract access token from Authorization header
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    // Check if we have the minimum required tokens
    if (!accessToken) {
        return res.status(401).json({
            error: "Unauthorized: No access token available in Authorization header",
            hint: "Include 'Authorization: Bearer <token>' header in your request"
        });
    }

    // Validate session using server-side validation
    try {
        const authDomain = getAuthDomain();

        if (!authDomain) {
            console.error("[CopilotKit API] AUTH_DOMAIN not configured");
            return res.status(500).json({
                error: "Server configuration error: AUTH_DOMAIN not set"
            });
        }

        // Try session validation with session ID if available, otherwise use legacy validation
        let validateResponse;

        if (sessionId) {
            // Normal validation with session ID
            validateResponse = await fetch(`${authDomain}/api/auth/validate-session`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "x-session_id": sessionId,
                    "Content-Type": "application/json"
                }
            });
        } else {
            // Legacy validation using user-info endpoint
            console.log("[CopilotKit API] No session ID provided, using legacy validation via user-info endpoint");
            validateResponse = await fetch(`${authDomain}/api/auth/user-info`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            });
        }

        if (!validateResponse.ok) {
            console.error("[CopilotKit API] Session validation failed with status:", validateResponse.status);
            return res.status(401).json({
                error: "Unauthorized: Session validation failed",
                status: validateResponse.status
            });
        }

        console.log("[CopilotKit API] Session validation successful");
    } catch (error) {
        console.error("[CopilotKit API] Session validation error:", error);
        return res.status(401).json({
            error: "Unauthorized: Session validation error"
        });
    }

    const adminAgent = getAdminAgent();

    if (!adminAgent) {
        console.error("[CopilotKit API] ADMIN_AGENT not configured");
        return res.status(500).json({
            error: "Server configuration error: ADMIN_AGENT not set"
        });
    }

    // Initialize CopilotRuntime with remote endpoint
    const runtime = new CopilotRuntime({
        remoteEndpoints: [
            copilotKitEndpoint({
                url: `${adminAgent}/copilotkit`,
                onBeforeRequest: ({ ctx }) => {
                    return {
                        headers: {
                            Authorization: `Bearer ${ctx.properties.accessToken}`
                        }
                    };
                }
            })
        ]
    });

    // Create the request handler
    const handleRequest = copilotRuntimeNextJSPagesRouterEndpoint({
        endpoint: "/api/copilotkit",
        runtime,
        properties: {
            accessToken: accessToken
        },
        serviceAdapter: new OpenAIAdapter({ openai: new OpenAI({ apiKey: "" }) })
    });

    try {
        return await handleRequest(req, res);
    } catch (error) {
        console.error("Error handling copilotkit request:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export default handler;

export const config = { api: { bodyParser: false } };

