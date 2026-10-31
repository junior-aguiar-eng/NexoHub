import "./polyfills";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { CloudAccountContext } from "./features/cloud/CloudAccountContext";
import { CloudLoginPage } from "./features/cloud/CloudLoginPage";
import { withoutAppBase } from "./platform/app-paths";
import { createCloudAccountRuntime } from "./platform/cloud-bootstrap";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("NEXOHUB_ROOT_NOT_FOUND");
}

const account = await createCloudAccountRuntime();
createRoot(root).render(
  <StrictMode>
    <CloudAccountContext.Provider value={account}>
      {withoutAppBase(window.location.pathname) === "/cloud/login" ? <CloudLoginPage /> : <App />}
    </CloudAccountContext.Provider>
  </StrictMode>,
);
