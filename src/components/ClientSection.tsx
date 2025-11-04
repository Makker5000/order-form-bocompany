import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientInfo } from "@/types/order";

interface ClientSectionProps {
  client: ClientInfo;
  onChange: (field: keyof ClientInfo, value: string) => void;
  disabled: boolean;
}

export const ClientSection = ({ client, onChange, disabled }: ClientSectionProps) => {
  return (
    <Card className="p-6 shadow-card">
      <h2 className="text-xl font-semibold mb-4 text-primary">Destinataire</h2>
      <div className="space-y-4">
        <div>
          <Label htmlFor="client-nom">Nom *</Label>
          <Input
            id="client-nom"
            value={client.nom}
            onChange={(e) => onChange("nom", e.target.value)}
            disabled={disabled}
            className="bg-yellow-50 disabled:bg-muted"
            required
          />
        </div>
        <div>
          <Label htmlFor="client-entreprise">Entreprise *</Label>
          <Input
            id="client-entreprise"
            value={client.entreprise}
            onChange={(e) => onChange("entreprise", e.target.value)}
            disabled={disabled}
            className="bg-yellow-50 disabled:bg-muted"
            required
          />
        </div>
        <div>
          <Label htmlFor="client-adresse">Adresse et numéro *</Label>
          <Input
            id="client-adresse"
            value={client.adresse}
            onChange={(e) => onChange("adresse", e.target.value)}
            disabled={disabled}
            className="bg-yellow-50 disabled:bg-muted"
            required
          />
        </div>
        <div>
          <Label htmlFor="client-codePostal">Code postal + ville + pays *</Label>
          <Input
            id="client-codePostal"
            value={client.codePostal}
            onChange={(e) => onChange("codePostal", e.target.value)}
            disabled={disabled}
            className="bg-yellow-50 disabled:bg-muted"
            required
          />
        </div>
        <div>
          <Label htmlFor="client-telephone">Numéro de téléphone *</Label>
          <Input
            id="client-telephone"
            type="tel"
            value={client.telephone}
            onChange={(e) => onChange("telephone", e.target.value)}
            disabled={disabled}
            className="bg-yellow-50 disabled:bg-muted"
            required
          />
        </div>
        <div>
          <Label htmlFor="client-email">Adresse Email *</Label>
          <Input
            id="client-email"
            type="email"
            value={client.email}
            onChange={(e) => onChange("email", e.target.value)}
            disabled={disabled}
            className="bg-yellow-50 disabled:bg-muted"
            required
          />
        </div>
      </div>
    </Card>
  );
};
