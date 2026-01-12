import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiry: number;
    refreshTokenExpiry: number;
    sessionId: string;
}

export interface UserData {
    userId: string;
    emails: string[];
    username?: string;
    tenantId: string;
    userRoles: string[];
    onboarding_status: {
        onboarded: boolean;
        initialChoice: boolean;
    };
}

interface AuthState {
    tokens: AuthTokens | null;
    user: UserData | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

const initialState: AuthState = {
    tokens: null,
    user: null,
    isAuthenticated: false,
    isLoading: false
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setTokens: (state, action: PayloadAction<AuthTokens>) => {
            state.tokens = action.payload;
            state.isAuthenticated = true;
        },
        setUser: (state, action: PayloadAction<UserData>) => {
            state.user = action.payload;
        },
        clearAuth: (state) => {
            state.tokens = null;
            state.user = null;
            state.isAuthenticated = false;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        updateAccessToken: (state, action: PayloadAction<{ accessToken: string; accessTokenExpiry: number }>) => {
            if (state.tokens) {
                state.tokens.accessToken = action.payload.accessToken;
                state.tokens.accessTokenExpiry = action.payload.accessTokenExpiry;
            }
        }
    }
});

export const { setTokens, setUser, clearAuth, setLoading, updateAccessToken } = authSlice.actions;
export default authSlice.reducer;
