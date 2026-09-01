import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { OktaSecurityProvider } from "./auth/OktaSecurityProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <OktaSecurityProvider>
        <AuthProvider><App /></AuthProvider>
      </OktaSecurityProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
