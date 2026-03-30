import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("FS Register app mounting");
createRoot(document.getElementById("root")!).render(<App />);
