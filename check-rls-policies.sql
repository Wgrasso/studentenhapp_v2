-- Check Current RLS Policies
-- Run this in your Supabase SQL Editor to see what policies exist

-- ============================================
-- CHECK GROUPS TABLE POLICIES
-- ============================================

-- List all policies on the groups table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'groups'
ORDER BY policyname;

-- ============================================
-- CHECK GROUP_MEMBERS TABLE POLICIES  
-- ============================================

-- List all policies on the group_members table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'group_members'
ORDER BY policyname;

-- ============================================
-- CHECK IF TABLES HAVE RLS ENABLED
-- ============================================

-- Check if RLS is enabled on both tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('groups', 'group_members');

-- ============================================
-- TEST GROUP VISIBILITY (as current user)
-- ============================================

-- Test if you can see any groups at all
-- This should return groups if the policies are working
SELECT 
    id,
    name,
    join_code,
    created_by,
    is_active,
    created_at
FROM public.groups 
WHERE is_active = true
LIMIT 5;

-- ============================================
-- CREATE A TEST GROUP (if none exist)
-- ============================================

-- If no groups exist, create a test group
-- Replace 'YOUR_USER_ID' with your actual user ID from auth.users
-- INSERT INTO public.groups (name, join_code, created_by, description) 
-- VALUES ('Test Group', 'TEST1234', 'YOUR_USER_ID', 'Test group for debugging');

-- ============================================
-- EMERGENCY RLS DISABLE (if needed for testing)
-- ============================================

-- ONLY USE THIS FOR TESTING - NOT FOR PRODUCTION
-- This temporarily disables RLS to test if that's the issue
-- ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;

-- To re-enable later:
-- ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY; 