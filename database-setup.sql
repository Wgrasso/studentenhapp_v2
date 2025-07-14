-- studentenhapp Database Setup
-- Run this in your Supabase SQL editor

-- Create user profiles table
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  date_of_birth DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Cuisine preferences (booleans)
  cuisine_italian BOOLEAN DEFAULT FALSE,
  cuisine_french BOOLEAN DEFAULT FALSE,
  cuisine_mexican BOOLEAN DEFAULT FALSE,
  cuisine_chinese BOOLEAN DEFAULT FALSE,
  cuisine_japanese BOOLEAN DEFAULT FALSE,
  cuisine_indian BOOLEAN DEFAULT FALSE,
  cuisine_thai BOOLEAN DEFAULT FALSE,
  cuisine_mediterranean BOOLEAN DEFAULT FALSE,
  cuisine_american BOOLEAN DEFAULT FALSE,
  cuisine_greek BOOLEAN DEFAULT FALSE,
  
  -- 25 Most Common Dietary Restrictions (booleans)
  dietary_vegetarian BOOLEAN DEFAULT FALSE,
  dietary_vegan BOOLEAN DEFAULT FALSE,
  dietary_gluten_free BOOLEAN DEFAULT FALSE,
  dietary_dairy_free BOOLEAN DEFAULT FALSE,
  dietary_lactose_intolerant BOOLEAN DEFAULT FALSE,
  dietary_nut_allergy BOOLEAN DEFAULT FALSE,
  dietary_peanut_allergy BOOLEAN DEFAULT FALSE,
  dietary_shellfish_allergy BOOLEAN DEFAULT FALSE,
  dietary_fish_allergy BOOLEAN DEFAULT FALSE,
  dietary_egg_allergy BOOLEAN DEFAULT FALSE,
  dietary_soy_allergy BOOLEAN DEFAULT FALSE,
  dietary_keto BOOLEAN DEFAULT FALSE,
  dietary_paleo BOOLEAN DEFAULT FALSE,
  dietary_low_carb BOOLEAN DEFAULT FALSE,
  dietary_low_sodium BOOLEAN DEFAULT FALSE,
  dietary_sugar_free BOOLEAN DEFAULT FALSE,
  dietary_diabetic BOOLEAN DEFAULT FALSE,
  dietary_halal BOOLEAN DEFAULT FALSE,
  dietary_kosher BOOLEAN DEFAULT FALSE,
  dietary_raw_food BOOLEAN DEFAULT FALSE,
  dietary_organic_only BOOLEAN DEFAULT FALSE,
  dietary_no_additives BOOLEAN DEFAULT FALSE,
  dietary_low_fat BOOLEAN DEFAULT FALSE,
  dietary_high_protein BOOLEAN DEFAULT FALSE,
  dietary_fodmap BOOLEAN DEFAULT FALSE,
  dietary_celiac BOOLEAN DEFAULT FALSE,
  dietary_pescatarian BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for users to only see/edit their own profile
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create a function to initialize a user profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create trigger to auto-create profile on user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 