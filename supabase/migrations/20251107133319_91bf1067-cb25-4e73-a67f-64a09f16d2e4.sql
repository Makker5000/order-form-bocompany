-- CRITICAL SECURITY FIX: Remove public access to access_codes
-- Only admins and edge functions (via service role) should access this table

-- Drop the insecure policy that allows anyone to read active codes
DROP POLICY IF EXISTS "Anyone can validate codes" ON access_codes;

-- Keep admin policies for dashboard management
-- The policies "Admins can manage all codes" and "Admins can update codes" remain

-- Note: validate-access-code edge function will continue to work
-- because it uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS