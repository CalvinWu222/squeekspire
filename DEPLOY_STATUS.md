# Deployment status

- Verified: 2026-11-04, Asia/Shanghai. Complete; no blocker or login/payment stop remains.
- Repository: https://github.com/CalvinWu222/squeekspire (public). `main` pushed through `8e1bd9b`.
- Live site: https://squeekspire.com/ — HTTPS **200**, game renders. https://www.squeekspire.com/ — verified HTTP **308** to apex, then **200**. Both domains show **Valid Configuration** in the final Vercel refresh and screenshot; initial intermittent propagation has resolved.
- Vercel URL: https://squeekspire.vercel.app/ — game loads. Production Ready on CalvinWu **Hobby**, Vite, Node **22.x**. Latest deployment: https://vercel.com/calvin-wu/squeekspire/CYp8Wa9q1AzKz9kwedjttqAbSwnD (https://squeekspire-bjz7mw08b-calvin-wu.vercel.app/).
- API: `/api/leaderboard` verified HTTP **200**, `application/json`, on both squeekspire.vercel.app and squeekspire.com. Response: `{"entries":[],"mode":"all","storage":"redis"}`. Statuses captured through Edge network observation.
- Redis: `squeekspire-redis`, Upstash **Free** via Vercel Marketplace; connected to Production and Preview with sensitive KV REST variables automatically injected. Redeployed after connection. No Pro trial or paid plan started; no credentials copied or saved.
- Dynadot: exact Vercel records saved and reopened to verify; TTL **300 seconds**. Public DNS resolves the new records:
  - A `@` -> `216.198.79.1`
  - CNAME `www` -> `7222d409c7bfe09b.vercel-dns-017.com.` (Dynadot normalizes the trailing dot).
- Nameservers unchanged: `ns1.dyna-ns.net`, `ns2.dyna-ns.net`.
- Runtime repair: fixed native ESM import extensions and JSON import attributes after deployment exposed `ERR_MODULE_NOT_FOUND`. Fix committed/pushed/deployed as `8e1bd9b`. Build, all **210 tests**, and direct Node 22 native ESM API smoke checks passed.
- Screenshots/evidence: `shots/deploy/squeekspire-com-live.jpg`, `vercel-domains-valid.jpg`, `www-redirect-verified.jpg`, `vercel-final-deployment.jpg`, `upstash-free-plan.jpg`, `upstash-connected.jpg`, `vercel-dns-records.jpg`, `dynadot-dns-persisted.jpg`, `api-leaderboard-200.jpg`, `domain-api-leaderboard-200.jpg`, and `http-verification.json` (all under `shots/deploy/`).
- Prior preparation: secret audit found no matches in 1,961 repository text files; `.gitignore` excludes dependencies, builds, `.env*`, `.vercel`, logs, local data, secrets, and screenshots.
- Source repair is committed and pushed. This status file remains local and uncommitted.
