-- Simple Fix for Meal Requests Constraint Issue
-- Run this in your Supabase SQL editor to quickly fix the termination error

-- ============================================
-- REMOVE THE PROBLEMATIC CONSTRAINT
-- ============================================
-- Remove the constraint that prevents multiple completed requests per group
ALTER TABLE public.meal_requests 
DROP CONSTRAINT IF EXISTS meal_requests_group_id_status_key;

-- ============================================
-- ADD PROPER CONSTRAINT
-- ============================================
-- Add a unique partial index that only prevents multiple ACTIVE requests per group
-- This allows multiple completed/cancelled requests while preventing multiple active ones
CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_requests_unique_active_per_group 
ON public.meal_requests (group_id) 
WHERE status = 'active';

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify the fix worked:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'meal_requests' AND schemaname = 'public'; 