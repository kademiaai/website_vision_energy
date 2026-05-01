// Integration test: verify that reward history contains a completed reward for the plate
// and that we can compute a monthly rank for the plate.

// Usage: SUPABASE_* env vars must be set (reads .env.local if present).

try { require('dotenv').config({ path: '.env.local' }); } catch (e) {}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Supabase env vars not found. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const fetch = globalThis.fetch;
if (!fetch) {
  console.error('Global fetch required (Node 18+).');
  process.exit(2);
}

const plateArg = process.argv[2] || '99H99999';
const plate = plateArg.replace(/[^A-Z0-9]/gi, '').toUpperCase();

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function fetchRewards(plate) {
  const url = `${SUPABASE_URL}/rest/v1/rewards?license_plate=eq.${encodeURIComponent(plate)}&order=year.desc&order=month.desc`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Supabase request failed: ${res.status}`);
  return res.json();
}

async function fetchSessionsThisMonth() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/charging_sessions?start_time=gte.${encodeURIComponent(firstDay)}&select=license_plate`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Supabase request failed: ${res.status}`);
  return res.json();
}

(async () => {
  try {
    console.log('Running integration test for plate:', plate);
    const rewards = await fetchRewards(plate);

    if (!rewards || rewards.length === 0) {
      console.error('No rewards found for plate:', plate);
      process.exit(1);
    }

    const completed = rewards.find(r => r.status === 'completed');
    if (!completed) {
      console.error('No completed reward found for plate:', plate);
      process.exit(1);
    }

    console.log('Found completed reward id=', completed.id, 'month=', completed.month, '/', completed.year);

    const sessions = await fetchSessionsThisMonth();
    const counts = new Map();
    sessions.forEach(s => counts.set(s.license_plate, (counts.get(s.license_plate) || 0) + 1));
    const sorted = Array.from(counts.entries()).sort((a,b) => b[1] - a[1]);
    const rankIndex = sorted.findIndex(([p]) => p === plate);
    if (rankIndex === -1) {
      console.error('Plate has no sessions this month; rank not found.');
      process.exit(1);
    }

    console.log(`Plate ${plate} rank=${rankIndex+1} with ${counts.get(plate)} sessions`);
    console.log('Integration test passed.');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(2);
  }
})();
