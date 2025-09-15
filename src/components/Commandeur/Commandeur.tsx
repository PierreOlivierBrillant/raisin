import React from "react";
import "../../styles/layout.css";

interface CommandeurProps {
  onBack?: () => void;
}

export const Commandeur: React.FC<CommandeurProps> = ({ onBack }) => {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Raisin 🍇</h1>
        <h2>Commandeur (prototype)</h2>
        {onBack && (
          <div style={{ position: "absolute", left: 16, top: 12 }}>
            <button className="btn" onClick={onBack}>
              &larr; Accueil
            </button>
          </div>
        )}
      </header>
      <main className="main-content">
        <div className="card" style={{ maxWidth: 900, margin: "0 auto" }}>
          <h3 style={{ marginTop: 0 }}>Espace Commandeur</h3>
          <p>
            Cet espace accueillera un outil permettant de définir et exécuter
            des suites de commandes locales (scripts, traitements,
            post-processing, génération de rapports, etc.).
          </p>
          <ul>
            <li>Définition de profils de commandes</li>
            <li>Exécution séquentielle ou parallèle</li>
            <li>Visualisation des logs et statuts</li>
            <li>Exports et automatisations</li>
          </ul>
          <p
            style={{
              fontStyle: "italic",
              fontSize: "0.9rem",
              color: "#6b7280",
            }}
          >
            Prototype initial — interface à venir.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Commandeur;
