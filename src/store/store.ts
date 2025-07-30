import { configureStore } from "@reduxjs/toolkit";
import addressReducer from "./addressSlice";
import authReducer from "./authSlice"; // ✅ Add this

export const store = configureStore({
  reducer: {
    address: addressReducer,
    auth: authReducer, // ✅ Add this
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
