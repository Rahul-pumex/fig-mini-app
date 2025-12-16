import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from "redux-persist";
import storage from "redux-persist/lib/storage";
import authReducer from "./slices/authSlice";

// CRITICAL FIX: Combine reducers FIRST, then persist the root
const rootReducer = combineReducers({
    auth: authReducer
});

const persistConfig = {
    key: "root",
    storage,
    whitelist: ["auth"],
    throttle: 0, // CRITICAL FIX: Disable throttling for immediate writes
    writeFailHandler: (err: Error) => {
        console.error("[Redux Persist] Write failed:", err);
    }
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
            }
        })
});

export const persistor = persistStore(store);

// Export a function to wait for persist to complete
export const waitForPersist = (): Promise<void> => {
    return new Promise((resolve) => {
        const unsubscribe = store.subscribe(() => {
            // Check if persist has run
            const state = store.getState();
            if (state && (state as any)._persist?.rehydrated !== false) {
                unsubscribe();
                // Give it a tiny bit more time to actually write to localStorage
                setTimeout(resolve, 100);
            }
        });
        
        // Failsafe timeout
        setTimeout(() => {
            unsubscribe();
            resolve();
        }, 2000);
    });
};

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;


