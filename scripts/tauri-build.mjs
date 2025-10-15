#!/usr/bin/env node
import { spawn } from "node:child_process";

const userArgs = process.argv.slice(2);
const tauriArgs = userArgs.length > 0 ? userArgs : ["build"];
const runner = process.platform === "win32" ? "npx.cmd" : "npx";
const runnerArgs = ["tauri", ...tauriArgs];

// linuxdeploy's bundled strip binary fails on RELR sections, so export NO_STRIP to bypass it.
const child = spawn(runner, runnerArgs, {
  env: { ...process.env, NO_STRIP: "1" },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
