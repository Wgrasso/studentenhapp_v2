import { supabase } from './supabase';

/**
 * Gets random recipes from the database
 * @param {number} limit - Number of recipes to fetch (default 20)
 * @returns {Promise<Object>} - Success/error response with recipes
 */
export const getRandomRecipes = async (limit = 20) => {
  try {
    console.log('🎲 Getting random recipes with limit:', limit);
    
    // Use simple select instead of RPC function
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('*')
      .limit(limit);

    console.log('📊 Raw database response:', { recipes, error });

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    console.log('✅ Loaded random recipes:', recipes?.length || 0, 'items');
    return {
      success: true,
      recipes: recipes || []
    };

  } catch (error) {
    console.error('❌ Error loading random recipes:', error);
    return {
      success: false,
      error: error.message || 'Failed to load recipes',
      recipes: []
    };
  }
};

/**
 * Gets all recipes with pagination
 * @param {number} offset - Starting point for pagination
 * @param {number} limit - Number of recipes to fetch
 * @returns {Promise<Object>} - Success/error response with recipes
 */
export const getAllRecipes = async (offset = 0, limit = 20) => {
  try {
    console.log('📄 Getting recipes with offset:', offset, 'limit:', limit);
    
    // Use simple select as shown in your API documentation
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('*');

    console.log('📊 Raw database response:', { recipes, error });

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    console.log('✅ Loaded recipes:', recipes?.length || 0, 'items');
    return {
      success: true,
      recipes: recipes || []
    };

  } catch (error) {
    console.error('❌ Error loading recipes:', error);
    return {
      success: false,
      error: error.message || 'Failed to load recipes',
      recipes: []
    };
  }
};

/**
 * Adds a new recipe to the database
 * @param {Object} recipeData - The recipe object to add
 * @returns {Promise<Object>} - Success/error response
 */
export const addRecipe = async (recipeData) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to add recipes'
      };
    }

    // Check if recipe already exists (by recipe_id)
    const { data: existing, error: checkError } = await supabase
      .from('recipes')
      .select('id')
      .eq('recipe_id', recipeData.id.toString())
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existing) {
      return {
        success: false,
        error: 'Recipe already exists'
      };
    }

    // Add recipe to database (no user_id needed)
    const { data, error } = await supabase
      .from('recipes')
      .insert([
        {
          recipe_id: recipeData.id.toString(),
          recipe_data: recipeData
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ Added recipe:', recipeData.title || recipeData.name);
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('❌ Error adding recipe:', error);
    return {
      success: false,
      error: error.message || 'Failed to add recipe'
    };
  }
};

/**
 * Updates an existing recipe
 * @param {string} recipeId - The ID of the recipe to update
 * @param {Object} recipeData - The updated recipe data
 * @returns {Promise<Object>} - Success/error response
 */
export const updateRecipe = async (recipeId, recipeData) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to update recipes'
      };
    }

    const { error } = await supabase
      .from('recipes')
      .update({ 
        recipe_data: recipeData,
        recipe_id: recipeData.id.toString()
      })
      .eq('recipe_id', recipeId);

    if (error) {
      throw error;
    }

    console.log('✅ Updated recipe:', recipeData.title || recipeData.name);
    return {
      success: true
    };

  } catch (error) {
    console.error('❌ Error updating recipe:', error);
    return {
      success: false,
      error: error.message || 'Failed to update recipe'
    };
  }
};

/**
 * Deletes a recipe from the database
 * @param {string} recipeId - The ID of the recipe to delete
 * @returns {Promise<Object>} - Success/error response
 */
export const deleteRecipe = async (recipeId) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to delete recipes'
      };
    }

    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('recipe_id', recipeId);

    if (error) {
      throw error;
    }

    console.log('✅ Deleted recipe:', recipeId);
    return {
      success: true
    };

  } catch (error) {
    console.error('❌ Error deleting recipe:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete recipe'
    };
  }
};

/**
 * Gets a specific recipe by ID
 * @param {string} recipeId - The ID of the recipe to get
 * @returns {Promise<Object>} - Success/error response with recipe
 */
export const getRecipeById = async (recipeId) => {
  try {
    const { data: recipe, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('recipe_id', recipeId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return {
      success: true,
      recipe: recipe || null
    };

  } catch (error) {
    console.error('❌ Error getting recipe:', error);
    return {
      success: false,
      error: error.message || 'Failed to get recipe',
      recipe: null
    };
  }
};

/**
 * Search recipes by title or ingredients
 * @param {string} searchTerm - The term to search for
 * @param {number} limit - Number of results to return
 * @returns {Promise<Object>} - Success/error response with recipes
 */
export const searchRecipes = async (searchTerm, limit = 20) => {
  try {
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('*')
      .or(`recipe_data->>'title'.ilike.%${searchTerm}%,recipe_data->>'description'.ilike.%${searchTerm}%`)
      .order('added_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    console.log('✅ Found recipes:', recipes?.length || 0, 'items for:', searchTerm);
    return {
      success: true,
      recipes: recipes || []
    };

  } catch (error) {
    console.error('❌ Error searching recipes:', error);
    return {
      success: false,
      error: error.message || 'Failed to search recipes',
      recipes: []
    };
  }
}; 