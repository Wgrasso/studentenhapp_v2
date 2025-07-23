-- Test script to check if recipes table is working
-- Run this in your Supabase SQL editor

-- Check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'recipes';

-- Check table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'recipes' 
  AND table_schema = 'public';

-- Check if there are any recipes
SELECT COUNT(*) as total_recipes FROM public.recipes;

-- Show first 3 recipes
SELECT 
  id, 
  recipe_id, 
  recipe_data->>'title' as title,
  added_at 
FROM public.recipes 
LIMIT 3;

-- Test RLS policies by checking current user
SELECT current_user, auth.role();

-- Temporarily disable RLS to test
ALTER TABLE public.recipes DISABLE ROW LEVEL SECURITY;

-- Try to select again
SELECT COUNT(*) as total_recipes_no_rls FROM public.recipes;

-- Re-enable RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY; 