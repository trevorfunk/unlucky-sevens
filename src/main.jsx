import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import TabletopShell from "./ui/TabletopShell.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TabletopShell>
      <App />
    </TabletopShell>
  </StrictMode>
);
