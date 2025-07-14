-- Function to get user data from auth.users table
-- This needs to be run in your Supabase SQL editor
-- It allows the app to get user names and emails for group members

CREATE OR REPLACE FUNCTION get_users_by_ids(user_ids UUID[])
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  user_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) as full_name,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) as user_name,
    u.created_at
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_users_by_ids(UUID[]) TO authenticated;

-- Test the function (optional - remove after testing)
-- SELECT * FROM get_users_by_ids(ARRAY['your-user-id-here']::UUID[]); 