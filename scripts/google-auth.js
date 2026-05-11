#!/usr/bin/env node
// One-time CLI helper to obtain a Google OAuth refresh token for restricted-sheet access.
// Run with: npm run auth
//
// Prereqs:
//   1. Create an OAuth 2.0 Client (type "Desktop" or "Web") at
//      https://console.cloud.google.com/apis/credentials
//   2. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local (or your shell env)
//   3. Add http://localhost:53682/callback to the authorized redirect URIs (Web type)
//      OR pick a Desktop client (loopback redirects work without registration).
//   4. Make sure your Google account has been granted view access to the target sheet.

import http from 'node:http';
import { URL } from 'node:url';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

// Tiny .env.local loader so the user doesn't have to source it manually.
function loadDotEnv() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val;
  }
}

loadDotEnv();

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('\n[ERROR] Missing GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET.');
  console.error('Set them in .env.local or your shell env, then re-run `npm run auth`.\n');
  console.error('Create credentials at: https://console.cloud.google.com/apis/credentials');
  console.error('  - Type: "Web application" (or "Desktop")');
  console.error(`  - Authorized redirect URI: ${REDIRECT_URI}`);
  console.error('  - Scope needed at consent: Google Sheets read-only\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // force consent so refresh_token is returned even on re-auth
  scope: SCOPES,
});

console.log('\nOpen this URL in your browser to authorize:\n');
console.log(authUrl + '\n');

// Try to auto-open. On Windows, `start ""` opens the default browser.
const opener = process.platform === 'win32' ? `start "" "${authUrl}"`
  : process.platform === 'darwin' ? `open "${authUrl}"`
  : `xdg-open "${authUrl}"`;
exec(opener, (err) => {
  if (err) console.log('(Could not auto-open browser. Copy the URL above manually.)\n');
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname !== '/callback') {
      res.writeHead(404); res.end('Not found'); return;
    }
    const code = url.searchParams.get('code');
    const errParam = url.searchParams.get('error');
    if (errParam) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h1>Authorization failed</h1><p>${errParam}</p>`);
      console.error(`\n[ERROR] ${errParam}`);
      server.close(() => process.exit(1));
      return;
    }
    if (!code) {
      res.writeHead(400); res.end('Missing code'); return;
    }

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>No refresh token returned</h1><p>Revoke access at https://myaccount.google.com/permissions and rerun.</p>');
      console.error('\n[ERROR] No refresh_token returned. This usually means the account previously authorized this client.');
      console.error('  Fix: visit https://myaccount.google.com/permissions, revoke the app, then rerun `npm run auth`.\n');
      server.close(() => process.exit(1));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Success</h1><p>You can close this tab and return to the terminal.</p>');

    console.log('\n=== SUCCESS ===\n');
    console.log('Add this line to .env.local:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log('Also set SHEET_ID_STD, SHEET_GID_STD_BAU, and SHEET_GID_STD_JLV (see .env.example).\n');
    server.close(() => process.exit(0));
  } catch (e) {
    console.error('\n[ERROR]', e.message);
    res.writeHead(500); res.end('Internal error');
    server.close(() => process.exit(1));
  }
});

server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT} for OAuth callback...\n`);
});
