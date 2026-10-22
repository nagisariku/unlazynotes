---
version: alpha
name: Ollama
website: "https://ollama.com"
description: |
  An almost defiantly minimal documentation-first system that treats the home page like a Markdown README — paper-white canvas, 36px center-aligned heading, a single black pill CTA, an inline terminal install snippet, and a hand-drawn llama mascot as the only ornamental element. No gradient, no hero photography, no marketing pyrotechnics. The chrome is a tiny utility palette of pure black, pure white, and three neutral grays; every interactive element is fully rounded into a pill (`{rounded.full}`); typography is SF Pro Rounded for headings paired with system sans for body and ui-monospace for code. Pricing tiers, FAQs, and "your data stays yours" guarantees all sit on the same flat canvas inside thin-border cards — the system is the documentation, and the documentation is the system.

seo:
  title: "Ollama Design System for React — pure black #000000, SF Pro Rounded, 19 components"
  metaDescription: "Ollama's design system as a DESIGN.md file. Pure black #000000 on #ffffff canvas, SF Pro Rounded, 19 components. For React, Next.js, and AI tools."
  highlights:
    - "Two-color chrome — pure black #000000 on pure white #ffffff with three neutral grays, no brand accent at all"
    - "Pill geometry everywhere — every interactive element collapses to 9999px radius; cards use 12px and nothing else"
    - "One inverted moment per page — the dark #171717 Max pricing card is the only attention-grabbing surface in the entire system"
    - "Install snippet as hero CTA — an inline curl pill at 48px height replaces the standard hero illustration"
    - "Stock Apple typography — SF Pro Rounded display, ui-sans-serif body, ui-monospace code, treated as a non-decision"
  tags:
    - "AI & LLM Platforms"
    - "Developer Tools & IDEs"
  lastUpdated: "2026-05-12"
  author:
    name: "Dov Azencot"
    url: "https://x.com/dovazencot"
  opening: |
    Ollama runs the most aggressively under-designed marketing surface in AI tooling, and the restraint is the brand. The home page reads like a Markdown README rendered with care: a 36px center-aligned headline above an inline curl install snippet in a soft-gray pill, a single black Download CTA, and a hand-drawn llama as the only ornament. There is no gradient, no hero photography, no marketing pyrotechnics. Pricing tiers, FAQs, and the "your data stays yours" strip all sit on the same paper-white canvas (#ffffff) with quiet #737373 body text carrying the prose. The single inverted moment in the entire system is the dark #171717 Max pricing card, which breaks the flat-white rhythm exactly once per page.

    This DESIGN.md file captures the system in machine-readable form: 20 color tokens grouped into surface, text, hairline, and semantic terminal-light groups, 13 typography tokens (SF Pro Rounded display, ui-sans-serif body, ui-monospace code), five corner radii (with 9999px and 12px doing nearly all the work), eight spacing tokens, and 19 components — buttons, inputs, the signature install-snippet pill, terminal mockup card, pricing cards in both light and inverted dark variants, FAQ rows, nav, and footer. The format follows Google Labs' DESIGN.md spec so the same tokens resolve cleanly into Tailwind config, CSS variables, or component-library code.

    Feed the file to Claude, Cursor, or GitHub Copilot and the agent will reproduce Ollama's restraint instead of inventing decoration. Reference {colors.primary} or {rounded.full} directly in React components, or use the spec as an audit lens against your own marketing site. The system is worth studying for one reason: it proves a heavily technical product can ship a public surface that looks like its own CLI output, and the restraint scales — every section is the same long-form Markdown column, and every new component falls out of the existing pill plus flat-card plus terminal-mockup vocabulary.
  related:
    - href: "https://github.com/google-labs-code/design.md"
      title: "The DESIGN.md specification"
      description: "Google Labs' open spec for machine-readable design system files — the format this page is built on."
    - href: "/design"
      title: "Browse all design systems"
      description: "The full directory of DESIGN.md files on shadcn.io, with live mockups for each."
    - href: "/blocks"
      title: "React blocks for shadcn/ui"
      description: "Production-ready hero, pricing, CTA, and dashboard sections built with the same Tailwind + shadcn primitives."
  questions:
    - id: "primary-color"
      title: "What is Ollama's primary brand color?"
      answer: "Ollama's brand is pure black #000000 on a pure white #ffffff canvas. There is no second brand color anywhere in the marketing surfaces. Every primary CTA, every nav link, every solid icon renders in #000000, with a single #090909 pressed state. The only other color appearances are the three macOS terminal traffic-light dots (#ff5f56, #ffbd2e, #27c93f) inside the terminal mockup, and a translucent rgba(59,130,246,0.5) browser focus ring."
    - id: "dark-mode"
      title: "Does Ollama's design system have a dark mode?"
      answer: "No — the public marketing surfaces are light-only and rely on the #ffffff canvas end-to-end. The single dark surface in the system is #171717, used on the Max pricing card and rare dark CTA strips. That inversion exists to draw attention to exactly one element per page, not to provide a dark-mode alternative. The Models / Docs surfaces may extend the system, but the captured pages run light-only."
    - id: "typography"
      title: "What typography does Ollama use, and what should I use if SF Pro Rounded isn't available?"
      answer: "Headings run SF Pro Rounded at weights 500 and 600 from 36px down to 24px, while body uses ui-sans-serif at 16px / 400 and code uses ui-monospace at 16px and 14px. SF Pro Rounded is Apple-licensed and only ships on macOS and iOS, so Ollama explicitly accepts the heading face will look slightly different on Windows and Linux through system-ui fallback. Nunito is the closest open-source substitute for the display face; Inter pairs well as a near-perfect ui-sans-serif match; JetBrains Mono or Fira Code substitute for ui-monospace."
    - id: "shape-language"
      title: "Why is everything in Ollama's UI shaped like a pill?"
      answer: "The system's shape vocabulary is just two values: 9999px pills for every interactive element and 12px rounded cards. Buttons, search pills, the install-snippet pill, text inputs, and even the terminal traffic-light dots all collapse to {rounded.full}. Cards — pricing tiers, the terminal mockup — sit at 12px. There are no medium-radius compromises, no sharp corners except section dividers. The pill geometry quietly echoes SF Pro Rounded's softened letter terminals without becoming decorative."
    - id: "use-in-project"
      title: "Can I use this DESIGN.md to build my own React developer-tools site?"
      answer: "Yes — feed it to Claude, Cursor, or any AI tool that reads structured design tokens and the agent will produce React components that match Ollama's restraint instead of a generic shadcn theme. Every color, type style, radius, and spacing token is a quoted value you can paste into Tailwind config, CSS variables, or your own component library. The spec especially helps developer-tools sites that want a documentation-first feel — single black pill CTA, install-snippet pill below the hero, and one inverted dark card per page."
    - id: "known-gaps"
      title: "What's missing from this DESIGN.md spec?"
      answer: "A handful of things, documented in the Known Gaps section: mobile screenshots were not captured, so responsive behavior synthesizes the hamburger drawer, 1-up pricing stack, and install-snippet wrap from desktop evidence and the breakpoint stack. Hover states are omitted by system policy. Form-field styling beyond the search and install-snippet pills isn't present in the captured surfaces, authenticated chrome like account dropdowns and billing settings is out of scope, and the Models and Docs pages — which likely add a sidebar and a docs typography tier — are not in the captured set."

colors:
  primary: "#000000"
  on-primary: "#ffffff"
  ink: "#000000"
  ink-deep: "#090909"
  charcoal: "#525252"
  body: "#737373"
  mute: "#a3a3a3"
  canvas: "#ffffff"
  surface-soft: "#fafafa"
  surface-card: "#ffffff"
  hairline: "#e5e5e5"
  hairline-strong: "#d4d4d4"
  on-dark: "#ffffff"
  on-dark-mute: "rgba(255,255,255,0.7)"
  surface-dark: "#171717"
  focus-ring: "rgba(59,130,246,0.5)"
  link: "#000000"
  link-mute: "#737373"
  terminal-red: "#ff5f56"
  terminal-yellow: "#ffbd2e"
  terminal-green: "#27c93f"

typography:
  display-xl:
    fontFamily: SF Pro Rounded
    fontSize: 36px
    fontWeight: 500
    lineHeight: 1.11
    letterSpacing: 0
  display-lg:
    fontFamily: SF Pro Rounded
    fontSize: 30px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0
  heading-lg:
    fontFamily: SF Pro Rounded
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: 0
  heading-md:
    fontFamily: ui-sans-serif
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  heading-sm:
    fontFamily: ui-sans-serif
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.56
    letterSpacing: 0
  body-md:
    fontFamily: ui-sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-strong:
    fontFamily: ui-sans-serif
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: ui-sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0
  body-sm-strong:
    fontFamily: ui-sans-serif
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.43
    letterSpacing: 0
  caption-sm:
    fontFamily: ui-sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0
  code-md:
    fontFamily: ui-monospace
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  code-sm:
    fontFamily: ui-monospace
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0
  button-md:
    fontFamily: ui-sans-serif
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0

rounded:
  none: 0px
  sm: 6px
  md: 8px
  lg: 12px
  full: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  section: 88px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    padding: 8px 20px
    height: 36px
  button-primary-active:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    padding: 8px 20px
    height: 36px
  button-pill-on-dark:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    padding: 8px 20px
  button-disabled:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.mute}"
    rounded: "{rounded.full}"
  search-pill:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: 8px 16px
    height: 36px
  search-pill-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    padding: 8px 16px
    height: 40px
  text-input-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
  install-snippet:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.code-md}"
    rounded: "{rounded.full}"
    padding: 12px 20px
    height: 48px
  command-tag:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.code-sm}"
    rounded: "{rounded.full}"
    padding: 6px 12px
  terminal-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.code-sm}"
    rounded: "{rounded.lg}"
    padding: 16px
  terminal-traffic-lights:
    rounded: "{rounded.full}"
    size: 12px
  pricing-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 32px
  pricing-card-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 32px
  feature-bullet:
    textColor: "{colors.charcoal}"
    typography: "{typography.body-sm}"
  faq-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: 16px 0px
  link-inline:
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
  link-mute:
    textColor: "{colors.body}"
    typography: "{typography.body-sm}"
  primary-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm-strong}"
    rounded: "{rounded.none}"
    height: 56px
  footer-section:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    typography: "{typography.caption-sm}"
    rounded: "{rounded.none}"
    padding: 32px 24px
  cta-strip-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.heading-lg}"
    rounded: "{rounded.lg}"
    padding: 24px 32px
---

## Overview

Ollama's site is the most aggressively under-designed marketing surface in the AI tooling space, and that is the entire point. The home page reads like a Markdown README rendered with care: a 36px center-aligned heading sits above an inline `curl` install snippet inside a soft-gray pill, a single black "Download" CTA, and a hand-drawn llama mascot as the only ornament. Everything else — automate-your-work block, "Start local. Scale cloud." pricing pair, "Your data stays yours" guarantee strip, FAQ wall on `/pricing` — sits on the same paper-white canvas (`{colors.canvas}`) with quiet `{colors.body}` neutrals carrying the prose. The system is the documentation, and the documentation is the system.

The design philosophy is geometric: every interactive element collapses to `{rounded.full}` (9999px) — buttons, search pills, install-snippet pills, text inputs, and the terminal-traffic-light dots. There are no decorative drop shadows, no gradients, no hero illustrations beyond the llama. Cards (the rare ones, on `/pricing`) use a soft `{rounded.lg}` (12px) and a 1px hairline. The single inverted moment in the entire system is the dark "Max" pricing tier — `{colors.surface-dark}` with white text — which acts as the only attention-grabbing surface in an otherwise studiously flat layout.

Typography pairs SF Pro Rounded (display headings, weight 500–600) with the operating system's default sans (`ui-sans-serif`) for body and `ui-monospace` for code. The roundness of the heading face is the only "personality" the chrome carries — it gently echoes the `{rounded.full}` button geometry without being decorative about it.

**Key Characteristics:**
- Paper-white `{colors.canvas}` end-to-end with no surface alternation — the whole page is one continuous sheet
- Center-aligned hero with `{typography.display-xl}` SF Pro Rounded headline, no eyebrow, no subhead beyond a small "Power OpenClaw with Ollama" line under the llama
- Pill geometry everywhere: every button and pill input is `{rounded.full}`; cards use `{rounded.lg}`; nothing is sharp-cornered except section dividers
- Single-color CTA system: pure black `{colors.primary}` pills carry every action; "Get Pro" / "Get Max" inside pricing cards are the only variations
- Inline `curl` install snippet rendered as a pill with `{typography.code-md}` — the most signature element, sitting directly under the hero headline
- Terminal-mockup card with macOS traffic-light dots and inline `ollama launch openclaw` example — the home page's only "product preview"
- Inverted dark `{component.pricing-card-dark}` for the highest-tier "Max" plan, breaking the flat-white rhythm exactly once per page

## Known Gaps

- **Mobile screenshots not captured** — responsive behavior synthesizes Ollama's known mobile pattern (hamburger drawer, 1-up pricing stack, install-snippet wrap) from desktop evidence and the extracted breakpoint stack.
- **Hover states not documented** by system policy.
- **Form field styling** beyond search and install-snippet is not present in the captured surfaces — there is no visible long-form form on the home or pricing pages.
- **Authenticated chrome** (account dropdown, billing settings, model dashboard) not in the captured pages.
- **Models / Docs pages** not in the captured set — those surfaces likely add a sidebar and a docs typography tier that this document does not describe.
