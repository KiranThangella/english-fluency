import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Registers the service worker so browsers offer a real "Install App"
// prompt (Chrome/Edge/Android) instead of this only working as a browser
// tab. Safe no-op on browsers without support (e.g. some older Safari).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("SW registration failed:", err));
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
