# Backend Audit — Auth Page

## Endpoints
- **Supabase Auth**: `supabase.auth.signInWithPassword`, `supabase.auth.signUp`.
- **OAuth**: `lovable.auth.signInWithOAuth`.

## Security
- **JWT**: ✅ Client handles JWT via Supabase client.
- **Port Usage**: ✅ Standard 8000 (Supabase Kong) or direct HTTPS if remote.

## Data Flow
- **Profile**: ✅ `full_name` is correctly passed to `options.data` during sign-up.

## Observations
- No custom Port 18788 calls, which is appropriate for this page.
- Redirect URI is set to `window.location.origin` which is correct.
