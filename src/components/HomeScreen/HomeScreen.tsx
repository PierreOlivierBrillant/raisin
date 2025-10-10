import React, { useMemo, useState } from "react";
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
  const [infoTarget, setInfoTarget] = useState<
    "standardizer" | "commandeur" | null
  >(null);

  const isCommandeurDisabled = !isDesktop;

  const overlayContent = useMemo(() => {
    if (infoTarget === "standardizer") {
      return {
        title: "Standardisateur",
        description:
          "Le Standardisateur analyse des archives ZIP d'étudiants et réorganise automatiquement leur contenu d'après le modèle Raisin.",
        steps: [
          "Sélectionnez les fichiers ZIP d'origine pour les importer dans Raisin.",
          "Vérifiez le plan généré (dossiers, fichiers, correspondances).",
          "Exportez une archive standardisée prête à être partagée ou évaluée.",
        ],
        extra:
          "Utilisez-le dès que vous recevez plusieurs copies d'étudiants et que vous souhaitez les mettre au même format sans passer des heures à ranger chaque dossier à la main.",
      } as const;
    }
    if (infoTarget === "commandeur") {
      return {
        title: "Commandeur",
        description:
          "Commandeur orchestre une suite d'opérations locales (copies, renommages, scripts…) pour automatiser vos préparations de projets.",
        steps: [
          "Construisez ou importez un workflow : chaque étape décrit une action à exécuter sur vos dossiers.",
          "Validez le workflow pour détecter les erreurs de configuration avant exécution.",
          "Lancez Commandeur : Raisin applique automatiquement les opérations sur votre workspace local.",
        ],
        extra:
          "Cet outil est disponible uniquement dans l'application desktop car il agit directement sur votre système de fichiers.",
      } as const;
    }
    return null;
  }, [infoTarget]);

  const handleTileKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    handler: () => void,
    disabled?: boolean
  ) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handler();
    }
  };

  const closeOverlay = () => setInfoTarget(null);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Raisin 🍇</h1>
        <h2>Choisissez un outil</h2>
      </header>
      <main className="main-content">
        <div className="home-grid">
          <div
            className="tile"
            role="button"
            tabIndex={0}
            onClick={onSelectStandardizer}
            onKeyDown={(event) =>
              handleTileKeyDown(event, onSelectStandardizer)
            }
          >
            <button
              type="button"
              className="tile-info-button"
              aria-label="En savoir plus sur le Standardisateur"
              onClick={(event) => {
                event.stopPropagation();
                setInfoTarget("standardizer");
              }}
            >
              ℹ️
            </button>
            <div className="tile-leading">
              <span className="tile-icon" aria-hidden="true">
                📦
              </span>
              <div className="tile-body">
                <h3 className="tile-title">Standardisateur</h3>
                <p className="tile-desc">
                  Analysez et standardisez des archives ZIP d'étudiants selon un
                  modèle hiérarchique.
                </p>
                <span className="tile-cta">Ouvrir →</span>
              </div>
            </div>
          </div>
          <div className="tile-wrapper">
            <div
              className="tile"
              role="button"
              tabIndex={isCommandeurDisabled ? -1 : 0}
              aria-disabled={isCommandeurDisabled}
              data-disabled={isCommandeurDisabled || undefined}
              onClick={() => {
                if (!isCommandeurDisabled) {
                  onSelectCommandeur();
                }
              }}
              onKeyDown={(event) =>
                handleTileKeyDown(
                  event,
                  onSelectCommandeur,
                  isCommandeurDisabled
                )
              }
              title={
                isCommandeurDisabled
                  ? "Disponible uniquement sur l'application desktop (Windows, macOS, Linux)"
                  : undefined
              }
            >
              <button
                type="button"
                className="tile-info-button"
                aria-label="En savoir plus sur Commandeur"
                onClick={(event) => {
                  event.stopPropagation();
                  setInfoTarget("commandeur");
                }}
              >
                ℹ️
              </button>
              <div className="tile-leading">
                <span className="tile-icon" aria-hidden="true">
                  🛠️
                </span>
                <div className="tile-body">
                  <h3 className="tile-title">Commandeur</h3>
                  <p className="tile-desc">
                    Gérez et exécutez des commandes/automatisations locales
                    (uniquement desktop).
                  </p>
                  <span className="tile-cta">
                    {isDesktop ? "Ouvrir →" : "Desktop requis"}
                  </span>
                </div>
              </div>
            </div>
            {!isDesktop && (
              <div className="tile-tooltip">
                Fonctionnalité disponible uniquement sur la version desktop.
              </div>
            )}
          </div>
        </div>
        {overlayContent && (
          <div
            role="presentation"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(17, 24, 39, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1.5rem",
              zIndex: 1000,
            }}
            onClick={closeOverlay}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="home-info-title"
              style={{
                background: "#fff",
                borderRadius: "1rem",
                maxWidth: "480px",
                width: "100%",
                padding: "1.75rem",
                boxShadow: "0 25px 50px -12px rgba(30, 41, 59, 0.35)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="home-info-title" style={{ margin: 0 }}>
                {overlayContent.title}
              </h3>
              <p style={{ margin: 0, color: "#374151" }}>
                {overlayContent.description}
              </p>
              <div>
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
                  Comment l'utiliser ?
                </h4>
                <ul
                  style={{ margin: 0, paddingLeft: "1.1rem", color: "#4b5563" }}
                >
                  {overlayContent.steps.map((step) => (
                    <li key={step} style={{ marginBottom: "0.5rem" }}>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
              <p style={{ margin: 0, color: "#1f2937", fontWeight: 500 }}>
                {overlayContent.extra}
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn" type="button" onClick={closeOverlay}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default HomeScreen;
