import "./polyfills";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { CloudAccountContext } from "./features/cloud/CloudAccountContext";
import { CloudAccountPage } from "./features/cloud/CloudAccountPage";
import { CloudLoginPage } from "./features/cloud/CloudLoginPage";
import { withoutAppBase } from "./platform/app-paths";
import { createCloudAccountRuntime } from "./platform/cloud-bootstrap";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("NEXOHUB_ROOT_NOT_FOUND");
}

const account = await createCloudAccountRuntime();
const route = withoutAppBase(window.location.pathname);
createRoot(root).render(
  <StrictMode>
    <CloudAccountContext.Provider value={account}>
      {route === "/cloud/login" ? (
        <CloudLoginPage />
      ) : route === "/conta" || route === "/conta/" ? (
        <CloudAccountPage />
      ) : (
        <App />
      )}
    </CloudAccountContext.Provider>
  </StrictMode>,
);
