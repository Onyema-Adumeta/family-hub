// Types for Vite-specific imports, used by `pnpm --filter web typecheck`.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly [key: string]: string | undefined;
}
interface ImportMeta { readonly env: ImportMetaEnv }
declare module '*.css';
declare module '*.svg' { const src: string; export default src; }
declare module '*.png' { const src: string; export default src; }
declare module 'virtual:pwa-register' { export function registerSW(options?: unknown): (reload?: boolean) => Promise<void>; }
