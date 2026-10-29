import { useEffect } from "react";
import { unstable_HistoryRouter as HistoryRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/notificationcontext";
import { ScoutProvider } from "./context/ScoutContext";
import AppRoutes from "./routes/AppRoutes";
import { createTransitionHistory } from "./routes/transitionHistory";

const history = createTransitionHistory();

function App() {
  useEffect(() => {
    // Automatically registers the background service worker on mount
    const registerServiceWorker = async () => {
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js");
          console.log("Service Worker registered successfully on scope:", registration.scope);
        } catch (error) {
          console.error("Service Worker registration failed:", error);
        }
      }
    };

    registerServiceWorker();
  }, []);

  return (
    <HistoryRouter history={history} useTransitions={false}>
      <AuthProvider>
        <NotificationProvider>
          <ScoutProvider>
            <AppRoutes />
          </ScoutProvider>
        </NotificationProvider>
      </AuthProvider>
    </HistoryRouter>
  );
}

export default App;
