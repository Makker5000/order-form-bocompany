import logo from "@/assets/logo.png";

export const OrderFormHeader = () => {
  return (
    <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-primary/20">
      <div>
        <h1 className="text-4xl font-bold text-primary mb-2">
          Formulaire de Commande
        </h1>
        <p className="text-sm text-muted-foreground">
          Date: {new Date().toLocaleDateString("fr-FR")}
        </p>
      </div>
      <div className="flex-shrink-0">
        <img 
          src={logo} 
          alt="BoLights Logo" 
          className="h-20 w-20 object-contain"
        />
      </div>
    </div>
  );
};
