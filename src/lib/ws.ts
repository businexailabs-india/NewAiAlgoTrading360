/** WebSocket base URL — must hit backend directly (not Vercel /api proxy). */
export function getWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }

  return 'http://smarttrade-alb-1574969447.ap-south-1.elb.amazonaws.com';
}
