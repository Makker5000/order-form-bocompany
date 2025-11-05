import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

interface OrderItem {
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface OrderData {
  date: string;
  company: {
    nom: string;
    directeur: string;
    adresse: string;
    codePostal: string;
    telephone: string;
    email: string;
    tva: string;
  };
  client: {
    nom: string;
    entreprise: string;
    adresse: string;
    codePostal: string;
    telephone: string;
    email: string;
  };
  items: OrderItem[];
  subtotal: number;
  vat: number;
  total: number;
}

const generatePDFHTML = (orderData: OrderData): string => {
  const productsRows = orderData.items
    .filter(item => item.quantity > 0)
    .map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.productName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.size}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">€${item.total.toFixed(2)}</td>
      </tr>
    `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body { font-family: Arial, sans-serif; padding: 40px; color: #333; } .header { text-align: center; margin-bottom: 30px; } .title { font-size: 24px; font-weight: bold; color: #1e3a8a; margin-bottom: 20px; } .date { text-align: right; margin-bottom: 20px; } .section { margin-bottom: 30px; } .section-title { font-size: 14px; font-weight: bold; color: #1e3a8a; margin-bottom: 10px; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; } .info-block { margin-bottom: 5px; font-size: 12px; } table { width: 100%; border-collapse: collapse; margin-top: 10px; } th { background-color: #1e3a8a; color: white; padding: 10px; text-align: left; font-size: 12px; } td { font-size: 11px; } .totals { margin-top: 20px; } .totals-row { display: flex; justify-content: flex-end; margin-bottom: 8px; font-size: 13px; } .totals-label { margin-right: 20px; font-weight: bold; } .totals-value { min-width: 100px; text-align: right; } .total-final { font-size: 16px; color: #1e3a8a; font-weight: bold; border-top: 2px solid #1e3a8a; padding-top: 10px; } .payment-info { margin-top: 30px; padding: 15px; background-color: #f3f4f6; border-radius: 5px; font-size: 11px; }</style></head><body><div class="header"><div class="title">FORMULAIRE DE COMMANDE</div></div><div class="date">Date: ${orderData.date}</div><div class="section"><div class="section-title">FOURNISSEUR</div><div class="info-block"><strong>${orderData.company.nom}</strong></div><div class="info-block">${orderData.company.directeur}</div><div class="info-block">${orderData.company.adresse}</div><div class="info-block">${orderData.company.codePostal}</div><div class="info-block">Tél: ${orderData.company.telephone}</div><div class="info-block">Email: ${orderData.company.email}</div><div class="info-block">TVA: ${orderData.company.tva}</div></div><div class="section"><div class="section-title">CLIENT</div><div class="info-block">Nom: ${orderData.client.nom}</div><div class="info-block">Entreprise: ${orderData.client.entreprise}</div><div class="info-block">Adresse: ${orderData.client.adresse}</div><div class="info-block">Code Postal: ${orderData.client.codePostal}</div><div class="info-block">Téléphone: ${orderData.client.telephone}</div><div class="info-block">Email: ${orderData.client.email}</div></div><div class="section"><div class="section-title">PRODUITS COMMANDÉS</div><table><thead><tr><th>Produit</th><th>Taille</th><th style="text-align: center;">Quantité</th><th style="text-align: right;">Prix Unit.</th><th style="text-align: right;">Total</th></tr></thead><tbody>${productsRows}</tbody></table><div class="totals"><div class="totals-row"><span class="totals-label">Sous-total HTVA:</span><span class="totals-value">€${orderData.subtotal.toFixed(2)}</span></div><div class="totals-row"><span class="totals-label">TVA (21%):</span><span class="totals-value">€${orderData.vat.toFixed(2)}</span></div><div class="totals-row total-final"><span class="totals-label">TOTAL TTC:</span><span class="totals-value">€${orderData.total.toFixed(2)}</span></div></div></div><div class="payment-info"><div><strong>Mode de paiement:</strong> Virement bancaire</div><div><strong>Frais de livraison:</strong> Gratuits pour toute commande supérieure à €350</div></div></body></html>`;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received order request");
    const orderData: OrderData = await req.json();
    
    console.log("Generating PDF HTML...");
    const htmlContent = generatePDFHTML(orderData);
    
    console.log("Sending emails via Gmail SMTP...");
    
    // Email au client - simple text version
    await client.send({
      from: `${orderData.company.nom} <${Deno.env.get("GMAIL_USER")}>`,
      to: orderData.client.email,
      subject: `Formulaire de commande - ${orderData.client.nom}`,
      content: "text/html",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #1e3a8a;">Confirmation de votre commande</h2><p>Bonjour ${orderData.client.nom},</p><p>Nous avons bien reçu votre commande d'un montant de <strong>€${orderData.total.toFixed(2)}</strong>.</p><p>Vous trouverez ci-dessous le détail de votre commande.</p><p>Nous vous remercions de votre confiance.</p><br>${htmlContent}<br><p>Cordialement,<br><strong>${orderData.company.nom}</strong></p></div>`,
    });
    
    console.log("Client email sent");
    
    // Email à l'entreprise
    await client.send({
      from: `${orderData.company.nom} <${Deno.env.get("GMAIL_USER")}>`,
      to: orderData.company.email,
      subject: `Nouvelle commande - ${orderData.client.nom}`,
      content: "text/html",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #1e3a8a;">Nouvelle commande reçue</h2><p><strong>Client:</strong> ${orderData.client.nom}</p><p><strong>Entreprise:</strong> ${orderData.client.entreprise}</p><p><strong>Email:</strong> ${orderData.client.email}</p><p><strong>Téléphone:</strong> ${orderData.client.telephone}</p><p><strong>Montant total:</strong> €${orderData.total.toFixed(2)}</p><hr>${htmlContent}</div>`,
    });
    
    console.log("Company email sent");
    
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
