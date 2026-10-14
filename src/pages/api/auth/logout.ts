import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async () => {
  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  // Clear dev session cookie
  headers.append('Set-Cookie', 'dev_user_id=; Path=/; HttpOnly; Max-Age=0');
  headers.append('Set-Cookie', 'better-auth.session_token=; Path=/; HttpOnly; Max-Age=0');

  return new Response(JSON.stringify({ success: true, redirect: '/' }), {
    status: 200,
    headers,
  });
};
