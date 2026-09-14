# 🪐 Nebula Portal

An Interstellar-style games portal with a built-in Ultraviolet web proxy.

**What's inside:**
- Games portal (12 starter games, fully editable list)
- Full Ultraviolet proxy (service-worker based — the same engine Interstellar uses)
- Epoxy-over-Wisp transport (encrypted, fast, websocket-based)
- Custom dark/space UI

## Run locally

```bash
npm install
npm start
# open http://localhost:8080
```

The proxy needs HTTPS *or* localhost — service workers don't work on plain HTTP
from a remote host. Locally (localhost) it works out of the box.

## Deploy free — Render (recommended)

Render's free tier supports WebSockets, which the proxy needs. Vercel/Netlify
will NOT work (no WebSocket support).

1. Push this folder to a GitHub repo (keep `node_modules` out — a
   `.gitignore` is included).
2. Go to [render.com](https://render.com) → New → **Web Service** → connect the repo.
3. Settings:
   - **Environment:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - Render sets the `PORT` env var automatically — nothing else to configure.
4. Deploy. You'll get `https://your-app.onrender.com` — the proxy works there
   immediately since it's HTTPS.

Free tier note: the free instance sleeps after ~15 min of inactivity and takes
~30s to wake on the next request. Fine for personal use.

## Deploy to a VPS (best performance)

Any Node 18+ server works:

```bash
git clone <your-repo> && cd nebula-portal
npm install
PORT=8080 npm start
```

Put nginx or Caddy in front for HTTPS, or use `cloudflared` to put it behind a
Cloudflare domain you own:

```bash
cloudflared tunnel --url http://localhost:8080
```

For a permanent Cloudflare setup, create a named tunnel and point a DNS record
at it — that gets you your own domain on Cloudflare's edge, exactly what you
wanted.

## Adding games

Open `public/app.js` — the `GAMES` array at the top is plain JSON-ish:

```js
{ name: "Narrow One", emoji: "🏹", url: "https://narrow.one" },
```

Add any game with an embeddable URL. If a game refuses to load in the frame
(some sites block iframes), use its **"Open via Proxy"** button — that routes
the game through Ultraviolet itself.

## Using the proxy

- **Proxy tab:** type anything. No dot in the input → Google search. A URL →
  loads it through the proxy.
- **Settings tab:** check/reset the transport.
- Proxied pages run under `/uv/service/…` — bookmarks work by copying that URL.

## Tech stack (for the curious)

| Piece | What it is |
|---|---|
| Ultraviolet | Service-worker interception proxy — intercepts & rewrites requests |
| wisp-server-node | WebSocket tunnel server — carries the proxied traffic |
| epoxy-transport | Encrypted transport between the browser and wisp |
| BareMux | Shared worker that lets you hot-swap transport backends |

This is exactly the architecture of Interstellar/Ultraviolet deployments —
not a knockoff, literally the same open-source engine.
