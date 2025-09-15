import React from "react";
import "../../styles/layout.css";

interface HomeScreenProps {
  onSelectStandardizer: () => void;
  onSelectCommandeur: () => void;
  isDesktop: boolean; // true si on est dans l'environnement Tauri
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectStandardizer,
  onSelectCommandeur,
  isDesktop,
}) => {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Raisin 🍇</h1>
        <h2>Choisissez un outil</h2>
      </header>
      <main className="main-content">
        <div className="home-grid">
          <button className="tile" onClick={onSelectStandardizer}>
            <div className="tile-body">
              <h3 className="tile-title">Standardisateur</h3>
              <p className="tile-desc">
                Analysez et standardisez des archives ZIP d'étudiants selon un
                modèle hiérarchique.
              </p>
              <span className="tile-cta">Ouvrir →</span>
            </div>
          </button>
          <div className="tile-wrapper">
            <button
              className="tile"
              onClick={() => {
                if (isDesktop) onSelectCommandeur();
              }}
              disabled={!isDesktop}
              aria-disabled={!isDesktop}
              data-disabled={!isDesktop || undefined}
              title={
                !isDesktop
                  ? "Disponible uniquement sur l'application desktop (Windows, macOS, Linux)"
                  : undefined
              }
            >
              <div className="tile-body">
                <div className="tile-badge">Nouveau</div>
                <h3 className="tile-title">Commandeur</h3>
                <p className="tile-desc">
                  Gérez et exécutez des commandes/automatisations locales
                  (uniquement desktop).
                </p>
                <span className="tile-cta">
                  {isDesktop ? "Ouvrir →" : "Desktop requis"}
                </span>
              </div>
            </button>
            {!isDesktop && (
              <div className="tile-tooltip">
                Fonctionnalité disponible uniquement sur la version desktop.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomeScreen;
