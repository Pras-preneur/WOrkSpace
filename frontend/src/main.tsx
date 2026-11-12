import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";
import { Router } from "./lib/router";
import { AuthProvider, ToastProvider } from "./lib/store";

createRoot(document.getElementById("root")!).render(
  <Router><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></Router>
);
