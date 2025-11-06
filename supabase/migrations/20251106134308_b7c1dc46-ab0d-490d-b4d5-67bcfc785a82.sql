-- Modifier la table access_codes pour ajouter la gestion du cycle de vie
ALTER TABLE public.access_codes 
ADD COLUMN expires_at timestamp with time zone,
ADD COLUMN is_active boolean DEFAULT true NOT NULL;

-- Créer un enum pour les rôles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Créer la table user_roles
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Activer RLS sur user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Créer une fonction sécurisée pour vérifier les rôles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Policy pour permettre aux admins de voir tous les rôles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy pour permettre aux users de voir leur propre rôle
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Mettre à jour les policies de access_codes pour les admins
DROP POLICY IF EXISTS "Anyone can validate codes" ON public.access_codes;
DROP POLICY IF EXISTS "No public insert" ON public.access_codes;

-- Les admins peuvent tout faire
CREATE POLICY "Admins can manage all codes"
ON public.access_codes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tout le monde peut valider les codes (lecture pour validation)
CREATE POLICY "Anyone can validate codes"
ON public.access_codes
FOR SELECT
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Les admins peuvent mettre à jour les codes
CREATE POLICY "Admins can update codes"
ON public.access_codes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));