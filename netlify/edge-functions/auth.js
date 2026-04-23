export default async (request, context) => {
  const url = new URL(request.url);
  const protected_paths = ['/dashboard.html', '/config.js'];

  if (!protected_paths.includes(url.pathname)) return;

  const cookie = request.headers.get('cookie') || '';
  const authed = cookie.includes('lo_authed=1');

  if (!authed) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login.html' },
    });
  }
};

export const config = { path: ['/dashboard.html', '/config.js'] };
