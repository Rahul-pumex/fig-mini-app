import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface User {
    userId: string;
    email?: string;
    username?: string;
}

interface Tokens {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiry: number;
    refreshTokenExpiry: number;
    sessionId: string;
}

interface AuthState {
    user: User | null;
    tokens: Tokens | null;
    isLoading: boolean;
}

const initialState: AuthState = {
    user: null,
    tokens: null,
    isLoading: false
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<User>) => {
            state.user = action.payload;
        },
        setTokens: (state, action: PayloadAction<Tokens>) => {
            state.tokens = action.payload;
        },
        updateAccessToken: (
            state,
            action: PayloadAction<{ accessToken: string; accessTokenExpiry: number }>
        ) => {
            if (state.tokens) {
                state.tokens.accessToken = action.payload.accessToken;
                state.tokens.accessTokenExpiry = action.payload.accessTokenExpiry;
            }
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        clearAuth: (state) => {
            state.user = null;
            state.tokens = null;
            state.isLoading = false;
        }
    }
});

export const { setUser, setTokens, updateAccessToken, setLoading, clearAuth } = authSlice.actions;
export default authSlice.reducer;


