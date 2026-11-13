# ExpertSearch price adapter

Updated on 13 November 2026. The current temporary session uses Greg’s MacBook through an account-free Cloudflare Quick Tunnel. The visible app remains a static subpage at `https://g-schenk.de/expertsearch/` in this repository. This optional service supplies its live prices; it does not replace or migrate the portfolio.

## Why a separate service

The Expert `pricepds` endpoint responded to a request with `Origin: https://g-schenk.de` with `Access-Control-Allow-Origin: https://www.expert.de`. A browser on g-schenk.de therefore cannot read that response. GitHub Pages executes no Python/Node server code. A separate read-only adapter is needed for live queries.

## Optional permanent deployment (not used)

`worker.mjs` is an un-deployed Cloudflare Worker. No account was created, no subscription changed, no hosting provisioned and no runtime credentials saved. A deployment target/account is still to be chosen by Greg. Cloudflare's documented Free plan includes 100,000 requests/day with 10ms CPU per invocation (checked 2026-11-13); this is an option, not proof that a particular account or deployment will stay free. Keep the Free plan and its existing limits; no automatic paid-plan upgrade.

After choosing an authorized account, check availability of the deployment tooling and account's existing rate-limit namespace IDs, deploy with `wrangler.jsonc`, then set `expertsearch/config.json` `apiBase` to that service's HTTPS URL. It should have no trailing slash. Verify actual production CORS, price fetching and request limiting before publishing the app as a live search. No DNS change is needed for a workers.dev backend; the browser-facing address stays g-schenk.de/expertsearch. Do not place account tokens in HTML, JavaScript, config.json or the Git repository.

Only GET /compare?webcode=36411100248&markets=1906832,1907031 is supported (five IDs maximum). The backend fetches only fixed Expert /api/store and /api/pricepds URLs. It does not forward cookies or enable arbitrary proxy destinations. It checks product and market identity, keeps unknown shipping unknown, distinguishes unconfirmed records, and prefers a supplied positive checkoutPrice over bruttoPrice for direct discounts. Cashback and personalized prices are not calculated. CORS is restricted to g-schenk.de and is not user authentication: this is a public service when deployed.

Successful/non-error market answers are cached for ten minutes with their original retrieval timestamps. The configured rate-limiting binding is mandatory and fails closed if missing. Its approximate 60 requests/minute counter applies per Cloudflare location, not as a strict worldwide budget. Upstream denials, throttling and network failures stop the batch without retries. No persistent product search history is stored by this code. Provider access logging and IP handling must be covered in the website's privacy notice before production enablement.

## Local verification

```sh
node --test expertsearch-service/worker.test.mjs
python3 scripts/build_pages.py
node scripts/preview_expertsearch.mjs
```

The preview serves `http://127.0.0.1:8774/expertsearch/` and adapts the same handler to Node HTTP. It caps its lifetime live Expert calls at 20; it never deploys or starts a public server. Add `--fixtures` for explicitly synthetic local UI tests based on saved result data. Fixture results are not evidence of live prices. Production deployment is a separate, outstanding step.

References:
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

## Temporary Mac session (current choice)

Greg explicitly authorized using his MacBook for this one-off use. `mac-server.mjs`
serves only the read-only API on loopback port 8776. It exposes no local files.
`python3 scripts/expertsearch_session.py start --hours 4` starts the API, a Quick
Tunnel and an idle-sleep inhibitor. It returns the temporary HTTPS API URL and
expiry. State/logs are in ignored `.local/expertsearch-session/` (no account keys).
No login service, router port forwarding, login item, paid plan or DNS change.

The supervisor stops the API, tunnel and sleep inhibitor automatically at expiry.
`python3 scripts/expertsearch_session.py status` shows the state.
`python3 scripts/expertsearch_session.py stop` stops this owned session early.
Closing the lid, sleep, losing the network or rebooting may end availability
before expiry. A restarted Quick Tunnel has a new URL: update config.json and
republish before sharing it again. There is no automatic restart or public relay
after this session.

The Mac adapter serializes upstream requests at least 250ms apart, caps incoming
API requests at 60/minute and two simultaneous batches, and caps a session at
3,000 upstream calls. Cache lasts ten minutes; only product/market answers are
stored in memory. Client batches are also sequential with a 2.2s pause. CORS is
not private access control; the API remains a public, rate-limited read-only
endpoint for the session. All 361 markets are an optional explicit user action;
no mass scan is started by deployment.

Extension requested by Greg: until Saturday 14 November 2026, 22:00 Europe/Berlin. Use `python3 scripts/expertsearch_session.py start --until 2026-11-14T22:00:00+01:00` after stopping the previous session. Absolute deadlines are limited to 48 hours ahead; a new Quick Tunnel URL must be published in config.json.
