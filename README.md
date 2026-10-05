# Activity 6 — Vue product management

- Student: Aljon Vincent E. Ferriol
- Student ID: MCC2024-00052
- Email: ferriol.aljone@minsu.edu.ph

A simple Vue 3 single-page client for the Activity 6 LavaLust REST API. It includes login, the product list, add/edit forms, a delete confirmation dialog, and logout. Authentication uses bearer access tokens with one refresh attempt after HTTP 401. Tokens are stored in sessionStorage for the current tab and cleared on logout or failed refresh. Credentials are never prefilled.

## Live deployment

- Frontend: https://ferriol-aljon-vincent-lab6.onrender.com
- LavaLust API: https://ferriol-aljon-vincent.onrender.com/index.php/api
- Backend repository: https://github.com/EYYYYJJJJJJJ/ferriol-aljon-vincent-lavalust

## Run locally

Use Node.js 22.18+ or 24.12+ and pnpm 11.25.0.

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_BASE_URL` to the API URL (default: `http://127.0.0.1:8086/index.php/api`). Do not add a trailing slash.
3. Start the separate LavaLust backend and allow this frontend origin in its CORS settings.
4. Run `pnpm install --frozen-lockfile` and `pnpm dev`.
5. Open the localhost URL printed by Vite and use the backend account credentials.

Run `pnpm build` to produce `dist/`. Run `pnpm preview` to inspect the production build locally.

## Deploy on Render as a separate static site

Push the contents of this folder to the frontend's own GitHub repository. Create a Render **Static Site** from that repository.

- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
- Publish directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://YOUR-BACKEND.onrender.com/index.php/api`
- Node version: set `NODE_VERSION=24.19.0`.
- Add the frontend's exact HTTPS origin to the backend's `API_ALLOWED_ORIGINS` environment variable.

The API base URL is public configuration compiled into the app. Never put database credentials or JWT secrets in a `VITE_` variable. Rebuild after changing the API URL. The app uses one URL and switches views in Vue, so no route rewrites are needed.

## Verification checklist

1. Invalid credentials show an error; valid credentials open Products.
2. Add a product and check that it appears in the table.
3. Edit its details and verify the values update.
4. Open Delete, cancel, and verify the product remains. Confirm Delete and verify it is removed.
5. Reload the tab and verify the existing session is restored.
6. An expired access token is refreshed once; a rejected refresh returns to login.
7. Log out and verify the login form returns; browser tokens are cleared even if the API cannot be reached.

Network failures are not automatically retried for mutations. Reload the list before retrying a change after a timeout to check whether the first request succeeded.

References: [Vue quick start](https://vuejs.org/guide/quick-start.html), [Vite static deployment](https://vite.dev/guide/static-deploy.html).
