import { supabase } from './supabase';

/**
 * Gets all wishlist items for the current user
 * @returns {Promise<Object>} - Success/error response with wishlist items
 */
export const getUserWishlist = async () => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to access your wishlist',
        wishlist: []
      };
    }

    const { data: wishlist, error } = await supabase
      .from('wishlist')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false });

    if (error) {
      throw error;
    }

    console.log('✅ Loaded wishlist:', wishlist?.length || 0, 'items');
    return {
      success: true,
      wishlist: wishlist || []
    };

  } catch (error) {
    console.error('❌ Error loading wishlist:', error);
    return {
      success: false,
      error: error.message || 'Failed to load wishlist',
      wishlist: []
    };
  }
};

/**
 * Adds a recipe to the user's wishlist
 * @param {Object} recipe - The recipe object to add
 * @returns {Promise<Object>} - Success/error response
 */
export const addToWishlist = async (recipe) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to add to wishlist'
      };
    }

    // Check if recipe already exists in wishlist
    const { data: existing, error: checkError } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('recipe_id', recipe.id.toString())
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existing) {
      return {
        success: false,
        error: 'Recipe is already in your wishlist'
      };
    }

    // Add to wishlist
    const { data, error } = await supabase
      .from('wishlist')
      .insert([
        {
          user_id: user.id,
          recipe_id: recipe.id.toString(),
          recipe_data: recipe
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ Added to wishlist:', recipe.title || recipe.name);
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('❌ Error adding to wishlist:', error);
    return {
      success: false,
      error: error.message || 'Failed to add to wishlist'
    };
  }
};

/**
 * Removes a recipe from the user's wishlist
 * @param {string} recipeId - The ID of the recipe to remove
 * @returns {Promise<Object>} - Success/error response
 */
export const removeFromWishlist = async (recipeId) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to modify your wishlist'
      };
    }

    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('user_id', user.id)
      .eq('recipe_id', recipeId.toString());

    if (error) {
      throw error;
    }

    console.log('✅ Removed from wishlist:', recipeId);
    return {
      success: true
    };

  } catch (error) {
    console.error('❌ Error removing from wishlist:', error);
    return {
      success: false,
      error: error.message || 'Failed to remove from wishlist'
    };
  }
};

/**
 * Checks if a recipe is in the user's wishlist
 * @param {string} recipeId - The ID of the recipe to check
 * @returns {Promise<boolean>} - True if recipe is in wishlist
 */
export const isRecipeInWishlist = async (recipeId) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return false;
    }

    const { data, error } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('recipe_id', recipeId.toString())
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !!data;

  } catch (error) {
    console.error('❌ Error checking wishlist:', error);
    return false;
  }
};

/**
 * Clears all items from the user's wishlist
 * @returns {Promise<Object>} - Success/error response
 */
export const clearWishlist = async () => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to clear your wishlist'
      };
    }

    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    console.log('✅ Cleared wishlist');
    return {
      success: true
    };

  } catch (error) {
    console.error('❌ Error clearing wishlist:', error);
    return {
      success: false,
      error: error.message || 'Failed to clear wishlist'
    };
  }
}; 