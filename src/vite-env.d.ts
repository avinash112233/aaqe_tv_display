/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AAQE_FORECAST_BASE_URL?: string;
  readonly VITE_AAQE_USE_DIRECT_NASA?: string;
  readonly VITE_REFRESH_MINUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
