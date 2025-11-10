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

const generateDetailedPDF = (orderData: OrderData): string => {
  const productsRows = orderData.items
    .filter(item => item.quantity > 0)
    .map(item => `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.productName)}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${escapeHtml(item.size)}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #1e3a8a;">€${item.total.toFixed(2)}</td>
      </tr>
    `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commande ${escapeHtml(orderData.client.nom)}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20mm; }
      .no-print { display: none; }
    }
    body { 
      font-family: 'Helvetica Neue', Arial, sans-serif; 
      padding: 40px; 
      color: #1f2937; 
      max-width: 900px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header { 
      text-align: center; 
      margin-bottom: 40px; 
      padding-bottom: 20px;
      border-bottom: 3px solid #1e3a8a;
    }
    .title { 
      font-size: 32px; 
      font-weight: bold; 
      color: #1e3a8a; 
      margin: 0 0 10px 0;
      letter-spacing: 1px;
    }
    .subtitle {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
    }
    .date { 
      text-align: right; 
      margin-bottom: 30px; 
      font-size: 14px;
      color: #6b7280;
      font-weight: 500;
    }
    .section { 
      margin-bottom: 35px; 
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #1e3a8a;
    }
    .section-title { 
      font-size: 16px; 
      font-weight: bold; 
      color: #1e3a8a; 
      margin: 0 0 15px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .info-block { 
      margin-bottom: 8px; 
      font-size: 13px;
      line-height: 1.6;
    }
    .info-label {
      font-weight: 600;
      color: #374151;
      display: inline-block;
      min-width: 120px;
    }
    .info-value {
      color: #1f2937;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 15px;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    th { 
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: white; 
      padding: 15px 10px; 
      text-align: left; 
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    th:nth-child(2), th:nth-child(3), th:nth-child(4), th:nth-child(5) {
      text-align: center;
    }
    td { 
      font-size: 13px;
      background-color: #ffffff;
    }
    tr:hover td {
      background-color: #f9fafb;
    }
    .totals { 
      margin-top: 30px; 
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 8px;
    }
    .totals-row { 
      display: flex; 
      justify-content: flex-end; 
      margin-bottom: 12px; 
      font-size: 14px;
      align-items: center;
    }
    .totals-label { 
      margin-right: 30px; 
      font-weight: 600;
      color: #374151;
      min-width: 150px;
      text-align: right;
    }
    .totals-value { 
      min-width: 120px; 
      text-align: right;
      color: #1f2937;
      font-weight: 500;
    }
    .total-final { 
      font-size: 20px; 
      color: #1e3a8a; 
      font-weight: bold; 
      border-top: 2px solid #1e3a8a; 
      padding-top: 15px;
      margin-top: 15px;
    }
    .payment-info { 
      margin-top: 40px; 
      padding: 20px; 
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      border-radius: 8px; 
      font-size: 13px;
      border-left: 4px solid #10b981;
    }
    .payment-info-title {
      font-weight: bold;
      color: #1e3a8a;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .payment-item {
      margin-bottom: 8px;
      display: flex;
      align-items: center;
    }
    .payment-item strong {
      color: #374151;
      min-width: 150px;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">FORMULAIRE DE COMMANDE</div>
    <div class="subtitle">Bon de commande détaillé</div>
  </div>
  
  <div class="date"><strong>Date:</strong> ${escapeHtml(orderData.date)}</div>
  
  <div class="section">
    <div class="section-title">📋 Fournisseur</div>
    <div class="info-block">
      <span class="info-label">Société:</span>
      <span class="info-value"><strong>${escapeHtml(orderData.company.nom)}</strong></span>
    </div>
    <div class="info-block">
      <span class="info-label">Directeur:</span>
      <span class="info-value">${escapeHtml(orderData.company.directeur)}</span>
    </div>
    <div class="info-block">
      <span class="info-label">Adresse:</span>
      <span class="info-value">${escapeHtml(orderData.company.adresse)}</span>
    </div>
    <div class="info-block">
      <span class="info-label">Code Postal:</span>
      <span class="info-value">${escapeHtml(orderData.company.codePostal)}</span>
    </div>
    <div class="info-block">
      <span class="info-label">Téléphone:</span>
      <span class="info-value">${escapeHtml(orderData.company.telephone)}</span>
    </div>
    <div class="info-block">
      <span class="info-label">Email:</span>
      <span class="info-value">${escapeHtml(orderData.company.email)}</span>
    </div>
    <div class="info-block">
      <span class="info-label">N° TVA:</span>
      <span class="info-value">${escapeHtml(orderData.company.tva)}</span>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">👤 Client</div>
    <div class="info-block">
      <span class="info-label">Nom:</span>
      <span class="info-value"><strong>${escapeHtml(orderData.client.nom)}</strong></span>
    </div>
    <div class="info-block">
      <span class="info-label">Entreprise:</span>
      <span class="info-value">${escapeHtml(orderData.client.entreprise)}</span>
    </div>
    <div class="info-block">
      <span class="info-label">Adresse:</span>
      <span class="info-value">${escapeHtml(orderData.client.adresse)}</span>
    </div>
    <div class="info-block">
      <span class="info-label">Code Postal:</span>
      <span class="info-value">${escapeHtml(orderData.client.codePostal)}</span>
    </div>
    <div class="info-block">
      <span class="info-label">Téléphone:</span>
      <span class="info-value">${escapeHtml(orderData.client.telephone)}</span>
    </div>
    <div class="info-block">
      <span class="info-label">Email:</span>
      <span class="info-value">${escapeHtml(orderData.client.email)}</span>
    </div>
  </div>
  
  <div class="section" style="background-color: #ffffff;">
    <div class="section-title">📦 Produits Commandés</div>
    <table>
      <thead>
        <tr>
          <th>Produit</th>
          <th>Taille</th>
          <th>Quantité</th>
          <th>Prix Unitaire</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${productsRows}
      </tbody>
    </table>
    
    <div class="totals">
      <div class="totals-row">
        <span class="totals-label">Sous-total HTVA:</span>
        <span class="totals-value">€${orderData.subtotal.toFixed(2)}</span>
      </div>
      <div class="totals-row">
        <span class="totals-label">TVA (21%):</span>
        <span class="totals-value">€${orderData.vat.toFixed(2)}</span>
      </div>
      <div class="totals-row total-final">
        <span class="totals-label">TOTAL TTC:</span>
        <span class="totals-value">€${orderData.total.toFixed(2)}</span>
      </div>
    </div>
  </div>
  
  <div class="payment-info">
    <div class="payment-info-title">💳 Informations de Paiement</div>
    <div class="payment-item">
      <strong>Mode de paiement:</strong> Virement bancaire
    </div>
    <div class="payment-item">
      <strong>Frais de livraison:</strong> Gratuits pour toute commande supérieure à €350
    </div>
  </div>
  
  <div class="footer">
    <p>Merci pour votre confiance !</p>
    <p style="margin-top: 10px; font-size: 11px;">Pour imprimer ce document en PDF, utilisez Ctrl+P (ou Cmd+P sur Mac) et sélectionnez "Enregistrer au format PDF"</p>
  </div>
</body>
</html>`;
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

    const htmlContent = generateDetailedPDF(orderData);
    
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