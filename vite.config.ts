/// <reference types="node" />

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.VITE_PUBLIC_BASE ?? "./",
    plugins: [react()],
    server: {
      port: Number(env.VITE_DEV_PORT ?? 5173),
      strictPort: true,
    },
  };
});
