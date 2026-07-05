/**
 * Vercel Serverless Prediction Endpoint
 * Deployed at /api/predict — used as inference target for prediction engines
 */
export default async function handler(req: Request): Promise<Response> {
  const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3001';
  const engineId = new URL(req.url).searchParams.get('engineId');

  if (!engineId) {
    return Response.json({ success: false, message: 'engineId query parameter required' }, { status: 400 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return Response.json({ success: false, message: 'Authorization required' }, { status: 401 });
  }

  try {
    const response = await fetch(`${backendUrl}/api/predictions/engines/${engineId}/predict`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error) {
    return Response.json(
      { success: false, message: 'Prediction service unavailable' },
      { status: 503 }
    );
  }
}
