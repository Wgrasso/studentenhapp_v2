-- Quick fixes for Groups feature issues
-- Run this in your Supabase SQL editor to fix the current problems

-- 1. Drop the problematic admin policy that causes infinite recursion
DROP POLICY IF EXISTS "Admins can manage group members" ON public.group_members;

-- 2. Fix the ambiguous column reference in get_user_groups function
CREATE OR REPLACE FUNCTION get_user_groups(user_uuid UUID)
RETURNS TABLE (
    group_id UUID,
    group_name TEXT,
    group_description TEXT,
    join_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    user_role TEXT,
    member_count BIGINT,
    is_creator BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id as group_id,
        g.name as group_name,
        g.description as group_description,
        g.join_code,
        g.created_at,
        g.created_by,
        gm.role as user_role,
        (SELECT COUNT(*) FROM public.group_members WHERE group_members.group_id = g.id AND is_active = true) as member_count,
        (g.created_by = user_uuid) as is_creator
    FROM public.groups g
    JOIN public.group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = user_uuid 
    AND gm.is_active = true 
    AND g.is_active = true
    ORDER BY g.created_at DESC;
END;
$$;

-- 3. Add a simpler admin management policy (optional - for future use)
-- This allows group creators to manage their group members without recursion
CREATE POLICY "Group creators can manage members" ON public.group_members
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.groups 
            WHERE groups.id = group_members.group_id 
            AND groups.created_by = auth.uid()
        )
    );

-- 4. Verify the fixes work
-- You can test this query to make sure it works:
-- SELECT * FROM get_user_groups('your-user-id-here'); 

-- Add unique constraint for group names per user
ALTER TABLE public.groups
ADD CONSTRAINT unique_group_name_per_user UNIQUE (created_by, name);

-- Fix for the check_group_name_exists function

-- First, drop existing function if it exists (with any parameter combinations)
DROP FUNCTION IF EXISTS public.check_group_name_exists(p_group_name text, p_user_id uuid);
DROP FUNCTION IF EXISTS public.check_group_name_exists(p_user_id uuid, p_group_name text);

-- Create the function with correct parameter order and proper return type
CREATE OR REPLACE FUNCTION public.check_group_name_exists(
    p_group_name text,
    p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    exists_count integer;
BEGIN
    SELECT COUNT(*)
    INTO exists_count
    FROM public.groups 
    WHERE created_by = p_user_id 
    AND LOWER(name) = LOWER(p_group_name)
    AND is_active = true;

    RETURN exists_count > 0;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_group_name_exists(text, uuid) TO authenticated;

-- Test the function
COMMENT ON FUNCTION public.check_group_name_exists IS 'Checks if a group name already exists for a given user'; 