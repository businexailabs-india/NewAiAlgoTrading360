/**
 * Vercel catch-all API proxy — forwards /api/* to AWS backend (ECS ALB).
 * Set BACKEND_API_URL in Vercel (e.g. http://smarttrade-alb-xxx.ap-south-1.elb.amazonaws.com)
 */
export const config = {
  runtime: 'edge'
};

export default async function handler(req: Request): Promise<Response> {
  const backendBase = (process.env.BACKEND_API_URL || 'http://localhost:3001').replace(/\/$/, '');
  const incoming = new URL(req.url);
  const target = `${backendBase}${incoming.pathname}${incoming.search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');

  const init: RequestInit = {
    method: req.method,
    headers
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  try {
    const response = await fetch(target, init);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch {
    return Response.json(
      { success: false, message: 'Backend unavailable. Check BACKEND_API_URL.' },
      { status: 503 }
    );
  }
}
