export interface Product {
  id: string;
  name: string;
  size: string;
  unitPrice: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CompanyInfo {
  nom: string;
  directeur: string;
  adresse: string;
  codePostal: string;
  telephone: string;
  email: string;
  tva: string;
}

export interface ClientInfo {
  nom: string;
  entreprise: string;
  adresse: string;
  codePostal: string;
  telephone: string;
  email: string;
}

export interface OrderFormData {
  date: string;
  company: CompanyInfo;
  client: ClientInfo;
  items: OrderItem[];
  subtotal: number;
  vat: number;
  total: number;
}
