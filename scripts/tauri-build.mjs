#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const userArgs = process.argv.slice(2);
const tauriArgs = userArgs.length > 0 ? userArgs : ["build"];
const binName = process.platform === "win32" ? "tauri.cmd" : "tauri";
const localCli = resolve(process.cwd(), "node_modules", ".bin", binName);
const hasLocalCli = existsSync(localCli);
const command = hasLocalCli
  ? localCli
  : process.platform === "win32"
  ? "cmd.exe"
  : "tauri";
const commandArgs = hasLocalCli
  ? tauriArgs
  : process.platform === "win32"
  ? ["/d", "/s", "/c", "npx tauri", ...tauriArgs]
  : tauriArgs;

// linuxdeploy's bundled strip binary fails on RELR sections, so export NO_STRIP to bypass it.
const child = spawn(command, commandArgs, {
  env: { ...process.env, NO_STRIP: "1" },
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
