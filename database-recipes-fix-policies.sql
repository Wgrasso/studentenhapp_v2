-- Fix for recipes table RLS policies (PUBLIC RECIPES)
-- Run this in your Supabase SQL editor

-- First, drop the existing policies
DROP POLICY IF EXISTS "Users can view all recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can add their own recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can update their own recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can delete their own recipes" ON public.recipes;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.recipes;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.recipes;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.recipes;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.recipes;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.recipes;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.recipes;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.recipes;

-- Create new, simpler policies that work without user_id
-- Allow everyone to read all recipes (public access)
CREATE POLICY "Enable read access for all users" ON public.recipes
    FOR SELECT 
    USING (true);

-- Allow authenticated users to insert recipes
CREATE POLICY "Enable insert for authenticated users" ON public.recipes
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update recipes
CREATE POLICY "Enable update for authenticated users" ON public.recipes
    FOR UPDATE 
    USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete recipes
CREATE POLICY "Enable delete for authenticated users" ON public.recipes
    FOR DELETE 
    USING (auth.role() = 'authenticated');

-- Update the get_random_recipes function to work without user_id
CREATE OR REPLACE FUNCTION get_random_recipes(limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
    id INTEGER,
    recipe_id TEXT,
    recipe_data JSONB,
    added_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        r.id,
        r.recipe_id,
        r.recipe_data,
        r.added_at
    FROM public.recipes r
    ORDER BY RANDOM()
    LIMIT limit_count;
$$;

-- Test queries to see if recipes are accessible
-- SELECT COUNT(*) FROM public.recipes;
-- SELECT recipe_data->>'title' as title FROM public.recipes LIMIT 5; 