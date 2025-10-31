# Metabase interactive embedding (Express)

This project is a rebuilt version of the official Metabase Node.js interactive embedding sample using Express and EJS.

## Prerequisites

- Node.js 20+ (install locally or use the bundled binaries already downloaded earlier)
- A Metabase instance with interactive embedding + JWT SSO enabled

## Configuration

Set the following environment variables (via `.env` or your shell):

```
METABASE_SITE_URL=https://keen-buck.metabaseapp.com/
METABASE_JWT_SHARED_SECRET=<paste the JWT shared secret from Metabase>
METABASE_DASHBOARD_PATH=/dashboard/1
# optional
PORT=9090
METABASE_EMBED_PARAMS=embed=true&logo=false
SESSION_SECRET=change-me
METABASE_DEFAULT_USER_EMAIL=rene@example.com
METABASE_SESSION_TTL_MS=480000
```

If you keep a `.env` file at the project root these values will be loaded automatically.

## Install & run

```bash
cd /home/zaenal/metabase_embed
PATH="$PWD:$PATH" npm install
METABASE_JWT_SHARED_SECRET=... npm start
# or with a .env file:
npm start
```

Browse to `http://localhost:9090/analytics`. The app automatically signs you in using the configured default embed user (first sample user unless overridden by `METABASE_DEFAULT_USER_EMAIL`), then redirects to Metabase’s SSO endpoint with a signed JWT and loads the interactive dashboard specified by `METABASE_DASHBOARD_PATH`. You can still open `/login` if you want to switch between the sample users manually.

## Useful commands

- `npm start` – run the Express server.
- `npm install` – install dependencies.

## Notes

- The sample users are defined in-memory (`index.js`) and share the password `foobar`. By default the first user is used for automatic sign-in.
- The Metabase JWT token is valid for 10 minutes; refresh the page to generate a new one.
- Ensure your Metabase embedding settings allow the origin you serve the iframe from (e.g. `http://localhost:*`) and keep `embed=true` in `METABASE_EMBED_PARAMS` so Metabase renders the embedded experience instead of the login page.
- The app reuses the Metabase session cookie server-side and re-emits it on `/sso/metabase`, so the iframe loads without showing the Metabase login. Adjust `METABASE_SESSION_TTL_MS` (default 480000 ms) if you need the server to refresh the session more or less frequently.
