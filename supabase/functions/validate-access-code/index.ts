import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { create } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a secure token for validated access codes
const generateAccessToken = async (codeId: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const token = await create(
    { alg: "HS256", typ: "JWT" },
    {
      codeId,
      exp: Date.now() / 1000 + (60 * 60), // 1 hour expiration
      iat: Date.now() / 1000,
    },
    key
  );

  return token;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ 
          valid: false,
          message: "Code manquant"
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if code exists and is not used
    const { data, error } = await supabase
      .from('access_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_used', false)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ 
          valid: false,
          message: "Code invalide ou déjà utilisé"
        }), 
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if code has expired
    if (data.expires_at) {
      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        return new Response(
          JSON.stringify({ 
            valid: false,
            message: "Ce code a expiré"
          }), 
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Mark code as used
    const { error: updateError } = await supabase
      .from('access_codes')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('code', code.toUpperCase());

    if (updateError) {
      console.error("Error marking code as used:", updateError);
      throw updateError;
    }

    // Generate secure access token
    const accessToken = await generateAccessToken(data.id);

    return new Response(
      JSON.stringify({ 
        valid: true,
        message: "Code validé avec succès",
        accessToken
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in validate-access-code function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        valid: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
