import { COMPANY_INFO } from "@/data/products";
import { Card } from "@/components/ui/card";

export const CompanySection = () => {
  return (
    <Card className="p-6 bg-gradient-header text-white shadow-elevated">
      <h2 className="text-xl font-semibold mb-4">Fournisseur</h2>
      <div className="space-y-2 text-sm">
        <p className="font-semibold text-lg">{COMPANY_INFO.nom}</p>
        <p>{COMPANY_INFO.directeur}</p>
        <p>{COMPANY_INFO.adresse}</p>
        <p>{COMPANY_INFO.codePostal}</p>
        <p>Tél: {COMPANY_INFO.telephone}</p>
        <p>Email: {COMPANY_INFO.email}</p>
        <p>TVA: {COMPANY_INFO.tva}</p>
      </div>
    </Card>
  );
};
