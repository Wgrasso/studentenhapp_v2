-- Dinner Request Responses Database Setup
-- Run this in your Supabase SQL editor after running dinner-requests-setup.sql

-- ============================================
-- 1. DINNER REQUEST RESPONSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.dinner_request_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID REFERENCES public.dinner_requests(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    response TEXT NOT NULL CHECK (response IN ('accepted', 'declined')),
    responded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Only one response per user per request
    UNIQUE(request_id, user_id)
);

-- ============================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.dinner_request_responses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. RLS POLICIES FOR DINNER_REQUEST_RESPONSES
-- ============================================

-- Users can view responses for requests in their groups
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

-- Users can create their own responses
CREATE POLICY "Users can create their own responses" ON public.dinner_request_responses
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own responses
CREATE POLICY "Users can update their own responses" ON public.dinner_request_responses
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own responses
CREATE POLICY "Users can delete their own responses" ON public.dinner_request_responses
    FOR DELETE 
    USING (auth.uid() = user_id);

-- ============================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dinner_request_responses_request_id ON public.dinner_request_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_dinner_request_responses_user_id ON public.dinner_request_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_dinner_request_responses_response ON public.dinner_request_responses(response);

-- ============================================
-- 5. FUNCTION TO GET REQUEST RESPONSES WITH MEMBER DETAILS
-- ============================================
CREATE OR REPLACE FUNCTION get_request_responses_with_members(request_uuid UUID)
RETURNS TABLE (
    request_id UUID,
    user_id UUID,
    response TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    -- Add member count for the group
    total_members BIGINT,
    responses_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        drr.request_id,
        drr.user_id,
        drr.response,
        drr.responded_at,
        -- Count total members in the group
        (SELECT COUNT(*) 
         FROM public.group_members gm2 
         JOIN public.dinner_requests dr2 ON dr2.group_id = gm2.group_id
         WHERE dr2.id = request_uuid AND gm2.is_active = true) as total_members,
        -- Count total responses
        (SELECT COUNT(*) 
         FROM public.dinner_request_responses drr2 
         WHERE drr2.request_id = request_uuid) as responses_count
    FROM public.dinner_request_responses drr
    WHERE drr.request_id = request_uuid
    ORDER BY drr.responded_at DESC;
END;
$$;

-- ============================================
-- 6. FUNCTION TO CHECK IF REQUEST IS READY FOR MEAL CREATION
-- ============================================
CREATE OR REPLACE FUNCTION is_request_ready_for_meal(request_uuid UUID)
RETURNS TABLE (
    is_ready BOOLEAN,
    total_members BIGINT,
    responses_count BIGINT,
    accepted_count BIGINT,
    group_id UUID,
    requester_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_count BIGINT;
    response_count BIGINT;
    accepted_responses BIGINT;
    req_group_id UUID;
    req_user_id UUID;
BEGIN
    -- Get request details
    SELECT dr.group_id, dr.requester_id 
    INTO req_group_id, req_user_id
    FROM public.dinner_requests dr 
    WHERE dr.id = request_uuid;
    
    -- Count total members in group
    SELECT COUNT(*) 
    INTO total_count
    FROM public.group_members gm 
    WHERE gm.group_id = req_group_id AND gm.is_active = true;
    
    -- Count total responses
    SELECT COUNT(*) 
    INTO response_count
    FROM public.dinner_request_responses drr 
    WHERE drr.request_id = request_uuid;
    
    -- Count accepted responses
    SELECT COUNT(*) 
    INTO accepted_responses
    FROM public.dinner_request_responses drr 
    WHERE drr.request_id = request_uuid AND drr.response = 'accepted';
    
    RETURN QUERY
    SELECT 
        -- Ready if we have responses from at least 50% of members and at least 2 people accepted
        (response_count >= (total_count / 2) AND accepted_responses >= 2) as is_ready,
        total_count as total_members,
        response_count as responses_count,
        accepted_responses as accepted_count,
        req_group_id as group_id,
        req_user_id as requester_id;
END;
$$; 