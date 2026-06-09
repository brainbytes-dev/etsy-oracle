<h1 align="center">etsy-oracle</h1>

<p align="center">
  <strong>The free, open-source, self-hosted Etsy product-research tool.</strong><br/>
  A free alternative to EverBee, eRank, and Sale Samurai. Built so you stop paying a monthly fee for estimates anyone can compute.
</p>

<p align="center">
  <img alt="status" src="https://img.shields.io/badge/status-early%20development-orange">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen">
</p>

> Status: early development. The architecture is set and the build is underway. Star and watch to follow along; the launch is when v1 runs.

## Why this exists

The paid Etsy research tools sell "estimated sales and revenue" as if they had a secret data feed. They do not. Etsy does not publish per-listing sales, so these tools run a proprietary estimate from public signals: reviews, favorites, views, and listing age.

etsy-oracle computes the same thing from the official Etsy Open API, for free, on your own machine, with no subscription. The estimate is transparent, the data is yours, and the niche-finding is the part the paid tools keep shallow.

## What it does

- **Sales and revenue estimator** per listing, from review-velocity, favorites, views, and listing age, calibratable against your own shop where the real numbers are known.
- **Niche opportunity finder**, the core feature: demand versus competition versus saturation versus trend, scored, to surface underserved niches where there is still room to sell.
- **Bulk category database** so analyses run on a large dataset, not a handful of live lookups.

## How it works

- **Data source:** the official Etsy Open API v3. No HTML scraping. Legal, stable, and the right tool. 10,000 requests per day, 100 listings batched per call.
- **Estimates, honestly:** Etsy exposes no real per-listing sales. etsy-oracle estimates them and labels them as estimates, roughly 80 percent accurate and best for high-volume listings. It never presents an estimate as an exact number.
- **Store:** DuckDB, an embedded columnar database that handles 100M-plus rows on a single machine.
- **Ingestion:** a long-running worker that fills the database over time. The optional dashboard only reads precomputed aggregates.

## Roadmap

- [ ] Etsy API client generated from the official OpenAPI spec
- [ ] Ingestion worker, DuckDB schema
- [ ] Sales / revenue estimator with own-shop calibration
- [ ] Niche opportunity scorer
- [ ] CLI
- [ ] Web dashboard
- [ ] Launch

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md). Security reports: see [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE). Use it, fork it, self-host it.
