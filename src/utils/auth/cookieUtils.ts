export const getCookie = (name: string): string | null => {
    if (typeof document === "undefined") {
        return null;
    }

    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith(name + "=")) {
            return cookie.substring(name.length + 1);
        }
    }
    return null;
};

export const setCookie = (
    name: string,
    value: string,
    options: {
        expires?: Date | number;
        path?: string;
        secure?: boolean;
        sameSite?: "strict" | "lax" | "none";
    } = {}
): void => {
    if (typeof document === "undefined") {
        return;
    }

    let cookieStr = `${name}=${value}`;

    if (options.expires) {
        if (typeof options.expires === "number") {
            const expiryDate = new Date();
            expiryDate.setTime(expiryDate.getTime() + options.expires);
            cookieStr += `; expires=${expiryDate.toUTCString()}`;
        } else {
            cookieStr += `; expires=${options.expires.toUTCString()}`;
        }
    }

    if (options.path) {
        cookieStr += `; path=${options.path}`;
    } else {
        cookieStr += "; path=/";
    }

    if (options.secure) {
        cookieStr += "; secure";
    }

    if (options.sameSite) {
        cookieStr += `; samesite=${options.sameSite}`;
    }

    document.cookie = cookieStr;
};

export const deleteCookie = (name: string, path = "/"): void => {
    if (typeof document === "undefined") {
        return;
    }

    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path};`;
};


