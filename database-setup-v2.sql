-- studentenhapp Database Setup v2
-- Better normalized structure with separated tables
-- Run this in your Supabase SQL editor

-- ============================================
-- 1. USER PROFILES TABLE (Basic Information)
-- ============================================
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  date_of_birth DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. CUISINE PREFERENCES TABLE
-- ============================================
CREATE TABLE user_cuisine_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  cuisine_type VARCHAR(50) NOT NULL,
  is_preferred BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user per cuisine type
  UNIQUE(user_id, cuisine_type)
);

-- Insert available cuisine types
INSERT INTO user_cuisine_preferences (user_id, cuisine_type, is_preferred) VALUES
  -- This will be populated when users make selections
  -- Example structure only - actual data inserted by app
  (NULL, 'italian', FALSE),
  (NULL, 'french', FALSE),
  (NULL, 'mexican', FALSE),
  (NULL, 'chinese', FALSE),
  (NULL, 'japanese', FALSE),
  (NULL, 'indian', FALSE),
  (NULL, 'thai', FALSE),
  (NULL, 'mediterranean', FALSE),
  (NULL, 'american', FALSE),
  (NULL, 'greek', FALSE)
ON CONFLICT DO NOTHING;

-- Clean up the example records
DELETE FROM user_cuisine_preferences WHERE user_id IS NULL;

-- ============================================
-- 3. DIETARY RESTRICTIONS TABLE
-- ============================================
CREATE TABLE user_dietary_restrictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  restriction_type VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user per restriction type
  UNIQUE(user_id, restriction_type)
);

-- ============================================
-- 4. REFERENCE TABLES FOR AVAILABLE OPTIONS
-- ============================================

-- Available cuisine types reference
CREATE TABLE available_cuisines (
  id SERIAL PRIMARY KEY,
  cuisine_type VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO available_cuisines (cuisine_type, display_name) VALUES
  ('italian', 'Italian'),
  ('french', 'French'),
  ('mexican', 'Mexican'),
  ('chinese', 'Chinese'),
  ('japanese', 'Japanese'),
  ('indian', 'Indian'),
  ('thai', 'Thai'),
  ('mediterranean', 'Mediterranean'),
  ('american', 'American'),
  ('greek', 'Greek');

-- Available dietary restrictions reference
CREATE TABLE available_dietary_restrictions (
  id SERIAL PRIMARY KEY,
  restriction_type VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  category VARCHAR(50), -- 'allergy', 'diet', 'religious', 'health'
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO available_dietary_restrictions (restriction_type, display_name, category) VALUES
  ('vegetarian', 'Vegetarian', 'diet'),
  ('vegan', 'Vegan', 'diet'),
  ('gluten_free', 'Gluten-Free', 'allergy'),
  ('dairy_free', 'Dairy-Free', 'allergy'),
  ('lactose_intolerant', 'Lactose Intolerant', 'allergy'),
  ('nut_allergy', 'Nut Allergy', 'allergy'),
  ('peanut_allergy', 'Peanut Allergy', 'allergy'),
  ('shellfish_allergy', 'Shellfish Allergy', 'allergy'),
  ('fish_allergy', 'Fish Allergy', 'allergy'),
  ('egg_allergy', 'Egg Allergy', 'allergy'),
  ('soy_allergy', 'Soy Allergy', 'allergy'),
  ('keto', 'Keto', 'diet'),
  ('paleo', 'Paleo', 'diet'),
  ('low_carb', 'Low Carb', 'diet'),
  ('low_sodium', 'Low Sodium', 'health'),
  ('sugar_free', 'Sugar-Free', 'health'),
  ('diabetic', 'Diabetic', 'health'),
  ('halal', 'Halal', 'religious'),
  ('kosher', 'Kosher', 'religious'),
  ('raw_food', 'Raw Food', 'diet'),
  ('organic_only', 'Organic Only', 'diet'),
  ('no_additives', 'No Artificial Additives', 'health'),
  ('low_fat', 'Low Fat', 'health'),
  ('high_protein', 'High Protein', 'health'),
  ('fodmap', 'Low FODMAP', 'health'),
  ('celiac', 'Celiac Disease', 'health'),
  ('pescatarian', 'Pescatarian', 'diet');

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all user tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cuisine_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dietary_restrictions ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Cuisine preferences policies
CREATE POLICY "Users can view their own cuisine preferences" ON user_cuisine_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cuisine preferences" ON user_cuisine_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cuisine preferences" ON user_cuisine_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cuisine preferences" ON user_cuisine_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Dietary restrictions policies
CREATE POLICY "Users can view their own dietary restrictions" ON user_dietary_restrictions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dietary restrictions" ON user_dietary_restrictions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dietary restrictions" ON user_dietary_restrictions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dietary restrictions" ON user_dietary_restrictions
  FOR DELETE USING (auth.uid() = user_id);

-- Reference tables are readable by all authenticated users
CREATE POLICY "Anyone can view available cuisines" ON available_cuisines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can view available dietary restrictions" ON available_dietary_restrictions
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- 6. TRIGGERS AND FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_profiles
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function to initialize user profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Auto-create profile on user signup
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 7. HELPFUL VIEWS (Optional)
-- ============================================

-- View to see a user's complete profile with preferences
CREATE VIEW user_complete_profile AS
SELECT 
  p.id,
  p.date_of_birth,
  p.created_at,
  p.updated_at,
  -- Cuisine preferences as JSON
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'cuisine_type', cp.cuisine_type,
        'display_name', ac.display_name,
        'is_preferred', cp.is_preferred
      )
    ) FILTER (WHERE cp.cuisine_type IS NOT NULL), 
    '[]'::json
  ) as cuisine_preferences,
  -- Dietary restrictions as JSON
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'restriction_type', dr.restriction_type,
        'display_name', adr.display_name,
        'category', adr.category,
        'is_active', dr.is_active
      )
    ) FILTER (WHERE dr.restriction_type IS NOT NULL),
    '[]'::json
  ) as dietary_restrictions
FROM user_profiles p
LEFT JOIN user_cuisine_preferences cp ON p.id = cp.user_id
LEFT JOIN available_cuisines ac ON cp.cuisine_type = ac.cuisine_type
LEFT JOIN user_dietary_restrictions dr ON p.id = dr.user_id
LEFT JOIN available_dietary_restrictions adr ON dr.restriction_type = adr.restriction_type
GROUP BY p.id, p.date_of_birth, p.created_at, p.updated_at;

-- ============================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_user_cuisine_preferences_user_id ON user_cuisine_preferences(user_id);
CREATE INDEX idx_user_dietary_restrictions_user_id ON user_dietary_restrictions(user_id);
CREATE INDEX idx_user_cuisine_preferences_cuisine_type ON user_cuisine_preferences(cuisine_type);
CREATE INDEX idx_user_dietary_restrictions_restriction_type ON user_dietary_restrictions(restriction_type); 