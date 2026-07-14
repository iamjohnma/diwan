# Feedback on Diwan PRD v0.2 — for Salah al-Din

Good first draft to react to — the workflows you captured (case files, party structures, the hearing/deadline coordination, the money flow through the lawyer as intermediary) are largely the right raw material. The problems are all about **what you decided belonged in v1**, not about the underlying workflow knowledge. That's an easy thing to fix and worth internalizing now, early in the PO role, because it'll come up on every product from here on.

## The core mistake: you inherited the source app's shape instead of designing ours

You sat with someone who built a single-firm, offline, .NET desktop app, and you wrote a PRD that is — structurally — a spec for *that app*, with "SaaS" added as a label on top. Look at what you actually wrote:

- **§2, Non-Goals:** "Multi-firm SaaS tenancy (design schema to allow it later, but ship single-tenant)." We are a SaaS company. Every product we ship — Naab, Baraka, Barakat — is multi-tenant from the schema up, because retrofitting tenant isolation later is one of the most expensive mistakes a SaaS backend can make. You wrote our actual business model as a "later" item. That's the single biggest thing to fix: **when you take workflows from someone else's tool, take the workflows, not their architecture.** The offline app was single-tenant because it only ever served one firm. That constraint has nothing to do with us.
- **§4, Offline-first as a hard v1 requirement**, complete with a SQLite replica, a conflict-resolving sync engine, and a separate desktop app. That's a huge, genuinely hard piece of engineering (conflict policies, durable outbound queues, per-entity sync status) — and it's in the PRD because the source app needed it to function *at all* (it's offline-only). We're building a web SaaS. A flaky connection is a "retry the request, show a toast" problem for us, not a distributed-systems problem, unless a real pilot firm tells us otherwise with real usage data.
- **§5, OTP identity verification** wired into *every* receipt and document signature, with its own SMS/WhatsApp provider, rate-limiting, and compliance section. This is a real problem (identical Palestinian names) but you reached for the heaviest possible solution and made it load-bearing infrastructure before we've signed a single customer. National ID as a plain field solves the disambiguation problem. OTP solves a fraud-verification problem we don't have evidence we have yet.

## The pattern to notice

All three of these have the same shape: **the source app did X, so the PRD said "build X."** None of them asked "does *our* product, at *our* stage, with *our* business model, actually need X in v1?" That question — not more research on legal workflows — is the missing step. It's the difference between transcribing what you saw and designing a product.

A useful gut-check for next time: for every capability in a PRD, ask "if we cut this, does the product stop solving the customer's actual problem, or does it just make the demo less impressive?" Offline sync and OTP both fail that test for v1. Multi-tenancy fails it in the opposite direction — cutting it doesn't just weaken the demo, it means we're not building a SaaS company at all.

## What was actually good

- The money-flow model (defendant → lawyer trust → plaintiff, append-only double-entry ledger, receipts, who-owes-whom dashboards) is well thought through and we kept it almost entirely as-is.
- The role breakdown (Owner/Lawyer/Associate/Secretary + your suggested Accountant/Paralegal/etc. stubs) was solid — we kept your instinct to stub extra roles rather than either over- or under-building RBAC.
- The hearings/deadline/mission structure, and especially tying deadline-critical missions to an escalation ladder, was a real insight from your conversation and stayed in v0.3 basically unchanged.
- No-hard-delete-anywhere and the audit-log discipline were right, and we kept them as hard requirements.

You clearly listened well in that meeting and extracted the real domain knowledge. The gap wasn't understanding law firm operations — it was translating "here's how someone else's app works" into "here's what our SaaS needs in v1," which is a product-scoping skill, not a domain-knowledge one.

## Concrete habit for next PRD

Before you write a "Non-Goals" section, write the business model and target customer (who pays us, how much, why they switch) *first*. Half of v0.2's scoping problems — offline-first as a requirement, single-tenant as the default, OTP as core infra — would have been caught immediately if the PRD had opened with "small West Bank firms, per-seat SaaS pricing, competing against paper and Excel" instead of opening with the system architecture. Start from the business, derive the architecture — not the other way around.

Full rewritten PRD is at `PRD.md` in this repo if you want to see how the same workflows land once re-scoped around that lens.
