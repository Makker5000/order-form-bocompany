import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OrderItem } from "@/types/order";
import { PRODUCTS } from "@/data/products";

interface ProductTableProps {
  items: OrderItem[];
  onQuantityChange: (index: number, quantity: number) => void;
  disabled: boolean;
}

export const ProductTable = ({ items, onQuantityChange, disabled }: ProductTableProps) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-BE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  return (
    <Card className="p-6 shadow-card overflow-x-auto">
      <h2 className="text-xl font-semibold mb-4 text-primary">Articles commandés</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-primary/20">
            <th className="text-left py-3 px-2 font-semibold text-foreground">Nom Article</th>
            <th className="text-left py-3 px-2 font-semibold text-foreground">Taille</th>
            <th className="text-center py-3 px-2 font-semibold text-foreground">Quantité</th>
            <th className="text-right py-3 px-2 font-semibold text-foreground">Prix unitaire</th>
            <th className="text-right py-3 px-2 font-semibold text-foreground">Prix total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.productId} className="border-b border-border hover:bg-muted/30 transition-colors">
              <td className="py-3 px-2">{item.productName}</td>
              <td className="py-3 px-2">{item.size}</td>
              <td className="py-3 px-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={item.quantity}
                  onChange={(e) => onQuantityChange(index, parseInt(e.target.value) || 0)}
                  disabled={disabled}
                  className="w-20 mx-auto text-center bg-yellow-50 disabled:bg-muted"
                />
              </td>
              <td className="py-3 px-2 text-right">{formatPrice(item.unitPrice)}</td>
              <td className="py-3 px-2 text-right font-semibold">{formatPrice(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};
