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
METABASE_EMBED_PARAMS=logo=false
SESSION_SECRET=change-me
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

Browse to `http://localhost:9090/analytics`. Login with the sample credentials shown on the login page. The app will redirect to Metabase’s SSO endpoint with a signed JWT and load the interactive dashboard specified by `METABASE_DASHBOARD_PATH`.

## Useful commands

- `npm start` – run the Express server.
- `npm install` – install dependencies.

## Notes

- The sample users are defined in-memory (`index.js`) and share the password `foobar`.
- The Metabase JWT token is valid for 10 minutes; refresh the page to generate a new one.
- Ensure your Metabase embedding settings allow the origin you serve the iframe from (e.g. `http://localhost:*`).
