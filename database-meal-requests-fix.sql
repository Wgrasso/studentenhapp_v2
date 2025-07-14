-- Meal Requests Database FIX - Run this to fix RLS issues
-- Run this in your Supabase SQL editor if you're getting RLS policy errors

-- ============================================
-- 1. CHECK AND FIX RLS POLICIES FOR MEAL_VOTES
-- ============================================

-- Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Users can view votes for their group requests" ON public.meal_votes;
DROP POLICY IF EXISTS "Users can vote on meal options" ON public.meal_votes;
DROP POLICY IF EXISTS "Users can update their votes" ON public.meal_votes;
DROP POLICY IF EXISTS "Users can delete their votes" ON public.meal_votes;

-- Recreate RLS policies for meal_votes with better logic
CREATE POLICY "Users can view votes for their group requests" ON public.meal_votes
    FOR SELECT 
    USING (
        request_id IN (
            SELECT mr.id FROM public.meal_requests mr
            JOIN public.group_members gm ON mr.group_id = gm.group_id
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
        )
    );

-- FIXED: Allow users to insert votes for meals in their groups
CREATE POLICY "Users can vote on meal options" ON public.meal_votes
    FOR INSERT 
    WITH CHECK (
        auth.uid() = user_id 
        AND meal_option_id IN (
            SELECT mro.id FROM public.meal_request_options mro
            JOIN public.meal_requests mr ON mro.request_id = mr.id
            JOIN public.group_members gm ON mr.group_id = gm.group_id
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
        )
        AND request_id IN (
            SELECT mr.id FROM public.meal_requests mr
            JOIN public.group_members gm ON mr.group_id = gm.group_id
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
        )
    );

-- Allow users to update their own votes
CREATE POLICY "Users can update their votes" ON public.meal_votes
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
        AND meal_option_id IN (
            SELECT mro.id FROM public.meal_request_options mro
            JOIN public.meal_requests mr ON mro.request_id = mr.id
            JOIN public.group_members gm ON mr.group_id = gm.group_id
            WHERE gm.user_id = auth.uid() AND gm.is_active = true
        )
    );

-- Allow users to delete their own votes
CREATE POLICY "Users can delete their votes" ON public.meal_votes
    FOR DELETE 
    USING (auth.uid() = user_id);

-- ============================================
-- 2. ENSURE MEAL_REQUEST_OPTIONS RLS IS CORRECT
-- ============================================

-- Check if the meal_request_options insert policy exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'meal_request_options' 
        AND policyname = 'Users can insert meal options for their requests'
    ) THEN
        CREATE POLICY "Users can insert meal options for their requests" ON public.meal_request_options
            FOR INSERT 
            WITH CHECK (
                request_id IN (
                    SELECT mr.id FROM public.meal_requests mr
                    WHERE mr.requested_by = auth.uid()
                )
            );
    END IF;
END
$$;

-- ============================================
-- 3. CREATE INDEXES FOR BETTER PERFORMANCE
-- ============================================

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_meal_votes_composite ON public.meal_votes(request_id, meal_option_id, user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_active ON public.group_members(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_meal_requests_group_status ON public.meal_requests(group_id, status);

-- ============================================
-- 4. VERIFY SETUP
-- ============================================

-- Check if policies are correctly created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('meal_requests', 'meal_request_options', 'meal_votes')
ORDER BY tablename, policyname;

-- Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('meal_requests', 'meal_request_options', 'meal_votes'); 