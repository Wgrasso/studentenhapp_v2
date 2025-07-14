-- Meal Requests Database Setup
-- Run this in your Supabase SQL editor to add meal request functionality

-- ============================================
-- 1. MEAL REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.meal_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    requested_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_options INTEGER DEFAULT 40,
    UNIQUE(group_id, status) DEFERRABLE INITIALLY DEFERRED -- Only one active request per group
);

-- ============================================
-- 2. MEAL REQUEST OPTIONS TABLE (20 meals per request for better performance)
-- ============================================
CREATE TABLE IF NOT EXISTS public.meal_request_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID REFERENCES public.meal_requests(id) ON DELETE CASCADE NOT NULL,
    meal_id INTEGER NOT NULL, -- Tasty API meal ID
    meal_data JSONB NOT NULL, -- Full meal data from Tasty API
    option_order INTEGER NOT NULL, -- 1-20 order of meals (reduced for performance)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(request_id, meal_id), -- Prevent duplicate meals in same request
    UNIQUE(request_id, option_order) -- Ensure order is unique
);

-- ============================================
-- 3. MEAL VOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.meal_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID REFERENCES public.meal_requests(id) ON DELETE CASCADE NOT NULL,
    meal_option_id UUID REFERENCES public.meal_request_options(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(request_id, meal_option_id, user_id) -- One vote per user per meal
);

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.meal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_request_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_votes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES FOR MEAL_REQUESTS
-- ============================================

-- Users can view meal requests for groups they're in
CREATE POLICY "Users can view meal requests for their groups" ON public.meal_requests
    FOR SELECT 
    USING (
        group_id IN (
            SELECT gm.group_id FROM public.group_members gm 
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
        )
    );

-- Users can create meal requests for groups they're in
CREATE POLICY "Users can create meal requests for their groups" ON public.meal_requests
    FOR INSERT 
    WITH CHECK (
        auth.uid() = requested_by 
        AND group_id IN (
            SELECT gm.group_id FROM public.group_members gm 
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
        )
    );

-- Users can update meal requests they created
CREATE POLICY "Users can update their meal requests" ON public.meal_requests
    FOR UPDATE 
    USING (auth.uid() = requested_by)
    WITH CHECK (auth.uid() = requested_by);

-- ============================================
-- 6. RLS POLICIES FOR MEAL_REQUEST_OPTIONS
-- ============================================

-- Users can view meal options for requests in their groups
CREATE POLICY "Users can view meal options for their group requests" ON public.meal_request_options
    FOR SELECT 
    USING (
        request_id IN (
            SELECT mr.id FROM public.meal_requests mr
            JOIN public.group_members gm ON mr.group_id = gm.group_id
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
        )
    );

-- Users can insert meal options for their own meal requests
CREATE POLICY "Users can insert meal options for their requests" ON public.meal_request_options
    FOR INSERT 
    WITH CHECK (
        request_id IN (
            SELECT mr.id FROM public.meal_requests mr
            JOIN public.group_members gm ON mr.group_id = gm.group_id
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
            AND mr.requested_by = auth.uid()
        )
    );

-- ============================================
-- 7. RLS POLICIES FOR MEAL_VOTES
-- ============================================

-- Users can view votes for requests in their groups
CREATE POLICY "Users can view votes for their group requests" ON public.meal_votes
    FOR SELECT 
    USING (
        request_id IN (
            SELECT mr.id FROM public.meal_requests mr
            JOIN public.group_members gm ON mr.group_id = gm.group_id
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
        )
    );

-- Users can insert their own votes
CREATE POLICY "Users can vote on meal options" ON public.meal_votes
    FOR INSERT 
    WITH CHECK (
        auth.uid() = user_id 
        AND request_id IN (
            SELECT mr.id FROM public.meal_requests mr
            JOIN public.group_members gm ON mr.group_id = gm.group_id
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
        )
    );

-- Users can update their own votes
CREATE POLICY "Users can update their votes" ON public.meal_votes
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete their votes" ON public.meal_votes
    FOR DELETE 
    USING (auth.uid() = user_id);

-- ============================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_meal_requests_group_id ON public.meal_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_meal_requests_status ON public.meal_requests(status);
CREATE INDEX IF NOT EXISTS idx_meal_request_options_request_id ON public.meal_request_options(request_id);
CREATE INDEX IF NOT EXISTS idx_meal_request_options_meal_id ON public.meal_request_options(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_votes_request_id ON public.meal_votes(request_id);
CREATE INDEX IF NOT EXISTS idx_meal_votes_user_id ON public.meal_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_votes_meal_option_id ON public.meal_votes(meal_option_id);

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Function to get active meal request for a group
CREATE OR REPLACE FUNCTION get_active_meal_request(group_uuid UUID)
RETURNS TABLE (
    request_id UUID,
    requested_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    total_options INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mr.id as request_id,
        mr.requested_by,
        mr.created_at,
        mr.total_options
    FROM public.meal_requests mr
    WHERE mr.group_id = group_uuid 
    AND mr.status = 'active'
    LIMIT 1;
END;
$$;

-- Function to get meal voting results
CREATE OR REPLACE FUNCTION get_meal_voting_results(request_uuid UUID)
RETURNS TABLE (
    meal_option_id UUID,
    meal_data JSONB,
    yes_votes BIGINT,
    no_votes BIGINT,
    total_votes BIGINT,
    yes_percentage NUMERIC,
    no_percentage NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH vote_counts AS (
        SELECT 
            mro.id as meal_option_id,
            mro.meal_data,
            COUNT(CASE WHEN mv.vote = 'yes' THEN 1 END) as yes_votes,
            COUNT(CASE WHEN mv.vote = 'no' THEN 1 END) as no_votes,
            COUNT(mv.vote) as total_votes
        FROM public.meal_request_options mro
        LEFT JOIN public.meal_votes mv ON mro.id = mv.meal_option_id
        WHERE mro.request_id = request_uuid
        GROUP BY mro.id, mro.meal_data
    )
    SELECT 
        vc.meal_option_id,
        vc.meal_data,
        vc.yes_votes,
        vc.no_votes,
        vc.total_votes,
        CASE 
            WHEN vc.total_votes > 0 THEN ROUND((vc.yes_votes::NUMERIC / vc.total_votes::NUMERIC) * 100, 1)
            ELSE 0
        END as yes_percentage,
        CASE 
            WHEN vc.total_votes > 0 THEN ROUND((vc.no_votes::NUMERIC / vc.total_votes::NUMERIC) * 100, 1)
            ELSE 0
        END as no_percentage
    FROM vote_counts vc
    ORDER BY vc.yes_votes DESC, vc.total_votes DESC;
END;
$$;

-- Function to get top 3 voted meals
CREATE OR REPLACE FUNCTION get_top_voted_meals(request_uuid UUID)
RETURNS TABLE (
    meal_option_id UUID,
    meal_data JSONB,
    yes_votes BIGINT,
    no_votes BIGINT,
    total_votes BIGINT,
    yes_percentage NUMERIC,
    no_percentage NUMERIC,
    not_voted_percentage NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_group_members INTEGER;
BEGIN
    -- Get total number of group members
    SELECT COUNT(*) INTO total_group_members
    FROM public.group_members gm
    JOIN public.meal_requests mr ON gm.group_id = mr.group_id
    WHERE mr.id = request_uuid AND gm.is_active = true;
    
    RETURN QUERY
    WITH vote_counts AS (
        SELECT 
            mro.id as meal_option_id,
            mro.meal_data,
            COUNT(CASE WHEN mv.vote = 'yes' THEN 1 END) as yes_votes,
            COUNT(CASE WHEN mv.vote = 'no' THEN 1 END) as no_votes,
            COUNT(mv.vote) as total_votes
        FROM public.meal_request_options mro
        LEFT JOIN public.meal_votes mv ON mro.id = mv.meal_option_id
        WHERE mro.request_id = request_uuid
        GROUP BY mro.id, mro.meal_data
    )
    SELECT 
        vc.meal_option_id,
        vc.meal_data,
        vc.yes_votes,
        vc.no_votes,
        vc.total_votes,
        CASE 
            WHEN total_group_members > 0 THEN ROUND((vc.yes_votes::NUMERIC / total_group_members::NUMERIC) * 100, 1)
            ELSE 0
        END as yes_percentage,
        CASE 
            WHEN total_group_members > 0 THEN ROUND((vc.no_votes::NUMERIC / total_group_members::NUMERIC) * 100, 1)
            ELSE 0
        END as no_percentage,
        CASE 
            WHEN total_group_members > 0 THEN ROUND(((total_group_members - vc.total_votes)::NUMERIC / total_group_members::NUMERIC) * 100, 1)
            ELSE 0
        END as not_voted_percentage
    FROM vote_counts vc
    ORDER BY vc.yes_votes DESC, vc.total_votes DESC
    LIMIT 3;
END;
$$; 