# G6 decision memo (template; fill on 2026-11-29)

**Decision:** Scale / Iterate 2–4 weeks / Pivot wedge / Stop  (circle one)

## Metric snapshot (freeze the Weekly Metrics sheet first)

| Metric | Threshold | Actual | Source |
|---|---|---|---|
| Verified installs | ≥ 50 | | directory analytics + self-reports |
| Activated (≥ 1 risk report) | ≥ 15 | | opt-in counts |
| Repeat users (2nd day/session) | ≥ 8 | | opt-in counts |
| Paying customers (refunds excluded) | ≥ 3 (stretch 5) | | payment processor |
| Critical safety incidents | 0 | | issues labelled Safety |
| Alpha workflow completion | ≥ 4 of 5 | | Alpha Testers sheet |

Rates: activation = activated / installed; repeat = repeat / activated; paid conversion = paid / activated.
Gross = collected before fees/tax/refunds; net = minus refunds and fees. Do not conflate page views, stars, downloads, installs, and activated users.

## Evidence and costs

- What users said (quotes with source).
- What broke (issues, severity, time to fix).
- Hours spent per gate; money spent (should be ~0 by plan).

## Which funnel step failed, if any

install → activate → repeat → pay. Name the step and the single experiment that would test it.

## Decision rules (from MASTER_PLAN.md §12)

- **Scale:** thresholds met → 90-day plan for Pro and Codex support.
- **Iterate:** usage promising, purchase target missed → isolate the failed step, one targeted experiment.
- **Pivot:** users value handoff but not warnings (or the reverse) → narrow the product.
- **Stop:** no repeated pain validated or no safe/reliable solution after scoped attempts.

**Rationale:**

**Next milestone and owner:**
