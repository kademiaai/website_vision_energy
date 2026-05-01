import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkBucket() {
  console.log("Checking buckets...")
  const { data, error } = await supabase.storage.listBuckets()
  if (error) {
    console.error("Error listing buckets:", error)
  } else {
    console.log("Buckets:", data.map(b => b.name))
    const exists = data.some(b => b.name === 'verification-docs')
    if (!exists) {
      console.log("CRITICAL: 'verification-docs' bucket is MISSING!")
    } else {
      console.log("'verification-docs' bucket exists.")
    }
  }
}

checkBucket()
