/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When 'true', the dashboard hits the live middleware POST /api/transaction/check/stream. */
  readonly VITE_USE_LIVE_SSE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
