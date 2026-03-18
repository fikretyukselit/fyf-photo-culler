import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const savedTheme = localStorage.getItem("fyf-theme");
if (savedTheme === "light") {
  document.documentElement.classList.remove("dark");
} else {
  document.documentElement.classList.add("dark");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
