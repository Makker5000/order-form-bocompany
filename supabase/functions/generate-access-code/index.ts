import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const generateCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Generate new code
    const code = generateCode();
    
    // Insert code into database
    const { error: insertError } = await supabase
      .from('access_codes')
      .insert({ code, is_used: false });

    if (insertError) {
      console.error("Error inserting code:", insertError);
      throw insertError;
    }

    console.log("New access code generated:", code);

    // Send email with code
    const smtpClient = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: Deno.env.get("GMAIL_USER") || "",
          password: Deno.env.get("GMAIL_PASS") || "",
        },
      },
    });

    const companyEmail = Deno.env.get("COMPANY_EMAIL") || "";
    const companyName = Deno.env.get("COMPANY_NAME") || "BO Company SRL";

    await smtpClient.send({
      from: `${companyName} <${Deno.env.get("GMAIL_USER")}>`,
      to: companyEmail,
      subject: "Nouveau code d'accès au formulaire de commande",
      content: "text/html",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><h2 style="color: #1e3a8a;">Nouveau code d'accès</h2><p>Un nouveau code d'accès à usage unique a été généré pour le formulaire de commande.</p><div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;"><p style="margin: 0; font-size: 14px; color: #666;">Code d'accès:</p><p style="margin: 10px 0; font-size: 32px; font-weight: bold; color: #1e3a8a; letter-spacing: 4px;">${code}</p></div><p>Ce code est à usage unique et doit être fourni à votre client pour qu'il puisse accéder au formulaire de commande.</p><p style="color: #666; font-size: 12px; margin-top: 30px;">Ce code sera invalidé après utilisation.</p></div>`,
    });

    await smtpClient.close();

    console.log("Access code email sent to:", companyEmail);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Code généré et envoyé par email"
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-access-code function:", error);
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
