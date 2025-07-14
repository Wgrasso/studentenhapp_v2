-- Simplified Dinner Request Responses Setup
-- Run this instead of the previous complex SQL

-- 1. Create responses table (simplified)
CREATE TABLE IF NOT EXISTS public.dinner_request_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID REFERENCES public.dinner_requests(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    response TEXT NOT NULL CHECK (response IN ('accepted', 'declined')),
    responded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Only one response per user per request
    UNIQUE(request_id, user_id)
);

-- 2. Enable RLS
ALTER TABLE public.dinner_request_responses ENABLE ROW LEVEL SECURITY;

-- 3. Simple RLS policies
CREATE POLICY "Users can view responses for their group requests" ON public.dinner_request_responses
    FOR SELECT 
    USING (
        request_id IN (
            SELECT dr.id 
            FROM public.dinner_requests dr
            WHERE dr.group_id IN (
                SELECT gm.group_id FROM public.group_members gm 
                WHERE gm.user_id = auth.uid() AND gm.is_active = true
            )
        )
    );

CREATE POLICY "Users can create their own responses" ON public.dinner_request_responses
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses" ON public.dinner_request_responses
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_dinner_request_responses_request_id ON public.dinner_request_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_dinner_request_responses_user_id ON public.dinner_request_responses(user_id); 