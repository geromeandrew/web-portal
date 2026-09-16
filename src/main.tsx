import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider, TemporaryAuthBypassProvider } from "./auth/AuthProvider";
import { ENABLE_OKTA_AUTH } from "./auth/authMode";
import { OktaSecurityProvider } from "./auth/OktaSecurityProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      {ENABLE_OKTA_AUTH ? (
        <OktaSecurityProvider>
          <AuthProvider><App /></AuthProvider>
        </OktaSecurityProvider>
      ) : (
        <TemporaryAuthBypassProvider><App /></TemporaryAuthBypassProvider>
      )}
    </BrowserRouter>
  </React.StrictMode>,
);
