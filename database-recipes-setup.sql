-- Recipes table setup for studentenhapp (PUBLIC RECIPES)
-- Run this in your Supabase SQL editor

-- Create recipes table (PUBLIC - no user_id needed)
CREATE TABLE IF NOT EXISTS public.recipes (
    id SERIAL PRIMARY KEY,
    recipe_id TEXT NOT NULL UNIQUE,
    recipe_data JSONB NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for recipe_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_recipes_recipe_id ON public.recipes(recipe_id);

-- Enable Row Level Security
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies - PUBLIC ACCESS for reading, authenticated users can manage
-- Everyone can view all recipes (public access)
CREATE POLICY "Enable read access for all users" ON public.recipes
    FOR SELECT 
    USING (true);

-- Authenticated users can insert recipes
CREATE POLICY "Enable insert for authenticated users" ON public.recipes
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update recipes
CREATE POLICY "Enable update for authenticated users" ON public.recipes
    FOR UPDATE 
    USING (auth.role() = 'authenticated');

-- Authenticated users can delete recipes
CREATE POLICY "Enable delete for authenticated users" ON public.recipes
    FOR DELETE 
    USING (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipes_added_at ON public.recipes(added_at DESC);

-- Create a function to get random recipes for the feed
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