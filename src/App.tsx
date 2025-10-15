import React, { useMemo, useState } from "react";
import Raisin from "./components/Raisin/Raisin";
import HomeScreen from "./components/HomeScreen/HomeScreen";
import Commandeur from "./components/Commandeur/Commandeur";

type Screen = "home" | "standard" | "command";

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>("home");
  const isDesktop = useMemo(() => {
    // Heuristique simple: Tauri injecte window.__TAURI__
    // On évite d'exploser en SSR éventuel.
    return typeof window !== "undefined" && "__TAURI__" in window;
  }, []);

  if (screen === "home") {
    return (
      <HomeScreen
        isDesktop={isDesktop}
        onSelectStandardizer={() => setScreen("standard")}
        onSelectCommandeur={() => setScreen("command")}
      />
    );
  }
  if (screen === "command") {
    return <Commandeur onBack={() => setScreen("home")} />;
  }
  return <Raisin onBack={() => setScreen("home")} />;
};

export default App;
