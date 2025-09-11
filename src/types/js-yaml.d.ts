declare module "js-yaml" {
  interface DumpOptions {
    indent?: number;
    noRefs?: boolean;
  }
  export function load(str: string): unknown;
  export function dump(obj: unknown, opts?: DumpOptions): string;
  const _default: {
    load: typeof load;
    dump: typeof dump;
  };
  export default _default;
}
