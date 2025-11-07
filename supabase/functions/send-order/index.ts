import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.173.0/encoding/base64.ts";
import { verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const client = new SMTPClient({
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting store (in-memory, resets on function restart)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // 5 requests
const RATE_WINDOW = 3600000; // per hour

// HTML escaping function to prevent XSS
const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

// Validation schemas
const OrderItemSchema = z.object({
  productName: z.string().min(1).max(200),
  size: z.string().min(1).max(50),
  quantity: z.number().int().min(0).max(10000),
  unitPrice: z.number().min(0).max(1000000),
  total: z.number().min(0).max(10000000),
});

const CompanySchema = z.object({
  nom: z.string().min(1).max(200),
  directeur: z.string().min(1).max(200),
  adresse: z.string().min(1).max(500),
  codePostal: z.string().min(1).max(100),
  telephone: z.string().min(1).max(50),
  email: z.string().email().max(255),
  tva: z.string().min(1).max(50),
});

const ClientSchema = z.object({
  nom: z.string().min(1).max(200),
  entreprise: z.string().min(1).max(200),
  adresse: z.string().min(1).max(500),
  codePostal: z.string().min(1).max(100),
  telephone: z.string().min(1).max(50),
  email: z.string().email().max(255),
});

const OrderDataSchema = z.object({
  date: z.string().min(1).max(50),
  company: CompanySchema,
  client: ClientSchema,
  items: z.array(OrderItemSchema).min(1).max(100),
  subtotal: z.number().min(0).max(10000000),
  vat: z.number().min(0).max(10000000),
  total: z.number().min(0).max(10000000),
  accessToken: z.string().min(1),
});

type OrderData = z.infer<typeof OrderDataSchema>;

// Verify access token
const verifyAccessToken = async (token: string): Promise<boolean> => {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const payload = await verify(token, key);
    
    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Token verification failed:", error);
    return false;
  }
};

// Rate limiting check
const checkRateLimit = (clientEmail: string): boolean => {
  const now = Date.now();
  const limiter = rateLimitStore.get(clientEmail);

  if (!limiter || now > limiter.resetTime) {
    rateLimitStore.set(clientEmail, {
      count: 1,
      resetTime: now + RATE_WINDOW,
    });
    return true;
  }

  if (limiter.count >= RATE_LIMIT) {
    return false;
  }

  limiter.count++;
  return true;
};

const generatePDFHTML = (orderData: OrderData): string => {
  const productsRows = orderData.items
    .filter(item => item.quantity > 0)
    .map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.productName)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.size)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">€${item.total.toFixed(2)}</td>
      </tr>
    `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body { font-family: Arial, sans-serif; padding: 40px; color: #333; } .header { text-align: center; margin-bottom: 30px; } .title { font-size: 24px; font-weight: bold; color: #1e3a8a; margin-bottom: 20px; } .date { text-align: right; margin-bottom: 20px; } .section { margin-bottom: 30px; } .section-title { font-size: 14px; font-weight: bold; color: #1e3a8a; margin-bottom: 10px; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; } .info-block { margin-bottom: 5px; font-size: 12px; } table { width: 100%; border-collapse: collapse; margin-top: 10px; } th { background-color: #1e3a8a; color: white; padding: 10px; text-align: left; font-size: 12px; } td { font-size: 11px; } .totals { margin-top: 20px; } .totals-row { display: flex; justify-content: flex-end; margin-bottom: 8px; font-size: 13px; } .totals-label { margin-right: 20px; font-weight: bold; } .totals-value { min-width: 100px; text-align: right; } .total-final { font-size: 16px; color: #1e3a8a; font-weight: bold; border-top: 2px solid #1e3a8a; padding-top: 10px; } .payment-info { margin-top: 30px; padding: 15px; background-color: #f3f4f6; border-radius: 5px; font-size: 11px; }</style></head><body><div class="header"><div class="title">FORMULAIRE DE COMMANDE</div></div><div class="date">Date: ${escapeHtml(orderData.date)}</div><div class="section"><div class="section-title">FOURNISSEUR</div><div class="info-block"><strong>${escapeHtml(orderData.company.nom)}</strong></div><div class="info-block">${escapeHtml(orderData.company.directeur)}</div><div class="info-block">${escapeHtml(orderData.company.adresse)}</div><div class="info-block">${escapeHtml(orderData.company.codePostal)}</div><div class="info-block">Tél: ${escapeHtml(orderData.company.telephone)}</div><div class="info-block">Email: ${escapeHtml(orderData.company.email)}</div><div class="info-block">TVA: ${escapeHtml(orderData.company.tva)}</div></div><div class="section"><div class="section-title">CLIENT</div><div class="info-block">Nom: ${escapeHtml(orderData.client.nom)}</div><div class="info-block">Entreprise: ${escapeHtml(orderData.client.entreprise)}</div><div class="info-block">Adresse: ${escapeHtml(orderData.client.adresse)}</div><div class="info-block">Code Postal: ${escapeHtml(orderData.client.codePostal)}</div><div class="info-block">Téléphone: ${escapeHtml(orderData.client.telephone)}</div><div class="info-block">Email: ${escapeHtml(orderData.client.email)}</div></div><div class="section"><div class="section-title">PRODUITS COMMANDÉS</div><table><thead><tr><th>Produit</th><th>Taille</th><th style="text-align: center;">Quantité</th><th style="text-align: right;">Prix Unit.</th><th style="text-align: right;">Total</th></tr></thead><tbody>${productsRows}</tbody></table><div class="totals"><div class="totals-row"><span class="totals-label">Sous-total HTVA:</span><span class="totals-value">€${orderData.subtotal.toFixed(2)}</span></div><div class="totals-row"><span class="totals-label">TVA (21%):</span><span class="totals-value">€${orderData.vat.toFixed(2)}</span></div><div class="totals-row total-final"><span class="totals-label">TOTAL TTC:</span><span class="totals-value">€${orderData.total.toFixed(2)}</span></div></div></div><div class="payment-info"><div><strong>Mode de paiement:</strong> Virement bancaire</div><div><strong>Frais de livraison:</strong> Gratuits pour toute commande supérieure à €350</div></div></body></html>`;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    const rawData = await req.json();
    
    // Validate all input data with Zod
    const validationResult = OrderDataSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input data",
          details: validationResult.error.errors,
          success: false
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const orderData = validationResult.data;

    // Verify access token
    const isValidToken = await verifyAccessToken(orderData.accessToken);
    if (!isValidToken) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid or expired access token",
          success: false
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check rate limit
    if (!checkRateLimit(orderData.client.email)) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. Please try again later.",
          success: false
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const htmlContent = generatePDFHTML(orderData);
    
    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(htmlContent);
    const htmlBase64 = base64Encode(htmlBytes.buffer);
    
    // Email to client
    await client.send({
      from: `${escapeHtml(orderData.company.nom)} <${Deno.env.get("GMAIL_USER")}>`,
      to: orderData.client.email,
      subject: `Confirmation de commande - ${escapeHtml(orderData.client.nom)}`,
      content: "text/html",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #1e3a8a;">Confirmation de votre commande</h2><p>Bonjour ${escapeHtml(orderData.client.nom)},</p><p>Nous avons bien reçu votre commande d'un montant de <strong>€${orderData.total.toFixed(2)}</strong>.</p><p>Veuillez trouver votre bon de commande en pièce jointe.</p><p>Nous vous remercions de votre confiance.</p><p>Cordialement,<br><strong>${escapeHtml(orderData.company.nom)}</strong></p></div>`,
      attachments: [
        {
          filename: `Commande_${escapeHtml(orderData.client.nom)}_${escapeHtml(orderData.date).replace(/\//g, '-')}.html`,
          content: htmlBase64,
          encoding: "base64",
          contentType: "text/html",
        },
      ],
    });
    
    // Email to company
    await client.send({
      from: `${escapeHtml(orderData.company.nom)} <${Deno.env.get("GMAIL_USER")}>`,
      to: orderData.company.email,
      subject: `Nouvelle commande - ${escapeHtml(orderData.client.nom)}`,
      content: "text/html",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #1e3a8a;">Nouvelle commande reçue</h2><p><strong>Client:</strong> ${escapeHtml(orderData.client.nom)}</p><p><strong>Entreprise:</strong> ${escapeHtml(orderData.client.entreprise)}</p><p><strong>Email:</strong> ${escapeHtml(orderData.client.email)}</p><p><strong>Téléphone:</strong> ${escapeHtml(orderData.client.telephone)}</p><p><strong>Montant total:</strong> €${orderData.total.toFixed(2)}</p><p>Veuillez trouver le bon de commande en pièce jointe.</p></div>`,
      attachments: [
        {
          filename: `Commande_${escapeHtml(orderData.client.nom)}_${escapeHtml(orderData.date).replace(/\//g, '-')}.html`,
          content: htmlBase64,
          encoding: "base64",
          contentType: "text/html",
        },
      ],
    });
    
    await client.close();

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Commande envoyée avec succès"
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-order function:", error);
    return new Response(
      JSON.stringify({ 
        error: "An error occurred while processing your order",
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