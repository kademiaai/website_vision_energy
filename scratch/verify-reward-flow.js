/*
  scratch/verify-reward-flow.js
  Simple Node script to verify reward history and admin approval via Supabase REST API.

  Usage:
    SUPABASE_URL=... SUPABASE_KEY=... node scratch/verify-reward-flow.js 99H99999

  This script will:
  - Fetch rewards for the given license plate (exact match and ILIKE fallback)
  - Print results
  - Optionally, if a reward ID is provided and --approve is passed, attempt to set status to 'completed'
*/

// Use global fetch when available (Node 18+). Avoid requiring node-fetch.
const fetch = globalThis.fetch;

if (!fetch) {
  console.error('Global fetch is not available in this Node runtime. Please run on Node 18+ or install node-fetch.');
  process.exit(1);
}

// Load .env.local if present so the script can use local environment variables
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
} catch (e) {
  // ignore if dotenv not available; many environments already have env set
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_KEY environment variables');
  process.exit(1);
}

const plateArg = process.argv[2];
const rewardId = process.argv[3];
const doApprove = process.argv.includes('--approve');
const doInsert = process.argv.includes('--insert');

if (!plateArg) {
  console.error('Usage: SUPABASE_URL=... SUPABASE_KEY=... node scratch/verify-reward-flow.js <PLATE> [rewardId] [--approve]');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function fetchRewardsExact(plate) {
  const url = `${SUPABASE_URL}/rest/v1/rewards?license_plate=eq.${encodeURIComponent(plate)}&order=year.desc&order=month.desc`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Supabase request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchRewardsIlike(plate) {
  const url = `${SUPABASE_URL}/rest/v1/rewards?license_plate=like.*${encodeURIComponent(plate)}*&order=year.desc&order=month.desc`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Supabase request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function approveReward(id) {
  const url = `${SUPABASE_URL}/rest/v1/rewards?id=eq.${encodeURIComponent(id)}`;
  const body = { status: 'completed', rewarded_at: new Date().toISOString() };
  const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Approve failed: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

async function insertChargingSession(plate) {
  const url = `${SUPABASE_URL}/rest/v1/charging_sessions`;
  const body = {
    license_plate: plate,
    status: 'completed',
    station_id: 'station_01',
    start_time: new Date().toISOString()
  };

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Insert failed: ${res.status} ${res.statusText} - ${text}`);
  }
  // Some Supabase inserts return an empty body with 204; handle gracefully
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : { status: res.status };
  } catch (e) {
    return { status: res.status, raw: text };
  }
}

async function countMonthlySessions(plate) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/charging_sessions?license_plate=eq.${encodeURIComponent(plate)}&start_time=gte.${encodeURIComponent(firstDay)}`;
  const res = await fetch(url, { method: 'GET', headers: { ...headers, Prefer: 'count=exact' } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Count failed: ${res.status} ${res.statusText} - ${text}`);
  }
  const contentRange = res.headers.get('content-range') || '';
  // content-range format: 0-9/15 -> total = 15
  const parts = contentRange.split('/');
  const total = parts.length === 2 ? Number(parts[1]) : null;
  return total;
}

async function computeMonthlyRank(plate) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/charging_sessions?start_time=gte.${encodeURIComponent(firstDay)}&select=license_plate,start_time,customers(full_name,phone_number)`;
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ranking fetch failed: ${res.status} ${res.statusText} - ${text}`);
  }
  const sessions = await res.json();
  const counts = new Map();
  sessions.forEach(s => {
    const p = s.license_plate;
    counts.set(p, (counts.get(p) || 0) + 1);
  });
  const sorted = Array.from(counts.entries()).sort((a,b) => b[1] - a[1]);
  const rankIndex = sorted.findIndex(([p]) => p === plate);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;
  const totalSessions = counts.get(plate) || 0;
  return { rank, totalSessions };
}

(async () => {
  try {
    const plate = plateArg.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    console.log('Checking rewards for plate:', plate);

    let rewards = await fetchRewardsExact(plate);
    if (rewards.length === 0) {
      console.log('No exact matches, trying ILIKE fallback...');
      rewards = await fetchRewardsIlike(plate);
    }

    console.log(`Found ${rewards.length} reward(s):`);
    rewards.forEach((r) => {
      console.log(`- id=${r.id} plate=${r.license_plate} month=${r.month}/${r.year} status=${r.status} token=${r.token}`);
    });

    if (rewardId && doApprove) {
      console.log(`Approving reward ${rewardId}...`);
      const updated = await approveReward(rewardId);
      console.log('Approve response:', JSON.stringify(updated, null, 2));
    }

    if (doInsert) {
      console.log(`Inserting charging session for ${plateArg}...`);
      const inserted = await insertChargingSession(plate);
      console.log('Insert response:', JSON.stringify(inserted, null, 2));
      const monthlyCount = await countMonthlySessions(plate);
      console.log(`Monthly charging sessions for ${plate}:`, monthlyCount ?? 'unknown');
      const ranking = await computeMonthlyRank(plate);
      console.log(`Monthly rank for ${plate}:`, ranking.rank ?? 'unranked', `(${ranking.totalSessions} sessions)`);
    }

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
