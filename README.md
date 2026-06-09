<h1 align="center">etsy-oracle</h1>

<p align="center">
  <strong>The free, open-source, self-hosted Etsy product-research tool.</strong><br/>
  A free alternative to EverBee, eRank, and Sale Samurai. Built so you stop paying a monthly fee for estimates anyone can compute.
</p>

<p align="center">
  <img alt="status" src="https://img.shields.io/badge/status-early%20development-orange">
  <img alt="license" src="https://img.shields.io/badge/license-AGPL--3.0-blue">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen">
</p>

> Status: early development. The architecture is set and the foundation — the Etsy API client and CLI — runs today. Star and watch to follow along; the launch is when v1 runs.

## Why this exists

The paid Etsy research tools sell "estimated sales and revenue" as if they had a secret data feed. They do not. Etsy does not publish per-listing sales, so these tools run a proprietary estimate from public signals: reviews, favorites, views, and listing age.

etsy-oracle computes the same thing from the official Etsy Open API, for free, on your own machine, with no subscription. The estimate is transparent, the data is yours, and the niche-finding is the part the paid tools keep shallow.

## What it does

- **Sales and revenue estimator** per listing, from review-velocity, favorites, views, and listing age, calibratable against your own shop where the real numbers are known.
- **Niche opportunity finder**, the core feature: demand versus competition versus saturation versus trend, scored, to surface underserved niches where there is still room to sell.
- **Bulk category database** so analyses run on a large dataset, not a handful of live lookups.

## How it works

- **Data source:** the official Etsy Open API v3. No HTML scraping. Legal, stable, and the right tool. 10,000 requests per day, 100 listings batched per call.
- **Estimates, honestly:** Etsy exposes no real per-listing sales. etsy-oracle estimates them from public signals and labels them as estimates everywhere, with the method documented so you can audit it. Estimates are approximations, never exact figures, and they are most reliable for high-volume listings. An accuracy band will be published once the estimator is built and validated against listings with knowable sales; until then no accuracy percentage is claimed.
- **Store:** DuckDB, an embedded columnar database that handles 100M-plus rows on a single machine.
- **Ingestion:** a long-running worker that fills the database over time. The optional dashboard only reads precomputed aggregates.

## Running it

What runs today is the foundation: the typed Etsy API client, the rate-limit and retry harness, and a small CLI (`status` and `listings`). The data pipeline — ingestion worker, sales estimator, niche scorer — is still on the roadmap below; those commands do not exist yet, and this README will not list a step it cannot back up.

Prerequisites: [Node.js](https://nodejs.org/) 20 or newer and [pnpm](https://pnpm.io/) 9 or newer.

```bash
# 1. Clone and install
git clone https://github.com/brainbytes-dev/etsy-oracle.git
cd etsy-oracle
pnpm install

# 2. Build
pnpm build

# 3. Check status — works with no key, no network
node apps/cli/dist/cli.js status
```

`status` prints your daily request budget and how much is left:

```
etsy-oracle status
  API keystring configured: NO — set ETSY_API_KEYSTRING in .env
  Daily request budget:     10000
  Used today (UTC):         1
  Remaining today:          9999
```

To fetch real listings you need a free Etsy API key. Register an app at [etsy.com/developers/your-apps](https://www.etsy.com/developers/your-apps), then:

```bash
# 4. Add your key
cp .env.example .env
# edit .env and set ETSY_API_KEYSTRING=<your keystring>

# 5. Fetch live listings
node apps/cli/dist/cli.js listings --keywords "ceramic mug" --limit 5
```

Without a key, `listings` exits with a clear message (`ETSY_API_KEYSTRING is required`) rather than failing silently. Run `node apps/cli/dist/cli.js --help` for all flags (`--limit`, `--keywords`, `--json`).

For the full architecture and scope, see [docs/PRODUCT-BRIEF.md](./docs/PRODUCT-BRIEF.md) and the [positioning doc](./docs/POSITIONING.md).

## Roadmap

- [x] Etsy API client generated from the official OpenAPI spec, with rate-limit and retry harness
- [ ] Ingestion worker, DuckDB schema
- [ ] Sales / revenue estimator with own-shop calibration
- [ ] Niche opportunity scorer
- [ ] CLI
- [ ] Web dashboard
- [ ] Launch

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md). Security reports: see [SECURITY.md](./SECURITY.md).

## License and model

[AGPL-3.0](./LICENSE). Open source, free to self-host forever. Open-core: self-hosting stays first-class and free, and a managed cloud version (paid, optional) is planned to fund the work. If you run a modified version as a public service, AGPL asks you to share your changes back.
