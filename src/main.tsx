import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { MarketDataProvider } from "./contexts/MarketDataContext.tsx";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { TradingModeProvider } from "./contexts/TradingModeContext.tsx";
import { WindowStackProvider } from "./contexts/WindowStackContext.tsx";
import { AlgosNavProvider } from "./contexts/AlgosNavContext.tsx";
import { QueryProvider } from "./providers/QueryProvider.tsx";
import { Toaster } from "./components/ui/sonner.tsx";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <AuthProvider>
      <TradingModeProvider>
        <QueryProvider>
          <MarketDataProvider>
            <WindowStackProvider>
              <AlgosNavProvider>
                <App />
                <Toaster richColors position="top-right" />
              </AlgosNavProvider>
            </WindowStackProvider>
          </MarketDataProvider>
        </QueryProvider>
      </TradingModeProvider>
    </AuthProvider>
  </ThemeProvider>
);
  