// Base URL of the Express backend. Leave VITE_API_URL unset in development:
// Vite proxies /api to the backend (see vite.config.ts).
export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
