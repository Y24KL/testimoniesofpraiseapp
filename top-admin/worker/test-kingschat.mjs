import assert from 'node:assert/strict';
import { handleKingsChatCallback, siteRedirect } from './src/kingschat.js';

const post = (body) => new Request('https://example.test/api/auth/kingschat/callback', { method: 'POST', body });
const env = {};

// No code: sent back with "missing".
let res = await handleKingsChatCallback(post(new URLSearchParams({ state: 'x' })), env);
assert.equal(res.status, 303);
assert.match(res.headers.get('Location'), /kingschat=missing$/);

// A code: never signs in, reports "unavailable", and the code is not in the redirect.
res = await handleKingsChatCallback(post(new URLSearchParams({ code: 'SECRET-CODE-123' })), env);
assert.match(res.headers.get('Location'), /kingschat=unavailable$/);
assert.ok(!res.headers.get('Location').includes('SECRET-CODE-123'));

// GET is refused with a redirect, not processed.
res = await handleKingsChatCallback(new Request('https://example.test/api/auth/kingschat/callback'), env);
assert.match(res.headers.get('Location'), /kingschat=invalid$/);

// Only the site's own address is used for redirects.
assert.equal(siteRedirect('x', 'https://testimoniesofpraiseapp.com/'), 'https://testimoniesofpraiseapp.com/#/signin?kingschat=x');
console.log('kingschat callback tests passed');
