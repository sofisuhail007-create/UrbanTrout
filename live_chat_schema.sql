-- ====================================================================
-- URBAN TROUT - LIVE CHAT BRIDGE SCHEMA
-- Stores customer chat sessions and messages with Realtime enabled
-- ====================================================================

-- 1. Create live_chat_threads table
CREATE TABLE IF NOT EXISTS public.live_chat_threads (
  id TEXT PRIMARY KEY,
  customer_name TEXT DEFAULT 'Visitor',
  customer_phone TEXT,
  customer_locality TEXT,
  telegram_message_id BIGINT,
  telegram_chat_id TEXT,
  status TEXT DEFAULT 'active', -- 'active' | 'closed'
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create live_chat_messages table
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES public.live_chat_threads(id) ON DELETE CASCADE,
  sender TEXT NOT NULL, -- 'customer' | 'staff'
  sender_name TEXT NOT NULL DEFAULT 'Visitor',
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON public.live_chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_telegram_msg ON public.live_chat_threads(telegram_message_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.live_chat_messages(created_at);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE IF EXISTS public.live_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.live_chat_messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Allow select live_chat_threads" ON public.live_chat_threads;
DROP POLICY IF EXISTS "Allow insert live_chat_threads" ON public.live_chat_threads;
DROP POLICY IF EXISTS "Allow update live_chat_threads" ON public.live_chat_threads;

CREATE POLICY "Allow select live_chat_threads" ON public.live_chat_threads FOR SELECT USING (true);
CREATE POLICY "Allow insert live_chat_threads" ON public.live_chat_threads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update live_chat_threads" ON public.live_chat_threads FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select live_chat_messages" ON public.live_chat_messages;
DROP POLICY IF EXISTS "Allow insert live_chat_messages" ON public.live_chat_messages;

CREATE POLICY "Allow select live_chat_messages" ON public.live_chat_messages FOR SELECT USING (true);
CREATE POLICY "Allow insert live_chat_messages" ON public.live_chat_messages FOR INSERT WITH CHECK (true);

-- 6. Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_threads;
