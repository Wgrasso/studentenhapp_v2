-- Fix Groups RLS Policies to Allow Join by Code
-- Copy and paste this in your Supabase SQL Editor

-- ==================================================
-- STEP 1: DROP THE RESTRICTIVE POLICY
-- ==================================================

-- Remove the policy that prevents users from finding groups by join code
DROP POLICY IF EXISTS "Users can view their groups" ON public.groups;

-- ==================================================
-- STEP 2: CREATE NEW POLICIES
-- ==================================================

-- Allow users to view groups they created or are members of (same as before)
CREATE POLICY "Users can view their own groups" ON public.groups
    FOR SELECT 
    USING (
        auth.uid() = created_by 
        OR 
        auth.uid() IN (
            SELECT user_id FROM public.group_members 
            WHERE group_id = groups.id AND is_active = true
        )
    );

-- NEW POLICY: Allow users to find groups by join code (for joining)
CREATE POLICY "Users can find groups by join code" ON public.groups
    FOR SELECT 
    USING (
        is_active = true 
        AND join_code IS NOT NULL
        AND auth.role() = 'authenticated'
    );

-- ==================================================
-- STEP 3: TEST THE POLICIES (OPTIONAL)
-- ==================================================

-- You can test this by running these queries after creating the policies:
-- (Replace 'YOUR_JOIN_CODE' with an actual join code from your groups table)

-- This should work now:
-- SELECT * FROM public.groups WHERE join_code = 'YOUR_JOIN_CODE' AND is_active = true;

-- ==================================================
-- STEP 4: VERIFY GROUP_MEMBERS POLICIES ARE CORRECT
-- ==================================================

-- Make sure the group_members policies allow joining:
-- These should already exist and be correct, but just in case:

DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;

CREATE POLICY "Users can join groups" ON public.group_members
    FOR INSERT 
    WITH CHECK (
        auth.uid() = user_id 
        AND auth.role() = 'authenticated'
    ); 