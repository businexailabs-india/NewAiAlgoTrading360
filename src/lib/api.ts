/** Relative /api works on Vercel (edge proxy) and local Vite proxy. */
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
