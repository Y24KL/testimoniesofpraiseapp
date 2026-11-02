/**
 * KingsChat sign-in callback (redirect URL registered in the KingsChat developer dashboard).
 *
 * KingsChat posts the authorization code to this URL as a form (the code is not in the address bar).
 * Exchanging the code for the user's identity and creating a Firebase session is NOT built yet: the
 * KingsChat token and user-info documentation is still needed. Until then this endpoint only checks the
 * request and sends the person back to the website with a clear status. It never signs anyone in.
 *
 * The code is never logged and never placed in a URL.
 */

export const DEFAULT_SITE_URL = 'https://testimoniesofpraiseapp.com';

/** Where to send the person after the callback. Only the site's own address is used. */
export function siteRedirect(status, siteUrl = DEFAULT_SITE_URL) {
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return `${base}/#/signin?kingschat=${encodeURIComponent(status)}`;
}

export async function handleKingsChatCallback(request, env) {
  const site = env.SITE_URL || DEFAULT_SITE_URL;
  if (request.method !== 'POST') return Response.redirect(siteRedirect('invalid', site), 303);

  let code = '';
  try {
    const form = await request.formData();
    code = String(form.get('code') ?? '').trim();
  } catch {
    code = '';
  }
  if (!code || code.length > 512) return Response.redirect(siteRedirect('missing', site), 303);

  // Sign-in is not connected yet. Report that honestly rather than pretending it worked.
  return Response.redirect(siteRedirect('unavailable', site), 303);
}
