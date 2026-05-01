import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * REPLICATED LOGIC FROM SERVICES (to avoid import issues in scratch script)
 */
async function getPendingNotification(licensePlate: string) {
  const cleanPlate = licensePlate.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // 1. Check for unseen completions (Celebration)
  const { data: completion } = await supabase
    .from("rewards")
    .select("*")
    .eq("license_plate", cleanPlate)
    .eq("status", "completed")
    .is("completion_seen_at", null)
    .maybeSingle();

  if (completion) return { reward: completion, type: "completion" };

  // 2. Check for unseen selections (Winner Announcement)
  const { data: selection } = await supabase
    .from("rewards")
    .select("*")
    .eq("license_plate", cleanPlate)
    .eq("status", "eligible")
    .is("selection_seen_at", null)
    .maybeSingle();

  if (selection) return { reward: selection, type: "selection" };

  return null;
}

async function smokeTest() {
  const TEST_PLATE = "TEST99999";
  console.log(`🚀 Starting Smoke Test for Plate: ${TEST_PLATE}`);

  try {
    // 1. Cleanup old test data
    console.log("🧹 Cleaning up old test data...");
    await supabase.from('rewards').delete().eq('license_plate', TEST_PLATE);

    // 2. Test Selection (Winner)
    console.log("🏆 Creating mock 'eligible' reward...");
    const { data: reward, error: rError } = await supabase
      .from('rewards')
      .insert({
        license_plate: TEST_PLATE,
        month: 4,
        year: 2026,
        status: 'eligible',
        token: 'test-token-123',
        checkin_count: 50
      })
      .select()
      .single();

    if (rError) throw rError;
    console.log("✅ Reward created:", reward.id);

    // 3. Verify detection
    console.log("🔍 Checking if reward is detected as pending selection...");
    const pending1 = await getPendingNotification(TEST_PLATE);
    if (pending1?.type === 'selection') {
      console.log("✅ SUCCESS: Found pending selection.");
    } else {
      throw new Error(`Failed to find selection reward: ${JSON.stringify(pending1)}`);
    }

    // 4. Mark as seen
    console.log("👁️ Marking selection as seen...");
    await supabase.from('rewards').update({ selection_seen_at: new Date().toISOString() }).eq('id', reward.id);

    // 5. Verify it's gone
    console.log("🔍 Verifying selection is no longer pending...");
    const pending2 = await getPendingNotification(TEST_PLATE);
    if (!pending2) {
      console.log("✅ SUCCESS: Reward no longer pending.");
    } else {
      throw new Error("Reward still pending after being marked as seen");
    }

    // 6. Test Celebration
    console.log("🎊 Testing 'completed' celebration...");
    await supabase.from('rewards').update({ 
      status: 'completed',
      completion_seen_at: null // Reset for test
    }).eq('id', reward.id);
    
    const pending3 = await getPendingNotification(TEST_PLATE);
    if (pending3?.type === 'completion') {
      console.log("✅ SUCCESS: Found pending completion celebration!");
    } else {
      throw new Error("Completion celebration not found");
    }

    // 7. Cleanup
    console.log("🧹 Final cleanup...");
    await supabase.from('rewards').delete().eq('id', reward.id);

    console.log("\n✨ ALL SMOKE TESTS PASSED! ✨");

  } catch (err) {
    console.error("\n❌ Smoke test failed:");
    console.error(err);
  }
}

smokeTest();
