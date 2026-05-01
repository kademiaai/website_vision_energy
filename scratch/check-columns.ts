import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumns() {
  console.log("🔍 Checking rewards table columns...");
  
  // Try to query the new columns
  const { error } = await supabase
    .from('rewards')
    .select('selection_seen_at, completion_seen_at')
    .limit(1);

  if (error) {
    if (error.code === '42703') { // Undefined column
      console.error("❌ MISSING COLUMNS: selection_seen_at or completion_seen_at do not exist!");
      console.log("Please run the SQL migration provided in the walkthrough.");
    } else {
      console.error("❌ Error querying columns:", error.message);
    }
  } else {
    console.log("✅ New columns exist!");
  }
}

checkColumns();
