# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are knowledge workers, developers, indie makers, students, and busy individuals who habitually dump thoughts, to-do lists, links, passwords, and finance logs into Telegram "Saved Messages" or WhatsApp chats, only for them to become an unorganized and forgotten graveyard.

## Product Purpose

UnlazyNotes turns raw, chaotic chat messages into a clean, searchable, and structured personal life OS within 1 second. It combines effortless zero-friction chat capture with an automated AI intent classifier and a minimal paper-white web dashboard.

## Positioning

Zero-friction chat-first capture via Telegram bot (@unlazynotes_bot) paired with an in-memory Deterministic Intent Router that resolves 70–80% of notes locally on-server without burning costly LLM tokens. This unique engineering architecture enables extreme affordability (Rp15.000/mo or $1/mo), fast 1-second auto-tagging, military-grade client-side/server-side AES-256-GCM private vault encryption, and 100% data portability (HTML/JSON export) without vendor lock-in.

## Operating Context

- **Capture Workflow:** Users send or forward text, URLs, task lists, or secrets directly to `@unlazynotes_bot` on mobile or desktop Telegram.
- **Review Workflow:** Users browse, filter, search, and edit notes on the clean web dashboard on desktop or mobile browsers.
- **Security Context:** Sensitive credentials are saved using `/secure <key> <secret>`, which encrypts the payload using AES-256-GCM and completely bypasses AI processing.

## Capabilities and Constraints

- **9 Standard Categories:** `todo`, `finance`, `schedule`, `bookmark`, `draft`, `credential`, `reference`, `random-yap`, `others`.
- **Private Encrypted Vault:** AES-256-GCM authenticated encryption for passwords, PINs, and API keys.
- **Zero Vendor Lock-in:** One-click export to HTML bookmarks and JSON.
- **Payment Gateway:** Integration with DOKU Payment (QRIS, VA, E-Wallet) and sandbox simulation for local dev.
- **Aesthetic Constraint:** Strictly adheres to Ollama-inspired documentation-first design system (`#000000` on `#ffffff`, SF Pro Rounded, 9999px pills, 12px cards, zero gradients, zero AI slop).

## Brand Commitments

- **Tone & Voice:** Direct, pragmatic, disciplined, developer-friendly, zero marketing fluff.
- **Design Philosophy:** Paper-white canvas, stock Apple typography (SF Pro Rounded display + ui-sans-serif body + ui-monospace code), flat cards, and no decorative tropes.

## Product Principles

1. **Zero Capture Friction:** Opening a heavy note app creates cognitive friction. Chatting with a bot takes 2 seconds.
2. **Privacy as an Invariant:** Secrets remain encrypted; vault items never touch LLM prompts.
3. **Restraint over Pyrotechnics:** No unnecessary badges, no gradients, and no decorative clutter. The UI is the documentation.
4. **Data Sovereignty:** The user owns their data completely; export is always one click away.
