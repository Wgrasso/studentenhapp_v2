-- Groups Cleanup Enhancement - Run this to ensure proper data cleanup
-- Run this in your Supabase SQL editor to enhance CASCADE deletes

-- ============================================
-- 1. ENHANCE CASCADE DELETES FOR MEAL REQUESTS
-- ============================================

-- Update meal_requests foreign key to CASCADE delete when group is deleted
ALTER TABLE public.meal_requests 
DROP CONSTRAINT IF EXISTS meal_requests_group_id_fkey;

ALTER TABLE public.meal_requests 
ADD CONSTRAINT meal_requests_group_id_fkey 
FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;

-- Update meal_request_options foreign key to CASCADE delete when request is deleted
ALTER TABLE public.meal_request_options 
DROP CONSTRAINT IF EXISTS meal_request_options_request_id_fkey;

ALTER TABLE public.meal_request_options 
ADD CONSTRAINT meal_request_options_request_id_fkey 
FOREIGN KEY (request_id) REFERENCES public.meal_requests(id) ON DELETE CASCADE;

-- Update meal_votes foreign key to CASCADE delete when request is deleted
ALTER TABLE public.meal_votes 
DROP CONSTRAINT IF EXISTS meal_votes_request_id_fkey;

ALTER TABLE public.meal_votes 
ADD CONSTRAINT meal_votes_request_id_fkey 
FOREIGN KEY (request_id) REFERENCES public.meal_requests(id) ON DELETE CASCADE;

-- Update meal_votes foreign key to CASCADE delete when meal option is deleted
ALTER TABLE public.meal_votes 
DROP CONSTRAINT IF EXISTS meal_votes_meal_option_id_fkey;

ALTER TABLE public.meal_votes 
ADD CONSTRAINT meal_votes_meal_option_id_fkey 
FOREIGN KEY (meal_option_id) REFERENCES public.meal_request_options(id) ON DELETE CASCADE;

-- ============================================
-- 2. ENHANCE CASCADE DELETES FOR GROUP MEMBERS
-- ============================================

-- Update group_members foreign key to CASCADE delete when group is deleted
ALTER TABLE public.group_members 
DROP CONSTRAINT IF EXISTS group_members_group_id_fkey;

ALTER TABLE public.group_members 
ADD CONSTRAINT group_members_group_id_fkey 
FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;

-- ============================================
-- 3. CREATE CLEANUP FUNCTION FOR MANUAL CLEANUP
-- ============================================

-- Function to manually clean up all data for a group
CREATE OR REPLACE FUNCTION cleanup_group_data(group_uuid UUID)
RETURNS TABLE (
    cleaned_votes BIGINT,
    cleaned_options BIGINT,
    cleaned_requests BIGINT,
    cleaned_members BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    votes_count BIGINT := 0;
    options_count BIGINT := 0;
    requests_count BIGINT := 0;
    members_count BIGINT := 0;
BEGIN
    -- Delete meal votes for this group
    WITH deleted_votes AS (
        DELETE FROM public.meal_votes 
        WHERE request_id IN (
            SELECT id FROM public.meal_requests WHERE group_id = group_uuid
        )
        RETURNING 1
    )
    SELECT COUNT(*) INTO votes_count FROM deleted_votes;
    
    -- Delete meal options for this group
    WITH deleted_options AS (
        DELETE FROM public.meal_request_options 
        WHERE request_id IN (
            SELECT id FROM public.meal_requests WHERE group_id = group_uuid
        )
        RETURNING 1
    )
    SELECT COUNT(*) INTO options_count FROM deleted_options;
    
    -- Delete meal requests for this group
    WITH deleted_requests AS (
        DELETE FROM public.meal_requests 
        WHERE group_id = group_uuid
        RETURNING 1
    )
    SELECT COUNT(*) INTO requests_count FROM deleted_requests;
    
    -- Delete group members
    WITH deleted_members AS (
        DELETE FROM public.group_members 
        WHERE group_id = group_uuid
        RETURNING 1
    )
    SELECT COUNT(*) INTO members_count FROM deleted_members;
    
    RETURN QUERY SELECT votes_count, options_count, requests_count, members_count;
END;
$$;

-- ============================================
-- 4. ADD INDEXES FOR BETTER CLEANUP PERFORMANCE
-- ============================================

-- Add indexes to improve cleanup performance
CREATE INDEX IF NOT EXISTS idx_meal_requests_group_id_cleanup ON public.meal_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_meal_request_options_request_id_cleanup ON public.meal_request_options(request_id);
CREATE INDEX IF NOT EXISTS idx_meal_votes_request_id_cleanup ON public.meal_votes(request_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id_cleanup ON public.group_members(group_id);

-- ============================================
-- 5. VERIFY CASCADE SETUP
-- ============================================

-- Check if CASCADE deletes are properly set up
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
    AND tc.table_name IN ('meal_requests', 'meal_request_options', 'meal_votes', 'group_members')
ORDER BY tc.table_name, kcu.column_name; 