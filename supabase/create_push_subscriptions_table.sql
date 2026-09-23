-- ====================================================================
-- URBAN TROUT - PWA WEB PUSH SUBSCRIPTIONS SCHEMA
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_phone TEXT,
    customer_email TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used_at TIMESTAMPTZ DEFAULT now()
);

-- Fast lookup indexes for targeted push delivery
CREATE INDEX IF NOT EXISTS idx_push_phone ON public.push_subscriptions(customer_phone);
CREATE INDEX IF NOT EXISTS idx_push_email ON public.push_subscriptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_push_user_id ON public.push_subscriptions(user_id);

-- Enable Row Level Security
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop prior policies if any
DROP POLICY IF EXISTS "Allow public insert subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow public update subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow service role full access to push_subscriptions" ON public.push_subscriptions;

-- Allow client-side subscriptions from PWA
CREATE POLICY "Allow public insert subscriptions" ON public.push_subscriptions 
FOR INSERT TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "Allow public update subscriptions" ON public.push_subscriptions 
FOR UPDATE TO anon, authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow service role full access to push_subscriptions" ON public.push_subscriptions 
FOR ALL TO service_role 
USING (true) 
WITH CHECK (true);
