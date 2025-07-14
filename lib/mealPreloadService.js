import { supabase } from './supabase';
import { fetchRandomMealsForGroup } from './mealRequestService';

// Cache for preloaded meals
let preloadedMeals = {
  inspiration: [],
  groups: {}  // Key: groupId, Value: array of meals
};

/**
 * Preload meals for inspiration page and open groups
 * @param {Array} groups - Array of user's groups
 * @returns {Promise<Object>} - Success/error response
 */
export const preloadAllMeals = async (groups) => {
  console.log('🔄 Starting meal preload for inspiration and groups...');
  
  try {
    // Start preloading inspiration meals (25)
    console.log('🍽️ Preloading inspiration meals...');
    const inspirationPromise = fetchRandomMealsForGroup(25)
      .then(meals => {
        preloadedMeals.inspiration = meals;
        console.log('✅ Preloaded', meals.length, 'inspiration meals');
      })
      .catch(error => {
        console.error('❌ Failed to preload inspiration meals:', error);
      });

    // Find groups without active meal requests
    const openGroups = groups.filter(group => !group.hasActiveMealRequest);
    console.log('📋 Found', openGroups.length, 'groups without active requests');

    // Preload meals for each open group (25 each)
    const groupPromises = openGroups.map(group => 
      fetchRandomMealsForGroup(25)
        .then(meals => {
          preloadedMeals.groups[group.group_id] = meals;
          console.log('✅ Preloaded', meals.length, 'meals for group:', group.group_name);
        })
        .catch(error => {
          console.error('❌ Failed to preload meals for group:', group.group_name, error);
        })
    );

    // Wait for all preloading to complete
    await Promise.all([inspirationPromise, ...groupPromises]);
    
    console.log('✅ All meal preloading complete!');
    console.log('📊 Stats:', {
      inspirationMeals: preloadedMeals.inspiration.length,
      groupsWithMeals: Object.keys(preloadedMeals.groups).length
    });

    return { success: true };

  } catch (error) {
    console.error('❌ Error during meal preloading:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get preloaded meals for inspiration page
 * @returns {Array} Array of meal data
 */
export const getPreloadedInspirationMeals = () => {
  return preloadedMeals.inspiration;
};

/**
 * Get preloaded meals for a specific group
 * @param {string} groupId - Group ID
 * @returns {Array} Array of meal data
 */
export const getPreloadedGroupMeals = (groupId) => {
  return preloadedMeals.groups[groupId] || [];
};

/**
 * Clear preloaded meals for a specific group
 * @param {string} groupId - Group ID
 */
export const clearPreloadedGroupMeals = (groupId) => {
  delete preloadedMeals.groups[groupId];
  console.log('🧹 Cleared preloaded meals for group:', groupId);
};

/**
 * Clear all preloaded meals
 */
export const clearAllPreloadedMeals = () => {
  preloadedMeals = {
    inspiration: [],
    groups: {}
  };
  console.log('🧹 Cleared all preloaded meals');
}; 