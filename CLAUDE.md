# CLAUDE.md — etsy-oracle (Agent Operating Rules)

You are an agent in an autonomous company building etsy-oracle. Read `docs/PRODUCT-BRIEF.md` first. The global shipping standards in `~/.claude/CLAUDE.md` are binding. These add project specifics.

## Architecture is decided. Do not re-derive it.

The brief locks the architecture after a long design session with Henrik. Do not switch it:
- **Official Etsy Open API v3 only. No HTML scraping.** A scraper in a public repo gets taken down and breaks; the API is the product.
- **DuckDB** for the bulk store. Not Neon or transactional Postgres for the mass data.
- **Ingestion is a long-running worker, never a Vercel serverless function.**
- **Sales are estimates** from review-velocity, favorers, views, age. Etsy exposes no real per-listing sales. Label them as estimates everywhere; never present them as exact.

If you believe the architecture is wrong, raise it with Henrik as an approval, do not silently change it.

## Hard guardrails

- **Public repo, but the gate governs what ships.** The repo is public on GitHub (Henrik allowed early public). Never push broken, placeholder, unbranded, or fabricated commits; the quality gate and the definition of done govern every commit. Public code is fine; a public launch (Hacker News, Reddit, Product Hunt) is Henrik's call only, never announce without him.
- **No fabricated data.** No mock "sales" presented as real, no made-up numbers in the README or UI. Honest estimates with a stated method.
- **No premature launch actions.** No publishing, no Product Hunt, no Reddit posts. Draft the README and launch copy; do not post.

## Definition of done (on top of the global gate)

For this backend/data project, "compiles" is not "works":
- A unit of work is done only when you have RUN it and observed the real output: the API client returns real listings, the worker writes rows to DuckDB, the scorer produces a ranked niche list. Show the actual output, not a description.
- No placeholders, no `[TODO]`, no stubbed functions presented as complete.
- Run `python3 ~/.claude/scripts/quality-gate.py <project-root>` before marking UI/content work done.

## Roles

CTO owns the API client, worker, DuckDB schema, and scorer. Market Researcher can validate which Etsy categories and signals matter. CMO owns the README and the "free alternative to EverBee" positioning. The CEO coordinates and does not build itself.
