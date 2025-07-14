-- Dinner Requests Database Setup
-- Run this in your Supabase SQL editor

-- ============================================
-- 1. DINNER REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.dinner_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    requester_name TEXT NOT NULL,
    request_date DATE NOT NULL,
    request_time TIME NOT NULL,
    recipe_type TEXT NOT NULL CHECK (recipe_type IN ('random', 'wishlist', 'swipe')),
    deadline_time TIME NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Only one active request per group (replaces old ones)
    UNIQUE(group_id)
);

-- ============================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.dinner_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. RLS POLICIES FOR DINNER_REQUESTS
-- ============================================

-- Users can view dinner requests for groups they're in
CREATE POLICY "Users can view dinner requests for their groups" ON public.dinner_requests
    FOR SELECT 
    USING (
        group_id IN (
            SELECT gm.group_id FROM public.group_members gm 
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
        )
    );

-- Users can create dinner requests for groups they're in
CREATE POLICY "Users can create dinner requests for their groups" ON public.dinner_requests
    FOR INSERT 
    WITH CHECK (
        auth.uid() = requester_id 
        AND group_id IN (
            SELECT gm.group_id FROM public.group_members gm 
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
        )
    );

-- Users can update dinner requests for groups they're in
CREATE POLICY "Users can update dinner requests for their groups" ON public.dinner_requests
    FOR UPDATE 
    USING (
        group_id IN (
            SELECT gm.group_id FROM public.group_members gm 
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
        )
    )
    WITH CHECK (
        group_id IN (
            SELECT gm.group_id FROM public.group_members gm 
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
        )
    );

-- Users can delete dinner requests they created
CREATE POLICY "Users can delete their dinner requests" ON public.dinner_requests
    FOR DELETE 
    USING (auth.uid() = requester_id);

-- ============================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dinner_requests_group_id ON public.dinner_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_dinner_requests_requester_id ON public.dinner_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_dinner_requests_status ON public.dinner_requests(status);
CREATE INDEX IF NOT EXISTS idx_dinner_requests_request_date ON public.dinner_requests(request_date);

-- ============================================
-- 5. CREATE TRIGGER FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_dinner_requests_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dinner_requests_updated_at
    BEFORE UPDATE ON public.dinner_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_dinner_requests_updated_at();

-- ============================================
-- 6. FUNCTION TO GET LATEST REQUEST FOR USER'S GROUPS
-- ============================================
CREATE OR REPLACE FUNCTION get_latest_dinner_request_for_user(user_uuid UUID)
RETURNS TABLE (
    id UUID,
    group_id UUID,
    group_name TEXT,
    requester_id UUID,
    requester_name TEXT,
    request_date DATE,
    request_time TIME,
    recipe_type TEXT,
    deadline_time TIME,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dr.id,
        dr.group_id,
        g.name as group_name,
        dr.requester_id,
        dr.requester_name,
        dr.request_date,
        dr.request_time,
        dr.recipe_type,
        dr.deadline_time,
        dr.status,
        dr.created_at
    FROM public.dinner_requests dr
    JOIN public.groups g ON dr.group_id = g.id
    WHERE dr.group_id IN (
        SELECT gm.group_id 
        FROM public.group_members gm 
        WHERE gm.user_id = user_uuid 
        AND gm.is_active = true
    )
    AND dr.status = 'pending'
    ORDER BY dr.created_at DESC
    LIMIT 1;
END;
$$; 