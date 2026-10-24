# Failure Log (MISTAKES.md)

This log records unexpected failures, broken contracts, or user corrections across the Antigravity engineering environment. Entries are prepended chronologically.

Per Rule 10 of the Antigravity Constitution, each entry must contain the following four mandatory fields:
1. **Date & Incident:** Summary of what broke.
2. **Root Cause:** What flawed assumption or missing validation triggered the defect?
3. **Impact:** What was disrupted or regressed?
4. **Preventive Invariant:** Concrete rule or automated guard to prevent recurrence.

*(Any failure pattern occurring 3 times must be promoted to permanent constitutional rules.)*

---

<!-- Entries are prepended below this line -->

### 2026-10-25: Snippet Pagination Group Chunk Desync & Missing Empty Review State Navigation
- **Date & Incident:** `/read` displayed fewer snippet entries (e.g., 6 items) while inline buttons rendered up to 10, skipping notes (4), (5), (9), (10). Additionally, `/review` empty state lacked a navigation button to return to `/tags`.
- **Root Cause:** When updating pagination group chunk size from 3 to 5, the loop increment was changed to `i += 5`, but the inner slice remained `snippets.slice(i, i + 3)` instead of `slice(i, i + 5)`. Additionally, the empty state branch in `handleReviewCommand` did not attach the `[ 🏷 Kembali ke Tags ]` inline keyboard.
- **Impact:** Users experienced text omissions on list commands while pagination buttons were present, and lacked an in-place button to return to the tags menu when review was empty.
- **Preventive Invariant:**
  1. Chunked array partitioning must tie slice length strictly to the step stride or chunk constant (`slice(i, i + CHUNK_SIZE)`).
  2. Test assertions for paginated snippets must iterate and verify the presence of every single indexed item (1 through N) rather than only boundary samples.
  3. Empty state views on conversational Telegram interfaces must always offer direct return or fallback navigation action buttons.


### 2026-10-24: Finance Page UI Layout Regressed to Unconstrained Fullwidth Divs Instead of Design System
- **Date & Incident:** User critiqued the newly generated Finance page for using unconstrained full-width wrappers and div-based list containers instead of following the established design system tokens and Admin dashboard layout.
- **Root Cause:** Scaffolding `FinanceView.tsx` initially applied `max-w-full`, unconstrained full-width search input, and custom div-based cards rather than strictly matching [`AdminDashboard.tsx`](file:///d:/Code/unlazynotes/src/components/admin/AdminDashboard.tsx) container max-width (`max-w-[1680px] 2xl:max-w-[1760px]`), exact typography tokens, Recharts card structure, and semantic `<table>` elements.
- **Impact:** The Finance page stretched awkwardly across ultra-wide desktop viewports and lacked consistency with the rest of the application.
- **Preventive Invariant:**
  1. New dashboard pages must strictly inherit container max-width (`max-w-[1680px] 2xl:max-w-[1760px]`) and layout conventions from [`AdminDashboard.tsx`](file:///d:/Code/unlazynotes/src/components/admin/AdminDashboard.tsx).
  2. Tabular datasets must use semantic HTML `<table>` with sticky `<thead>`, explicit typography tokens, and fixed-height scroll boundaries.
  3. Interactive filters must integrate with [`NotesFilterPopover.tsx`](file:///d:/Code/unlazynotes/src/components/dashboard/NotesFilterPopover.tsx) rather than ad-hoc inline dropdowns.

### 2026-10-20: Unsolicited Modification of Vault SAAS Directory
- **Date & Incident:** Agent modified files and created a new note inside `G:\My Drive\Obsidian\NagisaVault\Project\SAAS\` when asked to save notes to Obsidian.
- **Root Cause:** Flawed assumption that "save to notes obsidian kita" applied to both skill definitions and project phase documentation under `Project/SAAS/`.
- **Impact:** `unlazynotes.com.md` was modified and an unrequested phase note was created in the user's protected project directory.
- **Preventive Invariant:**
  1. The directory `NagisaVault/Project/SAAS/` is strictly read-only unless the user explicitly names a file in that specific directory to edit.
  2. Saving agent skills or workflows to Obsidian is strictly confined to `Development/Skills/`.
  3. Reverted all modifications to `Project/SAAS/` immediately upon correction.

### 2026-09-19: Porter Remote Fetch SSRF, Incomplete Manifest Subfiles, and Sanitizer Bypass
- **Date & Incident:** GPT external architectural audit identified SSRF exposure in `porter.py fetch_target_content()`, loss of skill subfiles (scripts, references, assets) in `ManifestEngine`, incomplete sanitization leaving test-weakening directives intact, and platform-specific hardcoded `python3 ~/.gemini/config/...` in hooks.
- **Root Cause:**
  1. `fetch_target_content()` performed raw `urllib.request.urlopen` without socket DNS IP resolution against private/loopback/link-local CIDR ranges.
  2. `build_manifest()` only ingested root `SKILL.md` files without traversing nested subdirectories.
  3. `sanitize_for_import()` only stripped sycophancy patterns, ignoring `TEST_WEAKENING_PATTERNS`.
  4. `hooks.json` assumed a Unix environment and fixed `~/.gemini/config/` path.
- **Impact:** Skills with nested scripts or assets (`silk-design`, `unlazy`, `upstream-auditor`, `antislop-human`) lost 76 auxiliary files in canonical manifest export; remote URL inspection could theoretically query internal network resources; cross-platform portability on Windows broke.
- **Preventive Invariant:**
  1. Any remote URL ingestion function must resolve hostnames to IP addresses and block private/loopback/link-local ranges before issuing requests (`_validate_safe_url`).
  2. Canonical manifest compilers must recursively bundle all skill subfiles (`subfiles: Dict[str, str]`).
  3. Sanitizers must actively neutralize detected invariant violations rather than solely raising audit warnings.
  4. Machine-enforced invariant verification (`scripts/verify_invariants.py`) must be executed prior to any release delivery.
