-- Verification script for dinner requests setup
-- Run this in your Supabase SQL editor to check if everything was created correctly

-- 1. Check if the table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'dinner_requests'
) AS table_exists;

-- 2. Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'dinner_requests'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if the function exists
SELECT EXISTS (
    SELECT FROM information_schema.routines 
    WHERE routine_name = 'get_latest_dinner_request_for_user'
    AND routine_schema = 'public'
) AS function_exists;

-- 4. Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'dinner_requests';

-- 5. Test the function (replace with your actual user ID)
-- SELECT * FROM get_latest_dinner_request_for_user('d3681a83-89e3-4f8b-b665-7341466c8acb');

-- 6. Simple test insert (uncomment to test - will fail if table doesn't exist)
-- INSERT INTO dinner_requests (group_id, requester_id, requester_name, request_date, request_time, recipe_type, deadline_time)
-- VALUES (
--     'f67ec051-556f-4a54-a693-e02e2ca51532',
--     'd3681a83-89e3-4f8b-b665-7341466c8acb',
--     'Test User',
--     '2024-01-15',
--     '19:00:00',
--     'random',
--     '18:30:00'
-- ); 