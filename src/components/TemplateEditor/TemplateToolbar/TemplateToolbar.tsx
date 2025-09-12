import React from "react";
import { Download, Upload } from "lucide-react";
import { templateToolbarStyles } from "./TemplateToolbar.styles";
import type { PresetKey } from "../TemplatePresets";
import reactLogo from "../../../assets/react.svg";
import angularLogo from "../../../assets/angular.svg";
import vueLogo from "../../../assets/vue.svg";
import dotnetLogo from "../../../assets/dotnet.svg";
import mavenLogo from "../../../assets/maven.svg";
import gradleLogo from "../../../assets/gradle.svg";
import flutterLogo from "../../../assets/flutter.svg";
import androidLogo from "../../../assets/android.svg";
import laravelLogo from "../../../assets/laravel.svg";
import djangoLogo from "../../../assets/django.svg";
import railsLogo from "../../../assets/ruby.svg";
import springBootLogo from "../../../assets/springboot.svg";

interface TemplateToolbarProps {
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddPreset: (key: PresetKey) => void;
}

export const TemplateToolbar: React.FC<TemplateToolbarProps> = ({
  onExport,
  onImport,
  onAddPreset,
}) => {
  return (
    <div style={templateToolbarStyles.container}>
      <button
        onClick={onExport}
        className="btn btn-success btn-compact"
        title="Exporter le modèle"
      >
        <Download size={14} /> Exporter
      </button>
      <label
        className="btn btn-primary btn-compact file-label"
        title="Importer un modèle"
        style={templateToolbarStyles.fileLabel}
      >
        <input
          type="file"
          accept=".yml,.yaml,text/yaml,application/x-yaml"
          onChange={onImport}
          hidden
        />
        <Upload size={14} /> Importer
      </label>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <PresetButton
          label="React"
          logo={reactLogo}
          onClick={() => onAddPreset("react")}
        />
        <PresetButton
          label="Angular"
          logo={angularLogo}
          onClick={() => onAddPreset("angular")}
        />
        <PresetButton
          label="Vue"
          logo={vueLogo}
          onClick={() => onAddPreset("vue")}
        />
        <PresetButton
          label=".NET"
          logo={dotnetLogo}
          onClick={() => onAddPreset("dotnet")}
        />
        <PresetButton
          label="Maven"
          logo={mavenLogo}
          onClick={() => onAddPreset("maven")}
        />
        <PresetButton
          label="Gradle"
          logo={gradleLogo}
          onClick={() => onAddPreset("gradle")}
        />
        <PresetButton
          label="Flutter"
          logo={flutterLogo}
          onClick={() => onAddPreset("flutter")}
        />
        <PresetButton
          label="Android"
          logo={androidLogo}
          onClick={() => onAddPreset("android")}
        />
        {/* Nouveaux presets */}
        <PresetButton
          label="Laravel"
          logo={laravelLogo}
          onClick={() => onAddPreset("laravel")}
        />
        <PresetButton
          label="Django"
          logo={djangoLogo}
          onClick={() => onAddPreset("django")}
        />
        <PresetButton
          label="Rails"
          logo={railsLogo}
          onClick={() => onAddPreset("rails")}
        />
        <PresetButton
          label="Spring"
          logo={springBootLogo}
          onClick={() => onAddPreset("springboot" as PresetKey)}
        />
      </div>
    </div>
  );
};

interface PresetButtonProps {
  label: string;
  logo: string;
  onClick: () => void;
}

const PresetButton: React.FC<PresetButtonProps> = ({
  label,
  logo,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="btn btn-secondary btn-compact"
    title={`Remplacer par le preset ${label}`}
    style={{ display: "flex", alignItems: "center", gap: 4 }}
  >
    <img
      src={logo}
      alt={label}
      style={{ width: 14, height: 14, display: "block" }}
      draggable={false}
    />
    {label}
  </button>
);

// PresetTextButton supprimé (tous les presets ont maintenant une variante avec logo)
