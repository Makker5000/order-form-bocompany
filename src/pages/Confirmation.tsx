import { CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const Confirmation = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-2xl text-center">
        <CardHeader className="pb-4">
          <div className="flex justify-center mb-6">
            <CheckCircle className="h-24 w-24 text-green-500 animate-in zoom-in duration-500" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Commande envoyée !</h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg text-muted-foreground">
            Votre commande a été envoyée avec succès.
          </p>
          <p className="text-lg">
            Vous avez reçu un mail de confirmation avec un résumé complet.
          </p>
          <div className="pt-6 border-t">
            <p className="text-xl font-medium">
              Bien à vous !<br />
              Merci et à bientôt. 😊
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Confirmation;
