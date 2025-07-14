-- Debug script to check dinner requests data
-- Run this in your Supabase SQL editor to see what's actually saved

-- 1. Check all dinner requests in the table (bypassing RLS)
SELECT 
    dr.id,
    dr.group_id,
    g.name as group_name,
    dr.requester_id,
    dr.request_date,
    dr.request_time,
    dr.recipe_type,
    dr.status,
    dr.created_at
FROM dinner_requests dr
LEFT JOIN groups g ON dr.group_id = g.id
ORDER BY dr.created_at DESC;

-- 2. Check what groups the current user is in
-- (Replace 'd3681a83-89e3-4f8b-b665-7341466c8acb' with your user ID)
SELECT 
    g.id,
    g.name,
    gm.role,
    gm.is_active
FROM groups g
JOIN group_members gm ON g.id = gm.group_id
WHERE gm.user_id = 'd3681a83-89e3-4f8b-b665-7341466c8acb'
AND gm.is_active = true;

-- 3. Check dinner requests that should be visible to the current user
-- (This simulates what the app query should return)
SELECT 
    dr.id,
    dr.group_id,
    g.name as group_name,
    dr.requester_id,
    dr.request_date,
    dr.request_time,
    dr.recipe_type,
    dr.status,
    dr.created_at
FROM dinner_requests dr
JOIN groups g ON dr.group_id = g.id
WHERE dr.group_id IN (
    SELECT gm.group_id 
    FROM group_members gm 
    WHERE gm.user_id = 'd3681a83-89e3-4f8b-b665-7341466c8acb'
    AND gm.is_active = true
)
AND dr.status = 'pending'
ORDER BY dr.created_at DESC;

-- 4. Test the RLS policies are working
-- Try to select from dinner_requests as the authenticated user
SET LOCAL row_security = on;
SELECT * FROM dinner_requests WHERE status = 'pending' LIMIT 5; 