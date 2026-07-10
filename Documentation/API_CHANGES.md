Required API-project changes

1. New endpoint POST /internal/feed-debug/generate in src/app/routers/xrpc.py (or a new internal.py router).
2. Modify upsert_user or add a helper to ensure debug_feeds = true for first-time observability users.
3. Optionally expose set_user_debug_flag as a small helper if not already available.
   The rest of the API stays untouched.
