# Checkout on Lemon Squeezy (G5-02) — founder setup steps

Decision 2026-10-23: Lemon Squeezy, because it is merchant of record (handles VAT and sales tax),
delivers files to buyers, and supports two prices on one product for the A/B test. Fulfilment of the
license key is manual during the pilot (three buyers is the pass mark); a webhook signer is the
upgrade once volume justifies it.

## One-time setup (about 45 minutes)

1. **Account.** Create the store at lemonsqueezy.com; complete identity and payout details for your
   jurisdiction. Lemon Squeezy collects and remits tax as merchant of record.
2. **Product.** "Workspace Guardian Pro". Description: copy the Pro paragraph from the README. Tax
   category: software / digital goods.
3. **Two variants** (the price test from `docs/PRICING.md`):
   - A — "Pro, one-time" $9, single payment, license: not using Lemon Squeezy's license keys (ours are offline).
   - B — "Pro, monthly" $4/month, subscription, cancel any time.
   Only one variant is visible at a time: week 1 shows A, week 2 shows B.
4. **File delivery.** Upload `release/workspace-guardian-pro-0.1.0.tgz` (built with `npm run pack` in
   the Pro repo) as the product file. Lemon Squeezy emails the download link on purchase.
5. **Refund policy** text on the product page: "30 days, no questions, reply to your receipt."
6. **Support email** on the store page (a dedicated address).
7. **Checkout page**: enable "collect email" (needed to hash into the key). Disable marketing opt-in.
8. **Test mode**: make one test purchase, confirm the download link works, refund it. Record both in the
   Weekly Metrics sheet as test, not revenue.

## Fulfilling an order (manual, 2 minutes)

Lemon Squeezy emails you "New order". Then, in the Pro repo:

```sh
npm run fulfil -- <order-id> <buyer-email>          # one-time key, never expires
npm run fulfil -- <order-id> <buyer-email> 2026-12-23  # subscription: expiry = next renewal + 7 days grace
```

It prints the key and the full email. Send it from the support address. Log the order id, date, variant,
and amount in Weekly Metrics (gross, fees, refunds as separate columns; never customer PII in the
tracker).

Refund: issue it in Lemon Squeezy, then add the order id to `revoked.json` in the Pro repo; the next
free-core release ships the list. Offline keys cannot be revoked instantly; the plan accepts that.

## When to automate

After the pilot, or at more than ~5 orders a week: a Cloudflare Worker receives the `order_created`
webhook (verify the `X-Signature` HMAC with the signing secret), signs the key with the private key
stored as a Worker secret, and sends it through an email API. Until then the private key never leaves
`~/.config/workspace-guardian/signing-key.pem` on this machine. Back that file up offline now.

## Page copy (variant A)

**Workspace Guardian Pro — $9, yours forever.**
The free core tells you where parallel Claude Code sessions collide. Pro tells you what to do about it:
a scored merge plan with the exact rebase order and the files to resolve by hand, per-repo policies for
CI (`.guardian/policy.json`), and hotspot packs for Next.js, Django, Rails, monorepos and Terraform.
Offline, no account, no telemetry. 30-day refund, no questions.
