/** Same-origin `/api/aeronet/*` (Vercel serverless or Vite dev proxy). */
export async function fetchAeronetUrl(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init);
}
