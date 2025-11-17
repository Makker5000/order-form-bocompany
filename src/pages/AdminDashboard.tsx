import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Plus, Trash2, X } from "lucide-react";

interface AccessCode {
  id: string;
  code: string;
  created_at: string;
  used_at: string | null;
  is_used: boolean;
  is_active: boolean;
  expires_at: string | null;
}

const AdminDashboard = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [customCode, setCustomCode] = useState("");
  const [expiresIn, setExpiresIn] = useState("24");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadCodes();
    }
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/admin/login');
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!roleData || roleData.role !== 'admin') {
        toast({
          title: "Accès refusé",
          description: "Vous n'avez pas les droits d'administration",
          variant: "destructive",
        });
        navigate('/admin/login');
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      navigate('/admin/login');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCodes = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-access-codes', {
        body: { action: 'list' }
      });

      if (error) throw error;
      if (data?.codes) {
        setCodes(data.codes);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les codes",
        variant: "destructive",
      });
    }
  };

  const createCode = async (random: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-access-codes', {
        body: { 
          action: 'create',
          customCode: random ? null : customCode,
          expiresIn: parseInt(expiresIn)
        }
      });

      if (error) throw error;

      toast({
        title: "✅ Code créé",
        description: `Code: ${data.code.code}`,
      });

      setCustomCode("");
      loadCodes();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deactivateCode = async (code: string) => {
    try {
      const { error } = await supabase.functions.invoke('manage-access-codes', {
        body: { action: 'deactivate', code }
      });

      if (error) throw error;

      toast({
        title: "✅ Code désactivé",
      });

      loadCodes();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteCode = async (code: string) => {
    try {
      const { error } = await supabase.functions.invoke('manage-access-codes', {
        body: { action: 'delete', code }
      });

      if (error) throw error;

      toast({
        title: "✅ Code supprimé",
      });

      loadCodes();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  const initializeAdmin = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('init-admin');

      if (error) throw error;

      toast({
        title: "✅ Admin initialisé",
        description: data.message,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getCodeStatus = (code: AccessCode) => {
    if (!code.is_active) return { label: "Désactivé", variant: "secondary" as const };
    if (code.is_used) return { label: "Utilisé", variant: "default" as const };
    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      return { label: "Expiré", variant: "destructive" as const };
    }
    return { label: "Actif", variant: "outline" as const };
  };

  const filterCodes = (status: string) => {
    return codes.filter(code => {
      const codeStatus = getCodeStatus(code);
      return codeStatus.label.toLowerCase() === status;
    });
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold">Administration</h1>
            <p className="text-muted-foreground">Gestion des codes d'accès</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Créer un nouveau code</CardTitle>
            <CardDescription>Générer un code aléatoire ou créer un code personnalisé</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customCode">Code personnalisé (optionnel)</Label>
                <Input
                  id="customCode"
                  placeholder="ABCD1234"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  maxLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresIn">Expire dans (heures)</Label>
                <Input
                  id="expiresIn"
                  type="number"
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value)}
                  min="1"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createCode(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Générer aléatoirement
              </Button>
              <Button variant="outline" onClick={() => createCode(false)} disabled={!customCode}>
                <Plus className="mr-2 h-4 w-4" />
                Créer code personnalisé
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liste des codes</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="actif">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="actif">Actifs ({filterCodes('actif').length})</TabsTrigger>
                <TabsTrigger value="utilisé">Utilisés ({filterCodes('utilisé').length})</TabsTrigger>
                <TabsTrigger value="expiré">Expirés ({filterCodes('expiré').length})</TabsTrigger>
                <TabsTrigger value="désactivé">Désactivés ({filterCodes('désactivé').length})</TabsTrigger>
                <TabsTrigger value="paramètres">Paramètres</TabsTrigger>
              </TabsList>

              {['actif', 'utilisé', 'expiré', 'désactivé'].map((status) => (
                <TabsContent key={status} value={status}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Créé le</TableHead>
                        <TableHead>Expire le</TableHead>
                        <TableHead>Utilisé le</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterCodes(status).map((code) => (
                        <TableRow key={code.id}>
                          <TableCell className="font-mono font-bold">{code.code}</TableCell>
                          <TableCell>{new Date(code.created_at).toLocaleString('fr-FR')}</TableCell>
                          <TableCell>
                            {code.expires_at 
                              ? new Date(code.expires_at).toLocaleString('fr-FR')
                              : 'Jamais'}
                          </TableCell>
                          <TableCell>
                            {code.used_at 
                              ? new Date(code.used_at).toLocaleString('fr-FR')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getCodeStatus(code).variant}>
                              {getCodeStatus(code).label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {code.is_active && !code.is_used && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deactivateCode(code.code)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteCode(code.code)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              ))}

              <TabsContent value="paramètres">
                <div className="space-y-4 p-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Configuration Admin</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Initialiser ou mettre à jour les credentials de l'administrateur depuis les secrets configurés dans Cloud → Secrets.
                    </p>
                    <Button onClick={initializeAdmin}>
                      Initialiser/Mettre à jour Admin
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
