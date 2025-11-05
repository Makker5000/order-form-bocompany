import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AccessCodeDialogProps {
  open: boolean;
  onValidated: () => void;
}

export const AccessCodeDialog = ({ open, onValidated }: AccessCodeDialogProps) => {
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();

  const handleValidate = async () => {
    if (!code.trim()) {
      toast({
        title: "Code requis",
        description: "Veuillez entrer un code d'accès.",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);

    try {
      const { data, error } = await supabase.functions.invoke('validate-access-code', {
        body: { code: code.trim() },
      });

      if (error) {
        console.error('Error validating code:', error);
        throw new Error(error.message || "Erreur lors de la validation");
      }

      if (data?.valid) {
        toast({
          title: "✅ Accès autorisé",
          description: "Code validé avec succès!",
        });
        sessionStorage.setItem('access_granted', 'true');
        onValidated();
      } else {
        toast({
          title: "❌ Code invalide",
          description: data?.message || "Le code est invalide ou a déjà été utilisé.",
          variant: "destructive",
        });
        setCode("");
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "❌ Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleValidate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Code d'accès requis</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Veuillez entrer le code d'accès à usage unique pour accéder au formulaire de commande.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            placeholder="Entrez le code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            disabled={isValidating}
            className="text-center text-xl tracking-widest font-mono uppercase"
            maxLength={8}
          />
          <Button
            onClick={handleValidate}
            disabled={isValidating}
            className="w-full"
            size="lg"
          >
            {isValidating ? "Validation..." : "Valider"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
