import { Product } from "@/types/order";

export const PRODUCTS: Product[] = [
  // Rampe LED UV 6%
  { id: "uv6-30", name: "Rampe LED UV 6%", size: "30cm", unitPrice: 50.00 },
  { id: "uv6-60", name: "Rampe LED UV 6%", size: "60cm", unitPrice: 80.00 },
  { id: "uv6-90", name: "Rampe LED UV 6%", size: "90cm", unitPrice: 110.00 },
  
  // Rampe LED UV 12%
  { id: "uv12-30", name: "Rampe LED UV 12%", size: "30cm", unitPrice: 50.00 },
  { id: "uv12-60", name: "Rampe LED UV 12%", size: "60cm", unitPrice: 80.00 },
  { id: "uv12-90", name: "Rampe LED UV 12%", size: "90cm", unitPrice: 110.00 },
  
  // Rampe LED UV 14%
  { id: "uv14-30", name: "Rampe LED UV 14%", size: "30cm", unitPrice: 55.00 },
  { id: "uv14-60", name: "Rampe LED UV 14%", size: "60cm", unitPrice: 87.50 },
  { id: "uv14-90", name: "Rampe LED UV 14%", size: "90cm", unitPrice: 120.00 },
  
  // Rampe LED Natural Vision
  { id: "nv-30", name: "Rampe LED Natural Vision", size: "30cm", unitPrice: 19.50 },
  { id: "nv-60", name: "Rampe LED Natural Vision", size: "60cm", unitPrice: 29.50 },
  { id: "nv-90", name: "Rampe LED Natural Vision", size: "90cm", unitPrice: 37.50 },
  { id: "nv-120", name: "Rampe LED Natural Vision", size: "120cm", unitPrice: 44.50 },
  
  // Câble de Connexion
  { id: "cable-30", name: "Câble de Connexion", size: "30cm", unitPrice: 2.00 },
  { id: "cable-120", name: "Câble de Connexion", size: "120cm", unitPrice: 3.50 },
];

export const COMPANY_INFO = {
  nom: "BoLights",
  directeur: "Directeur Général",
  adresse: "Rue de l'Innovation 42",
  codePostal: "1000 Bruxelles, Belgique",
  telephone: "+32 2 123 45 67",
  email: "contact@bolights.be",
  tva: "BE0123.456.789",
};

export const VAT_RATE = 0.21;
export const FREE_DELIVERY_THRESHOLD = 350;
