export default async (request, context) => {
  const url = new URL(request.url);

  if (url.pathname !== '/dashboard.html') return;

  const cookie = request.headers.get('cookie') || '';
  const authed = cookie.includes('lo_authed=1');

  if (!authed) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login.html' },
    });
  }
};

export const config = { path: '/dashboard.html' };
