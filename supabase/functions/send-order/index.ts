import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.173.0/encoding/base64.ts";
import { verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

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

const generatePDF = (orderData: OrderData): string => {
  const doc = new jsPDF();
  let yPos = 20;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(30, 58, 138);
  doc.text("FORMULAIRE DE COMMANDE", 105, yPos, { align: "center" });
  yPos += 10;
  
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text("Bon de commande détaillé", 105, yPos, { align: "center" });
  yPos += 15;

  // Date
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Date: ${orderData.date}`, 195, yPos, { align: "right" });
  yPos += 15;

  // Fournisseur
  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138);
  doc.text("Fournisseur", 15, yPos);
  yPos += 8;
  
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`Société: ${orderData.company.nom}`, 15, yPos);
  yPos += 5;
  doc.text(`Directeur: ${orderData.company.directeur}`, 15, yPos);
  yPos += 5;
  doc.text(`Adresse: ${orderData.company.adresse}`, 15, yPos);
  yPos += 5;
  doc.text(`Code Postal: ${orderData.company.codePostal}`, 15, yPos);
  yPos += 5;
  doc.text(`Téléphone: ${orderData.company.telephone}`, 15, yPos);
  yPos += 5;
  doc.text(`Email: ${orderData.company.email}`, 15, yPos);
  yPos += 5;
  doc.text(`N° TVA: ${orderData.company.tva}`, 15, yPos);
  yPos += 12;

  // Client
  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138);
  doc.text("Client", 15, yPos);
  yPos += 8;
  
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`Nom: ${orderData.client.nom}`, 15, yPos);
  yPos += 5;
  doc.text(`Entreprise: ${orderData.client.entreprise}`, 15, yPos);
  yPos += 5;
  doc.text(`Adresse: ${orderData.client.adresse}`, 15, yPos);
  yPos += 5;
  doc.text(`Code Postal: ${orderData.client.codePostal}`, 15, yPos);
  yPos += 5;
  doc.text(`Téléphone: ${orderData.client.telephone}`, 15, yPos);
  yPos += 5;
  doc.text(`Email: ${orderData.client.email}`, 15, yPos);
  yPos += 12;

  // Produits
  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138);
  doc.text("Produits Commandés", 15, yPos);
  yPos += 8;

  // Table headers
  doc.setFillColor(30, 58, 138);
  doc.rect(15, yPos - 5, 180, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("Produit", 17, yPos);
  doc.text("Taille", 90, yPos);
  doc.text("Qté", 115, yPos);
  doc.text("Prix Unit.", 135, yPos);
  doc.text("Total", 170, yPos);
  yPos += 7;

  // Table rows
  doc.setTextColor(0, 0, 0);
  orderData.items
    .filter(item => item.quantity > 0)
    .forEach((item, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(15, yPos - 4, 180, 6, "F");
      }
      
      doc.text(item.productName.substring(0, 35), 17, yPos);
      doc.text(item.size, 90, yPos);
      doc.text(item.quantity.toString(), 115, yPos);
      doc.text(`€${item.unitPrice.toFixed(2)}`, 135, yPos);
      doc.setFont(undefined, "bold");
      doc.text(`€${item.total.toFixed(2)}`, 170, yPos);
      doc.setFont(undefined, "normal");
      yPos += 6;
    });

  yPos += 10;

  // Total
  doc.setFillColor(249, 250, 251);
  doc.rect(15, yPos - 4, 180, 10, "F");
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 138);
  doc.setFont(undefined, "bold");
  doc.text("TOTAL HTVA:", 120, yPos);
  doc.text(`€${orderData.subtotal.toFixed(2)}`, 170, yPos);
  doc.setFont(undefined, "normal");
  yPos += 15;

  // Payment info
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138);
  doc.text("Informations de Paiement", 15, yPos);
  yPos += 7;
  
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("• Mode de paiement: Virement bancaire", 15, yPos);
  yPos += 5;
  doc.text("• Frais de livraison: Gratuits pour toute commande supérieure à €350", 15, yPos);
  yPos += 15;

  // Footer
  doc.setTextColor(107, 114, 128);
  doc.text("Merci pour votre confiance !", 105, yPos, { align: "center" });

  return doc.output("datauristring").split(",")[1];
};

const generateEmailSummary = (orderData: OrderData): string => {
  const productsRows = orderData.items
    .filter(item => item.quantity > 0)
    .map(item => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px;">${escapeHtml(item.productName)}</td>
        <td style="padding: 12px 8px; text-align: center;">${escapeHtml(item.size)}</td>
        <td style="padding: 12px 8px; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 8px; text-align: right;">€${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 12px 8px; text-align: right; font-weight: bold;">€${item.total.toFixed(2)}</td>
      </tr>
    `).join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #1e3a8a; margin-bottom: 20px;">Résumé de votre commande</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background-color: #1e3a8a; color: white;">
            <th style="padding: 12px 8px; text-align: left;">Produit</th>
            <th style="padding: 12px 8px; text-align: center;">Taille</th>
            <th style="padding: 12px 8px; text-align: center;">Quantité</th>
            <th style="padding: 12px 8px; text-align: right;">Prix Unit.</th>
            <th style="padding: 12px 8px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${productsRows}
        </tbody>
      </table>
      
      <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; color: #1e3a8a;">
          <span>TOTAL HTVA:</span>
          <span>€${orderData.subtotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  `;
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

    const pdfBase64 = generatePDF(orderData);
    const emailSummary = generateEmailSummary(orderData);
    
    // Email to client
    await client.send({
      from: `${escapeHtml(orderData.company.nom)} <${Deno.env.get("GMAIL_USER")}>`,
      to: orderData.client.email,
      subject: `Confirmation de commande - ${escapeHtml(orderData.client.nom)}`,
      content: "text/html",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a8a;">Confirmation de votre commande</h2>
          <p>Bonjour ${escapeHtml(orderData.client.nom)},</p>
          <p>Nous avons bien reçu votre commande d'un montant de <strong>€${orderData.subtotal.toFixed(2)} HTVA</strong>.</p>
          ${emailSummary}
          <p style="margin-top: 20px;">Veuillez trouver votre bon de commande détaillé en pièce jointe au format PDF.</p>
          <p>Nous vous remercions de votre confiance.</p>
          <p>Cordialement,<br><strong>${escapeHtml(orderData.company.nom)}</strong></p>
        </div>
      `,
      attachments: [
        {
          filename: `Commande_${escapeHtml(orderData.client.nom)}_${escapeHtml(orderData.date).replace(/\//g, '-')}.pdf`,
          content: pdfBase64,
          encoding: "base64",
          contentType: "application/pdf",
        },
      ],
    });
    
    // Email to company
    await client.send({
      from: `${escapeHtml(orderData.company.nom)} <${Deno.env.get("GMAIL_USER")}>`,
      to: orderData.company.email,
      subject: `Nouvelle commande - ${escapeHtml(orderData.client.nom)}`,
      content: "text/html",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a8a;">Nouvelle commande reçue</h2>
          <p><strong>Client:</strong> ${escapeHtml(orderData.client.nom)}</p>
          <p><strong>Entreprise:</strong> ${escapeHtml(orderData.client.entreprise)}</p>
          <p><strong>Email:</strong> ${escapeHtml(orderData.client.email)}</p>
          <p><strong>Téléphone:</strong> ${escapeHtml(orderData.client.telephone)}</p>
          <p><strong>Montant total:</strong> €${orderData.subtotal.toFixed(2)} HTVA</p>
          ${emailSummary}
          <p style="margin-top: 20px;">Veuillez trouver le bon de commande en pièce jointe.</p>
        </div>
      `,
      attachments: [
        {
          filename: `Commande_${escapeHtml(orderData.client.nom)}_${escapeHtml(orderData.date).replace(/\//g, '-')}.pdf`,
          content: pdfBase64,
          encoding: "base64",
          contentType: "application/pdf",
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