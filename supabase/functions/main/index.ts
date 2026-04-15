import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const functionName = url.pathname.split('/').pop()

  console.log(`Routing request to function: ${functionName}`)

  try {
    const module = await import(`../${functionName}/index.ts`)
    return await module.default(req)
  } catch (err) {
    console.error(`Error loading function ${functionName}:`, err)
    return new Response(JSON.stringify({ error: `Function ${functionName} not found or failed to load.`, details: err.message }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}, { port: 9999, hostname: '0.0.0.0' })
