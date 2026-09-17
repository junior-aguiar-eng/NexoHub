import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./features/account/AuthContext";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("NEXOHUB_ROOT_NOT_FOUND");
}

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
