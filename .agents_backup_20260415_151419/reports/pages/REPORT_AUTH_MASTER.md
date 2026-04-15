# AUTH PAGE — MASTER AUDIT REPORT
# Route: `/auth` (aliased from `/login` in user mental model)
# Related: `/forgot-password`, `/reset-password`
# Date: 2026-04-14 | Auditor: Antigravity

## Page Inventory

| File | Size | Role |
|------|------|------|
| `pages/Auth.tsx` | 264 lines | Login/Signup dual-mode form |
| `pages/ForgotPassword.tsx` | 77 lines | Password recovery request |
| `pages/ResetPassword.tsx` | 86 lines | New password entry |
| `contexts/AuthContext.tsx` | 63 lines | Session state + signOut |
| `integrations/supabase/client.ts` | 17 lines | Supabase client init |
| `integrations/lovable/index.ts` | 39 lines | Google OAuth via Lovable |
| `algo-trader/utils/auth.py` | 43 lines | Backend JWT validator |

## UI Scanner Findings

### Visuals and Design Consistency

| # | Severity | Issue | File | Detail |
|---|----------|-------|------|--------|
| U1 | HIGH | Design divergence across auth pages | ForgotPassword/ResetPassword vs Auth | Auth.tsx uses institutional dark theme (amber/industrial). ForgotPassword and ResetPassword use a completely different design language: glass-panel-elevated, neon-text-cyan, glow-button, rounded-xl — legacy patterns from a previous design iteration. |
| U2 | CRITICAL | Ghost CSS classes — no definitions | ForgotPassword:41,64 ResetPassword:63,77 | glass-panel-elevated, glow-button, neon-text-cyan are referenced but never defined in any CSS file. These classes are no-ops. Elements render without intended styles. |
| U3 | MEDIUM | Missing Shadcn CSS variables | index.css | Only --background, --foreground, --primary, --primary-foreground defined. Missing: --card, --muted, --accent, --destructive, --ring, --input, --popover, --secondary-foreground. Auth.tsx uses bg-card/40 and text-muted-foreground which rely on Tailwind Shadcn defaults. |
| U4 | LOW | App.css contains Vite boilerplate | App.css:1-43 | Default Vite template CSS (#root max-width 1280px) still present. Conflicts with full-screen auth layout via padding 2rem on #root. |
| U5 | LOW | Duplicate noise/scanline overlays | Auth.tsx:69-70 + App.tsx:91-92 | Auth page renders its own noise-overlay and scanline, but App.tsx also renders global ones. Double overlays = double opacity. |

### Motion and Animation

| # | Severity | Issue | Detail |
|---|----------|-------|--------|
| U6 | OK | framer-motion enter transitions present | Auth.tsx has initial/animate on form container and brand unit |
| U7 | MEDIUM | No exit transitions | Auth page lacks exit variants for tab switching or form submission feedback |
| U8 | LOW | No loading skeleton on initial auth state check | ProtectedRoute shows plain text with no skeleton or branded animation |

### Accessibility

| # | Severity | Issue | Detail |
|---|----------|-------|--------|
| U9 | HIGH | Zero id attributes on any form element | All 3 auth pages have 0 element IDs. Breaks automated testing, analytics, and screen reader association. |
| U10 | HIGH | Labels not associated with inputs | label elements have no htmlFor. input elements have no id. Labels are decorative-only. |
| U11 | MEDIUM | No autocomplete attributes | Email/password inputs missing autocomplete=email and autocomplete=current-password/new-password. Breaks password manager integration. |
| U12 | MEDIUM | No aria-label on toggle/icon buttons | Password visibility toggle and Google OAuth button lack aria-label. |
| U13 | LOW | Tab switching lacks tablist semantics | Login/Signup toggle needs role=tablist, role=tab, aria-selected attributes. |

## Backend Scanner Findings

### Endpoint Mapping

| # | Severity | Issue | Detail |
|---|----------|-------|--------|
| B1 | INFO | Auth.tsx makes zero calls to Port 18788 | Authentication handled exclusively via Supabase (Port 8000 via Kong). Correct — engine should not handle user auth. |
| B2 | OK | Backend require_auth decorator is solid | JWT validation with HS256, verify_aud False for local Supabase, proper error handling. |
| B3 | MEDIUM | JWT_SECRET has hardcoded fallback | utils/auth.py:10 — fallback string is dangerous if .env is misconfigured. |
| B4 | INFO | No backend rate-limiting on auth | Supabase GoTrue handles rate-limits. No custom rate-limiter needed. |

### Auth Flow Analysis

| Step | Client Action | Target | Protocol |
|------|--------------|--------|----------|
| 1 | Email Login | supabase.auth.signInWithPassword() | Supabase JS -> Kong -> GoTrue |
| 2 | Signup | supabase.auth.signUp() | Supabase JS -> Kong -> GoTrue |
| 3 | Google OAuth | lovable.auth.signInWithOAuth("google") | Lovable SDK -> redirect -> Supabase setSession() |
| 4 | Forgot Password | supabase.auth.resetPasswordForEmail() | Supabase JS -> Kong -> GoTrue |
| 5 | Reset Password | supabase.auth.updateUser() | Supabase JS -> Kong -> GoTrue |
| 6 | Session Persist | onAuthStateChange + getSession | Supabase JS client |
| 7 | Sign Out | supabase.auth.signOut() + localStorage clear | Client-side |

## Risk Scanner Findings

| # | Severity | Issue | Detail |
|---|----------|-------|--------|
| R1 | OK | No unauthorized order submission paths from auth pages | Auth pages dont expose trading endpoints. |
| R2 | MEDIUM | No CSRF token on forms | Acceptable for SPA with Supabase, but noted. |
| R3 | LOW | No password strength indicator | minLength=6 is the only validation. No real-time feedback. |
| R4 | INFO | Lovable OAuth dependency | External SaaS. If down, Google OAuth fails. Fallback: email/password works. |
| R5 | LOW | signOut() uses window.location.href redirect | Forces full reload. Intentional but loses in-memory data. |

## Performance Findings

| # | Severity | Issue | Detail |
|---|----------|-------|--------|
| P1 | MEDIUM | Double authStateChange race | AuthContext.tsx:26-34 — Both onAuthStateChange and getSession().then() call setLoading(false) independently. Potential race where loading flips before session is fully initialized. |
| P2 | LOW | Lovable auto-import on every page | cloud-auth-js loaded regardless of Google OAuth usage. Should be lazily imported. |
| P3 | LOW | No code-splitting on Auth routes | Auth pages statically imported. Should use React.lazy() to reduce bundle for logged-in users. |

## MASTER FINDINGS SUMMARY

### BLOCKERS (Must Fix)
1. U2 — Ghost CSS classes render ForgotPassword and ResetPassword with broken/missing styles.
2. U9 + U10 — Zero accessibility on auth forms (no IDs, no label associations).

### FRICTION (Should Fix)
3. U1 — Complete design language mismatch between Auth.tsx and ForgotPassword/ResetPassword.
4. U3 — Missing Shadcn CSS variables means bg-card, text-muted-foreground rely on framework defaults.
5. U11 — Missing autocomplete attributes break password managers.
6. U12 — Missing aria labels on interactive elements.
7. B3 — Hardcoded JWT_SECRET fallback in production decorator.
8. P1 — Auth state race condition in AuthContext.

### POLISH (Nice to Fix)
9. U4 — Remove Vite boilerplate CSS.
10. U5 — Deduplicate noise/scanline overlays.
11. U7 — Add exit transitions.
12. U8 — Branded loading skeleton.
13. U13 — Proper tablist semantics.
14. P3 — Lazy load auth pages.
15. R3 — Password strength indicator.
16. R5 — Document or convert hard redirect on signout.

## PROPOSED FIX PLAN (Phase 3 — pending approval)

### Priority 1: Fix Blockers
- Redesign ForgotPassword.tsx and ResetPassword.tsx to match Auth.tsx institutional theme.
- Remove all ghost CSS classes.
- Add unique id attributes to all form inputs and buttons.
- Associate labels with htmlFor on all label elements.

### Priority 2: Fix Friction
- Add missing Shadcn CSS variables to index.css.
- Add autocomplete attributes to email and password inputs.
- Add aria-label to icon-only buttons.
- Fix auth race condition in AuthContext.tsx by guarding with a mounted ref.
- Remove hardcoded JWT_SECRET fallback — fail hard if env var missing.

### Priority 3: Polish
- Remove App.css Vite boilerplate.
- Remove duplicate noise/scanline overlays from Auth.tsx.
- Add React.lazy() for auth route code-splitting.
- Add password strength indicator.
- Add proper ARIA tablist semantics.

## PAUSED: Awaiting approval to proceed with Phase 3 fixes.
