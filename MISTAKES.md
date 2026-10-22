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
