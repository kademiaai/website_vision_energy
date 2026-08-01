// @/lib/supabaseServer.ts
// Stateless Supabase client for use inside Next.js Route Handlers
// (app/api/**/route.ts). Deliberately NOT lib/supabase.ts's
// createBrowserClient (that one is wired for browser cookie storage and
// isn't meant to run in a server request context) and NOT a cookie-aware
// SSR client either — every /api/analytics/* route sits behind
// middleware.ts's own auth check, so these queries only need the same
// anon-key read access the browser client already has (charging_sessions/
// customers are already readable via anon key today, e.g. the check-in
// cooldown lookup in checkinService.ts), not a per-request user session.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const _isConfigured = Boolean(supabaseUrl && supabaseKey);

const _stubClient = new Proxy(
  {},
  {
    get: () => () => {
      throw new Error("Supabase client not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    },
  }
);

export const supabaseServer: any = _isConfigured ? createClient(supabaseUrl, supabaseKey) : _stubClient;
