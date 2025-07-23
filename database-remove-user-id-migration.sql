-- Migration to remove user_id from recipes table
-- Run this in your Supabase SQL editor

-- Drop user_id column if it exists
ALTER TABLE public.recipes 
DROP COLUMN IF EXISTS user_id;

-- Drop the old unique index that included user_id
DROP INDEX IF EXISTS unique_user_recipe_id;

-- Make sure recipe_id is unique across all recipes (not just per user)
ALTER TABLE public.recipes 
ADD CONSTRAINT unique_recipe_id UNIQUE (recipe_id);

-- Update any existing indexes
DROP INDEX IF EXISTS idx_recipes_user_id;

-- Recreate necessary indexes
CREATE INDEX IF NOT EXISTS idx_recipes_recipe_id ON public.recipes(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipes_added_at ON public.recipes(added_at DESC);

-- Test that the table structure is correct
-- \d public.recipes; 