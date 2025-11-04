import { Card } from "@/components/ui/card";
import { FREE_DELIVERY_THRESHOLD } from "@/data/products";

interface OrderSummaryProps {
  subtotal: number;
  vat: number;
  total: number;
}

export const OrderSummary = ({ subtotal, vat, total }: OrderSummaryProps) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-BE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const isFreeDelivery = subtotal >= FREE_DELIVERY_THRESHOLD;

  return (
    <Card className="p-6 shadow-card">
      <div className="space-y-4">
        <div className="flex justify-between items-center text-lg">
          <span className="text-muted-foreground">Sous-total HTVA:</span>
          <span className="font-semibold">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between items-center text-lg">
          <span className="text-muted-foreground">TVA (21%):</span>
          <span className="font-semibold">{formatPrice(vat)}</span>
        </div>
        <div className="h-px bg-border my-2"></div>
        <div className="flex justify-between items-center text-2xl">
          <span className="font-bold text-primary">Total TTC:</span>
          <span className="font-bold text-primary">{formatPrice(total)}</span>
        </div>
        {isFreeDelivery && (
          <div className="text-sm text-success font-medium bg-success/10 p-3 rounded-lg">
            ✓ Livraison offerte!
          </div>
        )}
        <p className="text-sm text-muted-foreground italic">
          * Livraison offerte au dessus de {formatPrice(FREE_DELIVERY_THRESHOLD)} d'achat.
        </p>
      </div>
    </Card>
  );
};
