-- Wishlist table setup for studentenhapp
-- Run this in your Supabase SQL editor

-- Create wishlist table
CREATE TABLE IF NOT EXISTS public.wishlist (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipe_id TEXT NOT NULL,
    recipe_data JSONB NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create unique index to prevent duplicate recipes per user
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_recipe 
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
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON public.wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_added_at ON public.wishlist(added_at DESC); 