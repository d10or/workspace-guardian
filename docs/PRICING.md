# Free vs Pro, pricing test, checkout (G5)

Founder direction (2026-10-20): low price, volume. The purchase must be impulse-sized for someone
already paying $100–$200 a month for Claude. The plugin catalog has no payment mechanism, so Pro is
enforced by the CLI and mod reading a license file; the free core stays MIT and fully usable, which
awesome-claude-code requires.

## Boundary

| Free (MIT, forever) | Pro (one-time license) |
|---|---|
| `/sessions` control tower, live session list, claims, edit pause, peer messaging | Merge-order planner with per-task risk score and the exact rebase sequence |
| `/task` ownership with the ask-the-user hold | Hotspot packs beyond the built-in six categories (framework-specific: Next.js routes, Django apps, Rails, monorepo workspaces) and custom hotspot rules per repo |
| `guardian inspect`, `task`, `check`, `handoff` with Markdown output | JSON schema export for CI, `--strict` policies per repo (fail on chosen finding codes), and a GitHub Actions snippet |
| Community support via issues | Priority issue handling and a direct contact |

The free tier must stay good enough that a solo developer never needs Pro. Pro sells to the person
who merges several agent branches a day.

## Two price messages to test (one per week, same page, same traffic source)

| Message | Price | Frame |
|---|---|---|
| A | $9 one-time | "Less than one hour of the conflicts it prevents. Yours forever." |
| B | $4 / month, cancel any time | "Pays for itself the first time it catches a collision." |

Pass mark per plan: 3 real buyers (stretch 5), refunds excluded, no friends-and-family.

## Checkout and fulfilment

- Lemon Squeezy or Gumroad (both handle VAT/sales tax as merchant of record; founder picks after checking the intended jurisdiction).
- Fulfilment: the checkout emails a license key. `guardian license add <key>` (CLI) or `/license <key>` (mod) writes it to `<claude config>/guardian/license.json`; features check it offline with a signed key (Ed25519 public key embedded; no phone-home).
- Refund policy: 30 days, no questions, stated on the page.
- Support contact: a dedicated email on the page.
- No claims of guaranteed savings; the page shows the demo clips and the finding list.

## What must exist before the test starts (G5-01, G5-02)

1. The Pro features above implemented behind the license check, at least the merge-order planner and `--strict` policies.
2. The checkout page live with message A; a test purchase made and refunded by the founder.
3. Weekly Metrics sheet row for the week with paid conversions and refunds.
