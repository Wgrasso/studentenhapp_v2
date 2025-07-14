import { supabase } from './supabase';

/**
 * Creates or updates a user profile
 * @param {string} fullName - User's full name
 * @param {string} displayName - User's display name (optional, defaults to fullName)
 * @returns {Object} - Success/error response
 */
export const createOrUpdateProfile = async (fullName, displayName = null) => {
  console.log('📝 [PROFILE] Creating/updating user profile...');
  
  try {
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to update your profile'
      };
    }

    const profileData = {
      id: user.id,
      email: user.email,
      full_name: fullName,
      display_name: displayName || fullName
    };

    console.log('📝 Profile data to save:', profileData);

    // Use upsert to create or update the profile
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData)
      .select();

    if (error) {
      console.error('❌ Error saving profile:', error);
      return {
        success: false,
        error: error.message || 'Failed to save profile'
      };
    }

    console.log('✅ Profile saved successfully:', data);
    return {
      success: true,
      profile: data[0],
      message: 'Profile updated successfully!'
    };

  } catch (error) {
    console.error('❌ Unexpected error saving profile:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Gets the current user's profile
 * @returns {Object} - Success/error response with profile data
 */
export const getCurrentUserProfile = async () => {
  console.log('📥 [PROFILE] Loading current user profile...');
  
  try {
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to view your profile'
      };
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Profile doesn't exist yet, create one from auth data
        console.log('📝 Profile not found, creating from auth data...');
        const createResult = await createOrUpdateProfile(
          user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
        );
        
        if (createResult.success) {
          return {
            success: true,
            profile: createResult.profile
          };
        } else {
          return createResult;
        }
      }
      
      console.error('❌ Error loading profile:', error);
      return {
        success: false,
        error: error.message || 'Failed to load profile'
      };
    }

    console.log('✅ Profile loaded successfully:', profile);
    return {
      success: true,
      profile: profile
    };

  } catch (error) {
    console.error('❌ Unexpected error loading profile:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Gets a user profile by ID (public data only)
 * @param {string} userId - The user ID to get profile for
 * @returns {Object} - Success/error response with profile data
 */
export const getUserProfile = async (userId) => {
  console.log('📥 [PROFILE] Loading user profile for:', userId);
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, display_name, created_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ Error loading user profile:', error);
      return {
        success: false,
        error: error.message || 'Failed to load user profile'
      };
    }

    return {
      success: true,
      profile: profile
    };

  } catch (error) {
    console.error('❌ Unexpected error loading user profile:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Ensures current user has a profile (creates one if missing)
 * @returns {Object} - Success/error response
 */
export const ensureUserProfile = async () => {
  console.log('🔍 [PROFILE] Ensuring user has a profile...');
  
  const profileResult = await getCurrentUserProfile();
  
  if (profileResult.success) {
    console.log('✅ User already has a profile');
    return profileResult;
  } else {
    console.log('📝 Creating profile for user...');
    // Profile doesn't exist, the getCurrentUserProfile function will create it
    return profileResult;
  }
}; 