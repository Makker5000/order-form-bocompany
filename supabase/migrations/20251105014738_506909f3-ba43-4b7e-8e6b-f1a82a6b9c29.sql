-- Create table for access codes
CREATE TABLE public.access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE,
  is_used BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

-- Allow public to validate codes (read only when checking)
CREATE POLICY "Anyone can validate codes"
ON public.access_codes
FOR SELECT
USING (true);

-- Only allow inserting via edge function (no public insert)
CREATE POLICY "No public insert"
ON public.access_codes
FOR INSERT
WITH CHECK (false);