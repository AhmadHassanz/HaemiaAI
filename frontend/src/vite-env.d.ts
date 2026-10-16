/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the backend API. Empty in local development — the Vite dev
   * server proxies /api to http://localhost:8000. In production (Vercel),
   * set this to the Render backend URL, e.g. https://haemiaai-1.onrender.com
   */
  readonly VITE_API_BASE_URL?: string;
}
