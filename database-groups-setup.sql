-- Groups Feature Database Setup
-- Run this in your Supabase SQL editor

-- 1. Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    join_code TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    description TEXT DEFAULT '',
    max_members INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT true
);

-- 2. Create group_members table
CREATE TABLE IF NOT EXISTS public.group_members (
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (group_id, user_id)
);

-- 3. Enable Row Level Security
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for groups table

-- Allow authenticated users to create groups
CREATE POLICY "Users can create groups" ON public.groups
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = created_by);

-- Allow users to see groups they created or are members of
CREATE POLICY "Users can view their groups" ON public.groups
    FOR SELECT 
    USING (
        auth.uid() = created_by 
        OR 
        auth.uid() IN (
            SELECT user_id FROM public.group_members 
            WHERE group_id = groups.id AND is_active = true
        )
    );

-- Allow only creators to update their groups
CREATE POLICY "Creators can update their groups" ON public.groups
    FOR UPDATE 
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- Allow only creators to delete their groups
CREATE POLICY "Creators can delete their groups" ON public.groups
    FOR DELETE 
    USING (auth.uid() = created_by);

-- 5. Create RLS Policies for group_members table

-- Allow users to see their own memberships
CREATE POLICY "Users can view their memberships" ON public.group_members
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Allow users to join groups (insert their own membership)
CREATE POLICY "Users can join groups" ON public.group_members
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Allow users to leave groups (delete their own membership)
CREATE POLICY "Users can leave groups" ON public.group_members
    FOR DELETE 
    USING (auth.uid() = user_id);

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON public.groups(created_by);
CREATE INDEX IF NOT EXISTS idx_groups_join_code ON public.groups(join_code);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

-- Drop the problematic admin policy that causes infinite recursion
DROP POLICY IF EXISTS "Admins can manage group members" ON public.group_members;

-- 7. Create a function to get user's groups with member count (FIXED)
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