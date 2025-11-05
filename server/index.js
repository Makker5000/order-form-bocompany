import express from "express";
import nodemailer from "nodemailer";
import bodyParser from "body-parser";
// import GMAIL_PASSWORD from ".env";

const app = express();
app.use(bodyParser.json());

// ======== Config entreprise ========
// const COMPANY_NAME = "BO Company SRL";
// const COMPANY_EMAIL = "brudetilleux@gmail.com"; // ton email (ou pro plus tard)
// const COMPANY_LOGO = "/order-form-bocompany/src/assets/Logo-BoLights.jpg"; // lien logo si tu veux
// const GMAIL_USER = "brudetilleux@gmail.com"; // ton Gmail pour tests
// const GMAIL_PASS = GMAIL_PASSWORD; // mot de passe app (voir explication)
// const PORT = process.env.PORT || 3000;

const COMPANY_NAME = process.env.COMPANY_NAME;
const COMPANY_EMAIL = process.env.COMPANY_EMAIL; // ton email (ou pro plus tard)
const COMPANY_LOGO = "/order-form-bocompany/src/assets/Logo-BoLights.jpg"; // lien logo si tu veux
const GMAIL_USER = process.env.GMAIL_USER; // ton Gmail pour tests
const GMAIL_PASS = process.env.GMAIL_PASS; // mot de passe app (voir explication)
const PORT = process.env.PORT || 3000;

// export const COMPANY_INFO = {
//   nom: "BO Company SRL",
//   directeur: "Levecq Boris",
//   adresse: "Rue de Courcelles 14",
//   codePostal: "6230 Pont-A-Celles - Belgique",
//   telephone: "+32 495 74 64 90",
//   // email: "info@bolights.com",
//   email: "brudetilleux@gmail.com",
//   tva: "BE1022778985",
// };

// ======== Création du transporteur ========
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
});

// ======== Route d’envoi du mail ========
app.post("/send-order", async (req, res) => {
  try {
    const orderData = req.body;
    const { client, company, total, date } = orderData;

    // Génère le HTML de ta commande (reprend ton code existant)
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; border:1px solid #ddd; padding:20px; border-radius:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h2 style="color:#333;">${COMPANY_NAME}</h2>
          <img src="${COMPANY_LOGO}" width="80"/>
        </div>
        <hr/>
        <p>Bonjour ${client.nom},</p>
        <p>Nous avons bien reçu votre commande d’un montant de <strong>€${total.toFixed(2)}</strong>.</p>
        <p>Merci pour votre confiance !</p>
      </div>
    `;

    const filename = `commande-${client.nom.replace(/\s+/g, '-')}-${date}.html`;
    const encodedAttachment = Buffer.from(htmlContent).toString("base64");

    const mailOptions = {
      from: `"${COMPANY_NAME}" <${COMPANY_EMAIL}>`,
      to: `${client.email}, ${company.email}`,
      subject: `Confirmation de commande - ${client.nom}`,
      html: htmlContent,
      attachments: [
        {
          filename,
          content: encodedAttachment,
          encoding: "base64",
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "Email envoyé avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de l’envoi :", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l’envoi du mail",
      error: error.message,
    });
  }
});

// ======== Démarrage du serveur ========
app.listen(PORT, () => console.log(`✅ Serveur prêt sur le port ${PORT}`));
