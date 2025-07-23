-- Fix for wishlist table id sequence issue
-- Run this in your Supabase SQL editor

-- First, let's check the current structure and fix the sequence
-- Drop the table if it exists and recreate it properly
DROP TABLE IF EXISTS public.wishlist CASCADE;

-- Recreate the wishlist table with proper SERIAL setup
CREATE TABLE public.wishlist (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipe_id TEXT NOT NULL,
    recipe_data JSONB NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create unique index to prevent duplicate recipes per user
CREATE UNIQUE INDEX unique_user_recipe 
ON public.wishlist(user_id, recipe_id);

-- Enable Row Level Security
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
-- Users can only see their own wishlist items
CREATE POLICY "Users can view their own wishlist" ON public.wishlist
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own wishlist items
CREATE POLICY "Users can add to their own wishlist" ON public.wishlist
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own wishlist items
CREATE POLICY "Users can remove from their own wishlist" ON public.wishlist
    FOR DELETE 
    USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_wishlist_user_id ON public.wishlist(user_id);
CREATE INDEX idx_wishlist_added_at ON public.wishlist(added_at DESC);

-- Verify the sequence is working
-- This should show the sequence name and current value
SELECT 
    column_name, 
    column_default, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'wishlist' 
  AND column_name = 'id';

-- Test insert (you can remove this after confirming it works)
-- INSERT INTO public.wishlist (user_id, recipe_id, recipe_data) 
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test', '{}');
-- DELETE FROM public.wishlist WHERE recipe_id = 'test'; 