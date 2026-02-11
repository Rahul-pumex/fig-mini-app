import { load } from "@fingerprintjs/fingerprintjs";

interface FingerprintResult {
    visitorId: string;
    confidence: {
        score: number;
    };
}

export const getDeviceFingerprint = async (): Promise<string> => {
    if (typeof window === "undefined") {
        console.warn("Fingerprinting not available on server-side, using fallback.");
        return `server-fallback-${Math.random().toString(36).substr(2, 9)}`;
    }

    try {
        const fp = await load({
            debug: process.env.NEXT_PUBLIC_FINGERPRINT_DEBUG === "true"
        });

        const result: FingerprintResult = await fp.get();
        const deviceId = result.visitorId;

        return deviceId;
    } catch (error) {
        console.error("Error generating fingerprint:", error);
        return `fallback-${Math.random().toString(36).substr(2, 9)}`;
    }
};

