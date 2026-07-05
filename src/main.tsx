import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { MarketDataProvider } from "./contexts/MarketDataContext.tsx";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <AuthProvider>
      <MarketDataProvider>
        <App />
      </MarketDataProvider>
    </AuthProvider>
  </ThemeProvider>
);
  