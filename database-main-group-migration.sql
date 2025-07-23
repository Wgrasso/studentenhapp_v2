-- Add is_main_group column to groups table if it doesn't exist
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS is_main_group BOOLEAN DEFAULT false;

-- Set the oldest group for each user as their main group
WITH oldest_groups AS (
  SELECT DISTINCT ON (created_by) 
    id,
    created_by,
    created_at
  FROM public.groups
  WHERE is_active = true
  ORDER BY created_by, created_at ASC
)
UPDATE public.groups g
SET is_main_group = true
FROM oldest_groups og
WHERE g.id = og.id;

-- Update get_user_groups function to include is_main_group
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
    is_creator BOOLEAN,
    is_main_group BOOLEAN
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
        (g.created_by = user_uuid) as is_creator,
        g.is_main_group
    FROM public.groups g
    JOIN public.group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = user_uuid 
    AND gm.is_active = true 
    AND g.is_active = true
    ORDER BY g.created_at DESC;
END;
$$; 