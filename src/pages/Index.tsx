import { useState, useEffect } from "react";
import { OrderFormHeader } from "@/components/OrderFormHeader";
import { CompanySection } from "@/components/CompanySection";
import { ClientSection } from "@/components/ClientSection";
import { ProductTable } from "@/components/ProductTable";
import { OrderSummary } from "@/components/OrderSummary";
import { AccessCodeDialog } from "@/components/AccessCodeDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ClientInfo, OrderItem } from "@/types/order";
import { PRODUCTS, VAT_RATE, COMPANY_INFO } from "@/data/products";
import { supabase } from "@/integrations/supabase/client";
import { isTokenExpired, clearAccessSession } from "@/lib/tokenUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Index = () => {
  const [hasAccess, setHasAccess] = useState(false);
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const [client, setClient] = useState<ClientInfo>({
    nom: "",
    entreprise: "",
    adresse: "",
    codePostal: "",
    telephone: "",
    email: "",
  });

  const [items, setItems] = useState<OrderItem[]>(
    PRODUCTS.map((product) => ({
      productId: product.id,
      productName: product.name,
      size: product.size,
      quantity: 0,
      unitPrice: product.unitPrice,
      total: 0,
    }))
  );

  useEffect(() => {
    const accessGranted = sessionStorage.getItem('access_granted');
    const accessToken = sessionStorage.getItem('access_token');
    
    if (accessGranted === 'true' && accessToken) {
      // Check if token is expired
      if (isTokenExpired(accessToken)) {
        clearAccessSession();
        toast({
          title: "Session expirée",
          description: "Veuillez entrer un nouveau code d'accès.",
          variant: "destructive",
        });
        setHasAccess(false);
      } else {
        setHasAccess(true);
      }
    }
  }, [toast]);

  const handleClientChange = (field: keyof ClientInfo, value: string) => {
    setClient((prev) => ({ ...prev, [field]: value }));
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    if (quantity < 0) quantity = 0;
    if (quantity > 100) quantity = 100;

    setItems((prev) => {
      const newItems = [...prev];
      newItems[index] = {
        ...newItems[index],
        quantity,
        total: quantity * newItems[index].unitPrice,
      };
      return newItems;
    });
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  const validateForm = () => {
    if (!client.nom || !client.entreprise || !client.adresse || 
        !client.codePostal || !client.telephone || !client.email) {
      toast({
        title: "Formulaire incomplet",
        description: "Veuillez remplir tous les champs obligatoires du client.",
        variant: "destructive",
      });
      return false;
    }

    const hasItems = items.some((item) => item.quantity > 0);
    if (!hasItems) {
      toast({
        title: "Commande vide",
        description: "Veuillez ajouter au moins un article à votre commande.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setShowConfirmDialog(true);
  };

  const confirmSubmit = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);

    try {
      const date = new Date().toLocaleDateString('fr-FR');
      const accessToken = sessionStorage.getItem('access_token');
      
      if (!accessToken) {
        throw new Error("Session expirée. Veuillez recharger la page et entrer à nouveau le code d'accès.");
      }

      // Check if token is expired before submitting
      if (isTokenExpired(accessToken)) {
        clearAccessSession();
        setHasAccess(false);
        throw new Error("Votre session a expiré. Veuillez entrer un nouveau code d'accès.");
      }

      const orderData = {
        date,
        company: COMPANY_INFO,
        client,
        items,
        subtotal,
        accessToken,
      };

      const { data, error } = await supabase.functions.invoke('send-order', {
        body: orderData,
      });

      if (error) {
        throw new Error(error.message || "Erreur serveur inconnue");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Erreur lors de l'envoi de la commande");
      }

      toast({
        title: "✅ Commande envoyée",
        description: "Votre commande a été envoyée avec succès!",
      });

      setIsSubmitting(false);
      
      // Rediriger vers la page de confirmation
      setTimeout(() => {
        window.location.href = '/confirmation';
      }, 1500);
    } catch (error: any) {
      toast({
        title: "❌ Une erreur est survenue",
        description: error.message || "Impossible d'envoyer le bon de commande. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AccessCodeDialog 
        open={!hasAccess} 
        onValidated={() => setHasAccess(true)} 
      />
      
      <div className="min-h-screen bg-background py-8 px-4 animate-fade-in">
        <div className="max-w-7xl mx-auto">
          <div className="bg-card rounded-2xl shadow-elevated p-8">
            <OrderFormHeader />

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <CompanySection />
            <ClientSection
              client={client}
              onChange={handleClientChange}
              disabled={isLocked}
            />
          </div>

          <div className="mb-8">
            <ProductTable
              items={items}
              onQuantityChange={handleQuantityChange}
              disabled={isLocked}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div></div>
            <OrderSummary subtotal={subtotal} />
          </div>

          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting || isLocked}
              className="px-12 py-6 text-lg font-semibold rounded-2xl shadow-elevated hover:shadow-lg transition-all"
            >
              {isSubmitting ? "Envoi en cours..." : "Envoyer la commande"}
            </Button>
          </div>
          </div>
        </div>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'envoi</AlertDialogTitle>
            <AlertDialogDescription>
              Souhaitez-vous envoyer ce bon de commande ?
              <br />
              <br />
              Un email sera envoyé à <strong>{client.email}</strong> et à l'entreprise avec le
              formulaire en pièce jointe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit}>
              Confirmer l'envoi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default Index;
