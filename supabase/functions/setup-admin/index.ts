import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Vérifier s'il existe déjà un admin
    const { data: existingAdmins } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .eq('role', 'admin')
      .limit(1);

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Un administrateur existe déjà' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Créer l'utilisateur admin
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: 'brudetileux@gmail.com',
      password: 'Order-Form_BoCompany(2025)',
      email_confirm: true
    });

    if (userError) throw userError;

    // Ajouter le rôle admin
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userData.user.id,
        role: 'admin'
      });

    if (roleError) throw roleError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Compte administrateur créé avec succès',
        email: 'brudetileux@gmail.com'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Une erreur est survenue' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
