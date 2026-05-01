// // @/lib/supabase.ts
// import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// export const supabase = createClient(supabaseUrl, supabaseKey);

// @/lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const _isConfigured = Boolean(supabaseUrl && supabaseKey);

const _stubClient = new Proxy({}, { get: () => () => { throw new Error('Supabase client not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'); } });

if (!_isConfigured) {
  // Avoid noisy build failures; log once when running in environments without config.
  // This will not throw during module evaluation.
  // eslint-disable-next-line no-console
  console.warn('[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Using stub client.');
}

export const supabase: any = _isConfigured
  ? createBrowserClient(supabaseUrl, supabaseKey)
  : _stubClient;