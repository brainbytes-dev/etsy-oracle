# Launch copy — DRAFTS, PARKED. DO NOT POST.

> **Status: NOT FOR PUBLICATION.** These are drafts for review only.
> A public launch (Product Hunt, Hacker News, Reddit) is Henrik's call alone and may not happen until **v1 runs end to end** (the CLI works from a fresh clone, M0–M4 done) and Henrik approves.
> Posting any of this before that is a guardrail violation. Nothing here is scheduled, queued, or sent.
>
> Every bracketed `[…]` is a placeholder that must be filled with a verified fact (a real repo URL, a real demo, a measured number) before this could ever go out. Do not fill placeholders with guesses.

---

## Pre-flight checklist (all must be TRUE before any of this is postable)

- [ ] v1 CLI runs from a fresh clone and produces a real ranked niche list (M4 done).
- [ ] Estimator is built and its method is documented; any accuracy claim is measured, not asserted (M2).
- [ ] README install steps work as written against the built CLI.
- [ ] Repo URL, demo (asciinema/screenshot of real output), and any linked page exist and are live.
- [ ] No fabricated stats, no traction claims that aren't real.
- [ ] Henrik has explicitly approved the launch and the channel.

---

## Product Hunt — draft

**Name:** etsy-oracle

**Tagline (≤60 chars):** Free, open-source Etsy product research you self-host

**Description:**
Paid Etsy research tools sell "estimated sales and revenue" as if they had a private feed from Etsy. They don't — Etsy doesn't expose per-listing sales to anyone. The number is a formula run over public signals: reviews, favorites, views, listing age.

etsy-oracle does the same computation in the open. It's free, open-source (AGPL-3.0), and you run it yourself against the official Etsy API. The estimate method is documented and auditable, the data lands in a local database you own, and the core feature is a niche opportunity finder that surfaces underserved categories — not just a single-listing lookup.

No subscription. No black box. No scraping. Your API key, your machine, your data.

**First comment (maker):**
Hi PH 👋 I built etsy-oracle because I got tired of paying a monthly fee for sales estimates that are just a markup on public data. Etsy gives no real per-listing sales to anyone, so every tool in this space estimates from the same public signals. I wanted that computation to be open, free, and self-hosted, with the niche-finding — the part that actually tells you where to sell — as the headline instead of an upsell.

It's [open source here: REPO_URL]. Honest caveat: sales numbers are estimates, labelled as estimates everywhere, and I publish the method so you can check it. Feedback welcome.

---

## Hacker News — Show HN draft

**Title:** Show HN: etsy-oracle – open-source Etsy product research, self-hosted, no subscription

**Body:**
Etsy doesn't expose per-listing units sold to anyone. The paid research tools (EverBee, eRank, Sale Samurai) estimate it from public signals — review counts and timestamps, favorites, views, listing age — and charge a subscription for the result. eRank says as much about its own numbers: "approximations based on internal algorithms."

etsy-oracle runs that same computation in the open. Stack and decisions:

- Official Etsy Open API v3 only, no HTML scraping (a public scraper breaks and invites a takedown; the API is the product). 10k requests/day, 100 listings/batch.
- DuckDB as the bulk analytical store — embedded, columnar, handles large category pulls on one machine.
- Ingestion is a long-running worker, not a serverless function. Any future dashboard reads precomputed aggregates only.
- Sales are estimates, labelled as estimates everywhere, with the formula documented. No accuracy percentage claimed until it's measured against listings with knowable sales.

The core feature is a niche opportunity scorer: estimated demand vs. competition vs. saturation vs. trend, with the components shown so the ranking is auditable.

Repo: [REPO_URL]. It's AGPL-3.0; self-hosting stays free and first-class. Happy to talk about the estimation approach and where it's weak (low-volume listings, mainly).

---

## Reddit — draft (r/Etsy, r/EtsySellers, r/selfhosted as fits)

> Subreddit rules vary and several ban self-promotion outright. Check each subreddit's rules and post only where it's allowed and genuinely useful. Do not cross-post spammily.

**Title:** I built a free, open-source alternative to EverBee/eRank — runs on your own machine

**Body:**
The paid Etsy research tools estimate "sales" and "revenue" from public signals (reviews, favorites, views, listing age) — Etsy doesn't give real per-listing sales to anyone, so it's a computed estimate, not secret data. I didn't love paying a subscription for that, so I built an open-source version you run yourself.

What it does: estimates sales/revenue per listing (labelled as estimates, method documented), and — the part I actually care about — scores niches by demand vs. competition vs. saturation vs. trend to find underserved categories. Data comes from the official Etsy API (no scraping) into a local database you own.

It's free and open-source: [REPO_URL]. Honest about limits: estimates are approximations, best for higher-volume listings, and I don't claim an accuracy number I haven't measured. Would love feedback from people who've used the paid tools — where do they actually earn their keep vs. where is it just a paywall on public data?

---

## Short blurbs (reusable, for X / bio / repo social preview)

- Free, open-source, self-hosted Etsy product research. Estimates sales and finds underserved niches from the official Etsy API — no subscription, no black box.
- The paid Etsy tools sell estimates anyone can compute from the public API. etsy-oracle computes them in the open, for free, on your machine.
