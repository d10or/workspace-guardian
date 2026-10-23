# Founder runbook: the actions only you can take, with every value pre-filled

Do them in this order. Each block says what to open, what to type, and what to send back to Claude.

## 1. Lemon Squeezy store (about 45 minutes)

1. Create the account at lemonsqueezy.com → "Start selling". Store name: **Workspace Guardian**. Currency: USD. Complete identity and payout details (your jurisdiction; Lemon Squeezy is merchant of record and files the tax).
2. **Products → New product.** Name: `Workspace Guardian Pro`. Description: paste the "Page copy (variant F, founding)" block from `docs/CHECKOUT_LEMONSQUEEZY.md`. Tax category: *Software as a service* for subscriptions (digital goods for the one-time variant later).
3. **Pricing → Subscription**, $1.00 / month, no trial. Variant name: `Founding member`. Leave Lemon Squeezy "license keys" **off** (ours are offline).
4. **Files:** upload `~/Desktop/projects/workspace-guardian-pro/release/workspace-guardian-pro-0.1.0.tgz`.
5. **Checkout settings:** collect email (needed for the key), marketing opt-in off, redirect after purchase: the repo README's Pro section.
6. **Refund policy** text (store settings): "30 days, no questions, reply to your receipt."
7. **Support email:** a dedicated address; put the same one in `docs/PRIVACY.md` later.
8. Publish the product. **Send Claude the product URL and the support email.** Claude puts them in README, the CLI's Pro hint, launch posts, and PRIVACY.md.
9. **Test mode** on → buy it yourself → confirm the download link works → refund → test mode off. Tell Claude "test purchase done"; it logs it in Weekly Metrics as a test, not revenue.
10. Back up `~/.config/workspace-guardian/signing-key.pem` offline (USB or password manager attachment). Tell Claude it is done.

Per order afterwards: in `~/Desktop/projects/workspace-guardian-pro` run `npm run fulfil -- <order-id> <buyer-email> <next-renewal-plus-7-days>` and send the printed email from the support address.

## 2. Anthropic directory submission (about 15 minutes)

1. Open https://claude.ai/directory/manage (paid Claude plan) → **Submit** → *Plugin bundle*.
2. Repository: `https://github.com/d10or/workspace-guardian`. Name: `session-agents (Workspace Guardian)`.
3. Short and long description: section 4 of `docs/LAUNCH_POSTS.md`, verbatim. Category: developer tools / workflow. Support: GitHub issues.
4. Submit. Tell Claude the listing status when the email arrives (automated validation, then human review).

## 3. Fourth demo clip (2 minutes)

In any Claude Code surface on this repo: `/task add DEMO3 'docs/**' --branch feature/demo3`, then ask Claude to add a line to `docs/DEMO.md`. Record the Ownership question appearing; choose **Deny**. Then `/task done DEMO3`. Save the clip as `demo/recordings/hold.gif` or `.mp4` and tell Claude; it embeds it.

## 4. Launch posts (one afternoon)

Order: Reddit r/ClaudeAI, Show HN the same day, X thread. Texts in `docs/LAUNCH_POSTS.md`; replace the GIF placeholder with the raw GitHub URL in that file. Reply to every comment the same day; paste hard questions to Claude for a drafted answer. Log each post URL in the tracker's Weekly Metrics "evidence / channel notes".

## 5. Alpha outreach (30 minutes)

Five messages from `docs/ALPHA_OUTREACH.md` to the listed threads. Log each in the Alpha Testers sheet (label, date, channel). Forward replies to Claude; it files issues and fills the sheet.

## What Claude does after each step

Store URL → wires links and pushes. Test purchase → metrics row. First order → nothing to do, you fulfil; Claude files feedback. Posts → drafted replies. Alpha replies → issues, top-three fixes within the week, `/gate G3` when four of five completed the workflow.
