import React from "react";

export interface StepDefinition {
  id: number | string;
  label: string;
  disabled?: boolean;
}

interface StepperProps {
  steps: StepDefinition[];
  current: number | string;
  onChange: (id: number | string) => void;
  size?: "sm" | "md";
  className?: string;
  style?: React.CSSProperties;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  current,
  onChange,
  size = "md",
  className,
  style,
}) => {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        gap: ".75rem",
        flexWrap: "wrap",
        ...(style || {}),
      }}
    >
      {steps.map((s, index) => {
        const isActive = current === s.id;
        const isCompleted =
          !isActive && steps.findIndex((st) => st.id === current) > index;
        const disabled = s.disabled && !isActive;
        const base: React.CSSProperties = {
          display: "flex",
          alignItems: "center",
          gap: ".5rem",
          cursor: disabled ? "not-allowed" : "pointer",
          position: "relative",
          padding:
            size === "sm"
              ? ".3rem .6rem .3rem .45rem"
              : ".4rem .75rem .4rem .5rem",
          borderRadius: ".5rem",
          background: "#f3f4f6",
          fontSize: size === "sm" ? ".65rem" : ".75rem",
          fontWeight: 500,
          transition: "background .2s, color .2s",
          opacity: disabled ? 0.5 : 1,
        };
        if (isActive) {
          Object.assign(base, { background: "#2563eb", color: "#fff" });
        } else if (isCompleted) {
          Object.assign(base, { background: "#10b981", color: "#fff" });
        }
        const circle: React.CSSProperties = {
          width: size === "sm" ? "1.05rem" : "1.35rem",
          height: size === "sm" ? "1.05rem" : "1.35rem",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            isActive || isCompleted
              ? "rgba(255,255,255,.25)"
              : "rgba(0,0,0,.1)",
          fontSize: size === "sm" ? ".55rem" : ".65rem",
          fontWeight: 600,
        };
        return (
          <div
            key={s.id}
            style={base}
            onClick={() => !disabled && onChange(s.id)}
          >
            <div style={circle}>{index + 1}</div>
            <span>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
};
