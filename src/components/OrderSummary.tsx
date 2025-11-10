import { Card } from "@/components/ui/card";
import { FREE_DELIVERY_THRESHOLD } from "@/data/products";

interface OrderSummaryProps {
  subtotal: number;
}

export const OrderSummary = ({ subtotal }: OrderSummaryProps) => {
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
        <div className="flex justify-between items-center text-2xl">
          <span className="font-bold text-primary">Total HTVA:</span>
          <span className="font-bold text-primary">{formatPrice(subtotal)}</span>
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
