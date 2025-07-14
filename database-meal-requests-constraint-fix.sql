-- Fix Meal Requests Database Constraint Issue
-- Run this in your Supabase SQL editor to fix the termination constraint error

-- ============================================
-- 1. DROP THE PROBLEMATIC CONSTRAINT
-- ============================================
-- Remove the constraint that prevents multiple completed requests per group
ALTER TABLE public.meal_requests 
DROP CONSTRAINT IF EXISTS meal_requests_group_id_status_key;

-- ============================================
-- 2. CREATE A PROPER CONSTRAINT
-- ============================================
-- Add a unique partial index that only prevents multiple ACTIVE requests per group
-- This allows multiple completed/cancelled requests while preventing multiple active ones
CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_requests_unique_active_per_group 
ON public.meal_requests (group_id) 
WHERE status = 'active';

-- ============================================
-- 3. ADD A CHECK CONSTRAINT FOR VALID STATUSES
-- ============================================
-- Ensure status values are valid (this might already exist but let's be safe)
ALTER TABLE public.meal_requests 
DROP CONSTRAINT IF EXISTS meal_requests_status_check;

ALTER TABLE public.meal_requests 
ADD CONSTRAINT meal_requests_status_check 
CHECK (status IN ('active', 'completed', 'cancelled'));

-- ============================================
-- 4. CREATE A FUNCTION TO SAFELY TERMINATE SESSIONS
-- ============================================
-- Function to safely terminate meal requests with proper cleanup
CREATE OR REPLACE FUNCTION terminate_meal_request(request_uuid UUID, user_uuid UUID)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    terminated_request_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    request_record RECORD;
BEGIN
    -- Check if the request exists and user has permission
    SELECT mr.* INTO request_record
    FROM public.meal_requests mr
    JOIN public.group_members gm ON mr.group_id = gm.group_id
    WHERE mr.id = request_uuid 
    AND mr.status = 'active'
    AND gm.user_id = user_uuid 
    AND gm.is_active = true;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Request not found or permission denied'::TEXT, NULL::UUID;
        RETURN;
    END IF;
    
    -- Update the request to completed status
    UPDATE public.meal_requests 
    SET 
        status = 'completed',
        completed_at = timezone('utc'::text, now())
    WHERE id = request_uuid 
    AND status = 'active';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Request is no longer active'::TEXT, NULL::UUID;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT true, 'Meal request terminated successfully'::TEXT, request_uuid;
END;
$$;

-- ============================================
-- 5. GRANT EXECUTE PERMISSION ON THE FUNCTION
-- ============================================
GRANT EXECUTE ON FUNCTION terminate_meal_request(UUID, UUID) TO authenticated;

-- ============================================
-- 6. VERIFY THE CHANGES
-- ============================================
-- Test that we can now have multiple completed requests per group
-- This is just for verification - you can run this manually to test

-- Check existing constraints
SELECT 
    conname as constraint_name, 
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.meal_requests'::regclass;

-- Check existing indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'meal_requests' 
AND schemaname = 'public'; 