/// <reference types="vite/client" />

interface TauriDialogFilter {
  name: string;
  extensions: string[];
}

interface TauriDialogApi {
  open(options: {
    multiple?: boolean;
    directory?: boolean;
    filters?: TauriDialogFilter[];
  }): Promise<string | string[] | null>;
}

interface TauriFsApi {
  readTextFile(path: string): Promise<string>;
}

interface TauriCoreApi {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

declare global {
  interface Window {
    __TAURI__?: {
      dialog?: TauriDialogApi;
      fs?: TauriFsApi;
      tauri?: TauriCoreApi;
    };
  }
}

export {};
