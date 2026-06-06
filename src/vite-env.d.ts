/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QWEN_API_KEY: string;
  readonly VITE_QWEN_MODEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
