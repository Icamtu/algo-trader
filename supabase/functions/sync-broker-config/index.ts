import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default async function (req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const algoEngineUrl = Deno.env.get('ALGO_ENGINE_URL') || 'http://algo_engine:5001'

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse the request body
    const { broker_id } = await req.json()
    console.log(`Syncing config for broker: ${broker_id}`)

    // Fetch the latest config for this broker from the database
    // Note: In a production app, we would fetch based on the authenticated user's ID
    const { data: config, error: dbError } = await supabase
      .from('broker_configs')
      .select('*')
      .eq('broker_name', broker_id.toLowerCase())
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error(`Failed to fetch config for ${broker_id}: ${dbError.message}`)
    }

    if (!config) {
      throw new Error(`No configuration found for broker: ${broker_id}`)
    }

    console.log(`Found config for ${broker_id}, forwarding to engine at ${algoEngineUrl}...`)

    // Forward the config to the algo engine
    const response = await fetch(`${algoEngineUrl}/api/broker/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        broker_name: config.broker_name,
        user_id: config.broker_user_id || config.vendor_code?.split('_')[0],
        password: config.enc_password,
        totp_secret: config.enc_totp,
        api_key: config.enc_api_key,
        vendor_code: config.vendor_code,
        imei: config.imei
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Algo Engine returned error: ${errorText}`)
    }

    const result = await response.json()
    console.log('Sync successful:', result)

    return new Response(JSON.stringify({
      status: 'success',
      message: `Configuration for ${broker_id} synced to engine.`,
      engine_response: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in sync-broker-config:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
}
