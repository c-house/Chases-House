# GitHub Pages Capabilities

GitHub Pages serves **static files only** (HTML, CSS, JS, images). No server-side code, no environment variables, no secrets. Everything in the repo is public.

## What You CAN Do

| Category | Examples |
|----------|----------|
| **Design** | Animated landing pages, CSS effects, dark/light themes, responsive layouts |
| **Client-side JS** | Interactive elements, animations, canvas/WebGL, games |
| **Static site generators** | Jekyll (built-in), Hugo, 11ty - blogs, portfolios, multi-page sites |
| **Third-party widgets** | Google Analytics, Disqus comments, embedded YouTube/Spotify |
| **Forms** | Formspree, Google Forms, Netlify Forms (no backend needed) |
| **CMS** | Decap CMS (formerly Netlify CMS) - edit content via GitHub |
| **Public APIs** | Weather, quotes, GitHub API (public endpoints), open data |
| **PWA** | Offline-capable app with service workers |
| **Web components** | Lit, Stencil - reusable UI components |

## What You CAN'T Do (Without a Separate Backend)

| Limitation | Workaround |
|------------|------------|
| API keys / secrets | Use a serverless function (Cloudflare Workers, Vercel Edge) as a proxy |
| Server-side logic | Same - proxy through a backend |
| Databases | Use Firebase, Supabase, or Airtable (client-side SDKs with public keys) |
| User auth | Firebase Auth, Auth0, or Clerk (client-side) |
| Dynamic content | Fetch from public APIs or use a headless CMS |

## Hosting Details

- **Domain**: chases.house
- **DNS**: GoDaddy A records pointing to GitHub Pages IPs
  - 185.199.108.153
  - 185.199.109.153
  - 185.199.110.153
  - 185.199.111.153
- **SSL**: Auto-provisioned by GitHub (Let's Encrypt)
- **Deploys**: Push to `main` branch triggers automatic deployment
- **Repo**: github.com/c-house/Chases-House
