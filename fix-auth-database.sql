-- Fix Authentication Database Issues
-- Copy and paste these SQL commands in your Supabase SQL Editor

-- ============================================
-- STEP 1: REMOVE PROBLEMATIC TRIGGER
-- ============================================

-- This trigger might be causing authentication failures
-- Remove it to allow clean user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ============================================
-- STEP 2: REMOVE THE FUNCTION (OPTIONAL)
-- ============================================

-- You can also remove the function if you're not using it elsewhere
-- DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================
-- STEP 3: CHECK FOR ANY PROBLEMATIC RLS POLICIES
-- ============================================

-- List all policies on user_profiles table to check for issues
-- (This is just for viewing - copy the output to check)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- ============================================
-- STEP 4: CREATE SAFER PROFILE MANAGEMENT
-- ============================================

-- Instead of automatic triggers, create a function to manually create profiles
-- This is safer and more predictable
CREATE OR REPLACE FUNCTION public.create_user_profile(user_id UUID)
RETURNS boolean AS $$
BEGIN
  -- Check if profile already exists
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = user_id) THEN
    RETURN true; -- Profile already exists
  END IF;
  
  -- Insert new profile
  INSERT INTO public.user_profiles (id, created_at, updated_at)
  VALUES (user_id, NOW(), NOW());
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail
    RAISE WARNING 'Failed to create user profile for %: %', user_id, SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 5: TEMPORARY EMAIL CONFIRMATION BYPASS
-- ============================================

-- Note: This is not an SQL command - you need to do this in the Supabase Dashboard:
-- 1. Go to Authentication → Settings
-- 2. Find "Enable email confirmations" 
-- 3. Turn it OFF temporarily
-- 4. Save settings

-- ============================================
-- STEP 6: CHECK USER TABLE STATE
-- ============================================

-- Check if there are any users stuck in unconfirmed state
-- (Run this to see the current state)
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN 'UNCONFIRMED'
    ELSE 'CONFIRMED'
  END as status
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10; 