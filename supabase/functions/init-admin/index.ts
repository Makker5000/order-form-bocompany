import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");

    if (!adminEmail || !adminPassword) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in secrets");
    }

    // Check if admin user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const adminExists = existingUser?.users.find(u => u.email === adminEmail);

    let userId: string;

    if (adminExists) {
      console.log("Admin user already exists, updating password");
      userId = adminExists.id;
      
      // Update password
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: adminPassword,
      });
    } else {
      console.log("Creating new admin user");
      
      // Create admin user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      });

      if (createError) throw createError;
      if (!newUser.user) throw new Error("Failed to create admin user");
      
      userId = newUser.user.id;
    }

    // Check if admin role already exists for this user
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("*")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    if (!existingRole) {
      // Assign admin role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "admin",
        });

      if (roleError) throw roleError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Admin user initialized successfully",
        email: adminEmail
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in init-admin function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
