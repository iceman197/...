# ICEMAN BOT SUPER LAB v2

A responsive, ice-themed development workspace with an AI assistant, AI coding helper, and public coding practice editor.

## Included

- `public/index.html` — dashboard and all frontend views.
- `server.js` — Express backend, health endpoint, AI provider proxy, and external sandbox proxy.
- `package.json` — dependencies and Render start script.
- `.env.example` — environment variable names (no real secrets).

## Run on Render

1. Upload the files preserving the `public` folder, or upload the ZIP and extract it in your repository.
2. Create a Render **Web Service** connected to the repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add the required secret environment variables in Render's Environment settings.
6. Deploy, then open the service URL.

The frontend is served from `public/index.html`. If uploading individual files from mobile, make sure `index.html` is inside a folder named `public`; otherwise Express will not find the dashboard.

## AI configuration

- Gemini: `GEMINI_API_KEY`, optional `GEMINI_MODEL`
- OpenAI-compatible: `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, `OPENAI_MODEL`
- Anthropic: `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`
- `AI_PROVIDER` chooses the default provider.

The API keys are read only from backend environment variables. Do not put real keys in HTML, GitHub, or chat history. The public dashboard does not include an admin login or a key-management endpoint; this is intentional because a public unauthenticated key-management page would expose secrets to visitors.

## Code execution

`/api/execute` forwards submitted code to the configured Piston-compatible external execution service. Code does **not** execute directly inside this Express server. External runner availability, supported versions, quotas, and policies may change. Do not send secrets or sensitive data to an external runner.

## Important limitations

This is a starter implementation, not the entire previously planned feature set. GitHub OAuth, multi-user cloud projects, shared collaboration, visual workflows, plugin marketplace, AI model comparison, automated backups, and true autonomous multi-file editing are not implemented yet. The Coding Bot currently sends requests to the configured AI and displays the answer; it does not independently edit project files. Browser-saved drafts and notes remain on the current browser/device.

Because the site has no login, treat it as a public coding playground. For a public deployment, add rate limits and quotas, strict outbound request allowlists for custom endpoints, abuse monitoring, and sandbox resource limits before offering it broadly. Do not add unauthenticated endpoints that can change server environment variables, read files, or run shell commands on the host.
