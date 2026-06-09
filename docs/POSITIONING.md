# Positioning — etsy-oracle

> The free, open-source, self-hosted alternative to EverBee, eRank, and Sale Samurai.
> This doc is the source of truth for how we talk about the product. Pre-launch: honest market and problem facts only, no traction claims, no fabricated numbers.

## One-liner

A free, open-source Etsy product-research tool you run yourself. It estimates sales and revenue and finds underserved niches from the official Etsy API — the same public signals the paid tools charge a subscription for.

## The wedge: "they sell estimates anyone can compute"

The paid Etsy research tools present "estimated sales" and "estimated revenue" as if they had a private data feed from Etsy. They do not. Etsy does not expose per-listing units sold through any public surface. Every one of these tools derives the number from the same public signals — review counts and timestamps, favorites, views, and listing age — run through a proprietary formula.

eRank says this about its own figures: its search-volume and sales numbers are "approximations based on internal algorithms" and should be used as a directional tool, not precise values ([erank.com](https://erank.com/plans), accessed 2026-06-09). That is the honest description of the whole category. The estimate is a computation over public data, not a leak.

So the wedge is not "their math is wrong." It is "their math is a markup on public data, behind a paywall and a black box." etsy-oracle does the same computation, shows the formula, runs on your machine, and costs nothing.

## What we are NOT claiming

- We do **not** claim our estimates are more accurate than theirs. Same public inputs, comparable ceiling. Our edge is transparency, ownership, and price — not magic accuracy.
- We do **not** claim Etsy hands us real sales. It does not, and neither does anyone else.
- We do **not** publish an accuracy percentage until the estimator is built and validated against listings with knowable sales. No "80% accurate" until it is measured.
- No traction, user, or download numbers pre-launch. We have none yet and will not invent them.

## The three honest differentiators

1. **Free and open-source, self-hosted.** AGPL-3.0. No subscription, no per-search caps imposed by a vendor. Your only limit is your own Etsy API key (10,000 requests/day, free from Etsy). The data lands in a local DuckDB you own and can query directly.
2. **Transparent, auditable method.** The estimator's formula is documented and the niche score shows its components (demand, competition, saturation, trend), so the ranking is inspectable, not a number you have to trust. The paid tools keep the method opaque.
3. **Niche-finding as the core, not an upsell.** The valuable question is "where is there still room to sell," not "what is this one listing doing." We build the opportunity scorer as the headline, on a bulk category database, instead of one live lookup at a time.

## Competitive landscape (facts, accessed 2026-06-09)

Pricing changes; re-verify before any public use. Sources linked.

| Tool | Free tier | Paid tiers | Open source | Self-hosted / your data | Method |
|---|---|---|---|---|---|
| **etsy-oracle** | Free, no caps beyond your API key | None (managed cloud planned, optional) | Yes (AGPL-3.0) | Yes | Documented, auditable |
| **EverBee** | Hobby, free — no sales/revenue data, ~10 searches/mo | Growth $7.99/mo, Pro $29.99/mo | No | No | Proprietary |
| **eRank** | Free, ~5 keyword lookups/day | Basic $5.99, Pro $9.99, Expert $29.99 (caps persist) | No | No | Proprietary ("approximations") |
| **Sale Samurai** | 3-day trial only, no permanent free tier | $9.99/mo (~$99/yr) | No | No | Proprietary |

Sources: [EverBee pricing](https://everbee.io/research-pricing/), [eRank plans](https://erank.com/plans), [Sale Samurai pricing](https://salesamurai.io/our-pricing/).

Notes for honest framing:
- The paid tools are **not all expensive**. EverBee and eRank both have free tiers, and entry paid tiers start around $6–$10/mo. The honest pitch is **not** "they cost $30 and we're free." It is: the part that matters — sales/revenue estimates and uncapped research — sits behind paid tiers and a closed method, while we give it away, open and uncapped, for the cost of your own free API key.
- EverBee's free Hobby tier explicitly withholds sales and revenue data; that is exactly the signal etsy-oracle computes openly.
- All three cap usage somewhere (searches, lookups, tracked competitors). A self-hosted tool's only cap is the Etsy API's 10k/day, which is yours to spend.

## Target user

Etsy sellers and print-on-demand operators doing product research who (a) resent paying a recurring fee for a black box, (b) want the data on their own machine, or (c) are technical enough to self-host (or follow a one-command setup once it ships). Secondary: developers who want a clean, API-only Etsy data layer to build on.

## Message hierarchy (use in this order)

1. Free, open-source, self-hosted Etsy research — no subscription.
2. They sell estimates anyone can compute from the public API; we compute them in the open.
3. Niche opportunity finder is the core: find underserved niches, not just audit one listing.
4. Your data, your machine, official API only — no scraping, nothing to get shut down.

## Proof obligations before launch

Each claim below must be backed by the running tool before it goes in public launch copy:

- "Estimates sales and revenue" → the estimator runs and outputs labelled estimates over real listings (M2).
- "Finds underserved niches" → the scorer outputs a real ranked niche list from real data (M3).
- "One-command setup / install" → the CLI runs from a fresh clone (M4).
- Any accuracy band → measured against listings with knowable sales, not asserted (M2.2).

Until those are true, launch copy stays drafted and parked. See [launch-drafts.md](./launch-drafts.md).
