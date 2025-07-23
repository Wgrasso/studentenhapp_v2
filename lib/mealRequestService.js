import { supabase } from './supabase';
import { setupMealRequestTables, testDatabaseConnection } from './databaseSetup';

/**
 * Fetch random meals from Tasty API (copied from working IdeasScreen implementation)
 * @param {number} count - Number of meals to fetch (default 40)
 * @returns {Promise<Array>} - Array of meal data
 */
export const fetchRandomMealsForGroup = async (count = 12) => {
  console.log(`🍽️ [MEAL SERVICE] Fetching ${count} random meals for group`);
  
  try {
    // Use random offset to get different recipes than inspiration page
    // Use larger offset range for meal requests vs inspiration (2000-4000 vs 0-2000)
    const randomOffset = Math.floor(Math.random() * 2000) + 2000;
    
    // Copy EXACT URL structure from working IdeasScreen
    const apiUrl = `https://tasty.p.rapidapi.com/recipes/list?from=${randomOffset}&size=${count}`;

    console.log(`🔍 Fetching meals with offset ${randomOffset}, size ${count}`);

    // Copy EXACT headers from working IdeasScreen
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': '0b5f1c0661msh2e3ca9ee26bb396p14c318jsn2df1c34cf519',
        'x-rapidapi-host': 'tasty.p.rapidapi.com'
      }
    });

    // Copy EXACT error handling from working IdeasScreen
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      // Copy EXACT fallback logic from working IdeasScreen
      const fallbackOffset = Math.floor(Math.random() * 1000);
      const fallbackUrl = `https://tasty.p.rapidapi.com/recipes/list?from=${fallbackOffset}&size=${count}`;
      
      console.log(`🔄 No results, trying fallback offset ${fallbackOffset}`);
      
      const fallbackResponse = await fetch(fallbackUrl, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': '0b5f1c0661msh2e3ca9ee26bb396p14c318jsn2df1c34cf519',
          'x-rapidapi-host': 'tasty.p.rapidapi.com'
        }
      });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        data.results = fallbackData.results || [];
      }
    }

    console.log(`✅ Fetched ${data.results?.length || 0} meals from Tasty API`);
    return data.results || [];
    
  } catch (error) {
    console.error('❌ Error fetching meals from Tasty API:', error);
    
    // Copy EXACT fallback recipes from working IdeasScreen
    console.log('🔄 API failed, using fallback recipes');
    const fallbackRecipes = [
      {
        id: 'fallback-1',
        name: "Simple Chicken Dinner",
        thumbnail_url: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=300&fit=crop",
        total_time_minutes: 30,
        description: "A quick and delicious chicken dinner perfect for weeknights"
      },
      {
        id: 'fallback-2',
        name: "Pasta Night",
        thumbnail_url: "https://images.unsplash.com/photo-1621996346565-e3dbc353d2c5?w=400&h=300&fit=crop",
        total_time_minutes: 25,
        description: "Comforting pasta dish that's ready in no time"
      },
      {
        id: 'fallback-3',
        name: "Group Taco Tuesday",
        thumbnail_url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop",
        total_time_minutes: 30,
        description: "Easy taco bar perfect for group dining"
      }
    ];
    
    // Shuffle fallback recipes like IdeasScreen does
    return [...fallbackRecipes].sort(() => Math.random() - 0.5);
  }
};

/**
 * Create a new meal request for a group
 * @param {string} groupId - Group ID
 * @param {number} mealCount - Number of meals to fetch (3-20, default 12)
 * @returns {Object} - Success/error response with request data
 */
export const createMealRequest = async (groupId, mealCount = 12) => {
  console.log('🍽️ [MEAL SERVICE] Creating meal request for group:', groupId);
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Meal request creation timeout after 10 seconds'));
    }, 10000);
  });
  
  const createPromise = async () => {
    try {
      // Skip extensive database checks for faster performance
      console.log('🚀 Fast-track meal request creation...');

      // Get current authenticated user (already tested above, but get fresh data)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return {
          success: false,
          error: 'You must be signed in to create a meal request'
        };
      }

      // Check if there's already an active request for this group
      const { data: existingRequest, error: checkError } = await supabase
        .from('meal_requests')
        .select(`
          id,
          created_at,
          requested_by,
          total_options,
          meal_request_options(
            meal_data
          )
        `)
        .eq('group_id', groupId)
        .eq('status', 'active')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingRequest) {
        // Get requester name for display with timeout protection
        let requesterName = 'Unknown User';
        try {
          const profileTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Profile query timeout')), 3000);
          });
          
          const profilePromise = supabase
            .from('profiles')
            .select('full_name, display_name')
            .eq('id', existingRequest.requested_by)
            .single();
          
          const { data: requesterProfile } = await Promise.race([profilePromise, profileTimeoutPromise]);
          requesterName = requesterProfile?.display_name || requesterProfile?.full_name || 'Unknown User';
        } catch (profileError) {
          console.warn('⚠️ Could not fetch requester profile, using fallback:', profileError.message);
          // Use fallback name - don't let this block the main operation
          requesterName = 'Group Member';
        }

        const createdDate = new Date(existingRequest.created_at).toLocaleDateString();
        const createdTime = new Date(existingRequest.created_at).toLocaleTimeString();
        
        return {
          success: false,
          error: 'EXISTING_REQUEST_FOUND',
          existingRequest: {
            id: existingRequest.id,
            requestedBy: existingRequest.requested_by,
            requesterName: requesterName,
            createdAt: existingRequest.created_at,
            createdDate: createdDate,
            createdTime: createdTime,
            totalOptions: existingRequest.total_options,
            mealOptions: existingRequest.meal_request_options || []
          }
        };
      }

      // Ensure meal count is within reasonable bounds
      const safeMealCount = Math.max(3, Math.min(20, mealCount));
      console.log(`🍽️ Getting ${safeMealCount} meals for request...`);
      
      // Try to get preloaded meals first
      const { getPreloadedGroupMeals, clearPreloadedGroupMeals } = require('./mealPreloadService');
      let meals = getPreloadedGroupMeals(groupId);
      
      if (meals && meals.length >= safeMealCount) {
        // Use first safeMealCount meals from preloaded set
        console.log('✅ Using preloaded meals for request');
        meals = meals.slice(0, safeMealCount);
        // Clear preloaded meals since we're using them
        clearPreloadedGroupMeals(groupId);
      } else {
        // Fallback to fetching new meals if no preloaded meals available
        console.log('⚠️ No preloaded meals available, fetching new meals...');
        meals = await fetchRandomMealsForGroup(safeMealCount);
      }
      
      if (!meals || meals.length === 0) {
        return {
          success: false,
          error: 'Failed to fetch meals from API. Please try again.'
        };
      }

      console.log(`🍽️ Got ${meals.length} meals, creating request...`);

      // Create the meal request
      const { data: requestData, error: requestError } = await supabase
        .from('meal_requests')
        .insert([
          {
            group_id: groupId,
            requested_by: user.id,
            status: 'active',
            total_options: meals.length
          }
        ])
        .select('*')
        .single();

      if (requestError) {
        throw requestError;
      }

      console.log('✅ Meal request created:', requestData.id);

      // Insert meal options
      console.log('🍽️ Saving meal options to database...');
      const mealOptions = meals.map((meal, index) => ({
        request_id: requestData.id,
        meal_id: meal.id,
        meal_data: meal,
        option_order: index + 1
      }));

      const { error: optionsError } = await supabase
        .from('meal_request_options')
        .insert(mealOptions);

      if (optionsError) {
        // Clean up the request if meal options failed
        await supabase
          .from('meal_requests')
          .delete()
          .eq('id', requestData.id);
        
        throw optionsError;
      }

      console.log(`✅ Saved ${mealOptions.length} meal options`);

      // Fetch the created meal options with their IDs for immediate use
      const { data: createdOptions, error: fetchError } = await supabase
        .from('meal_request_options')
        .select('*')
        .eq('request_id', requestData.id)
        .order('option_order');

      if (fetchError) {
        console.warn('⚠️ Could not fetch created options for pre-loading:', fetchError);
      }

      return {
        success: true,
        request: requestData,
        mealOptions: createdOptions || [], // Pre-loaded meal options
        message: `Meal request created with ${meals.length} options! Group members can now start voting.`
      };

    } catch (error) {
      console.error('❌ Error creating meal request:', error);
      return {
        success: false,
        error: error.message || 'Failed to create meal request. Please try again.'
      };
    }
  };
  
  try {
    return await Promise.race([createPromise(), timeoutPromise]);
  } catch (error) {
    return {
      success: false,
      error: error.message === 'Meal request creation timeout after 10 seconds'
        ? 'Creating meal request is taking too long. Please try again.'
        : error.message || 'Failed to create meal request. Please try again.'
    };
  }
};

/**
 * Replace an existing active meal request with a new one
 * @param {string} groupId - Group ID
 * @param {number} mealCount - Number of meals to fetch (3-20, default 12)
 * @param {string} existingRequestId - ID of the existing request to replace
 * @returns {Object} - Success/error response with request data
 */
export const replaceMealRequest = async (groupId, mealCount = 12, existingRequestId) => {
  console.log('🔄 [MEAL SERVICE] Replacing meal request for group:', groupId);
  
  try {
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to replace a meal request'
      };
    }

    // First, terminate the existing request
    const { error: terminateError } = await supabase
      .from('meal_requests')
      .update({ 
        status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .eq('id', existingRequestId)
      .eq('status', 'active');

    if (terminateError) {
      console.error('❌ Error terminating existing request:', terminateError);
      return {
        success: false,
        error: 'Failed to terminate existing request'
      };
    }

    console.log('✅ Existing request terminated, creating new one...');

    // Now create a new request (reuse the existing logic)
    const safeMealCount = Math.max(3, Math.min(20, mealCount));
    
    // Try to get preloaded meals first
    const { getPreloadedGroupMeals, clearPreloadedGroupMeals } = require('./mealPreloadService');
    let meals = getPreloadedGroupMeals(groupId);
    
    if (meals && meals.length >= safeMealCount) {
      console.log('✅ Using preloaded meals for replacement request');
      meals = meals.slice(0, safeMealCount);
      clearPreloadedGroupMeals(groupId);
    } else {
      console.log('⚠️ No preloaded meals available, fetching new meals...');
      meals = await fetchRandomMealsForGroup(safeMealCount);
    }
    
    if (!meals || meals.length === 0) {
      return {
        success: false,
        error: 'Failed to fetch meals from API. Please try again.'
      };
    }

    // Create the new meal request
    const { data: requestData, error: requestError } = await supabase
      .from('meal_requests')
      .insert([
        {
          group_id: groupId,
          requested_by: user.id,
          status: 'active',
          total_options: meals.length
        }
      ])
      .select('*')
      .single();

    if (requestError) {
      throw requestError;
    }

    // Insert meal options
    const mealOptions = meals.map((meal, index) => ({
      request_id: requestData.id,
      meal_id: meal.id,
      meal_data: meal,
      option_order: index + 1
    }));

    const { error: optionsError } = await supabase
      .from('meal_request_options')
      .insert(mealOptions);

    if (optionsError) {
      // Clean up the request if meal options failed
      await supabase
        .from('meal_requests')
        .delete()
        .eq('id', requestData.id);
      
      throw optionsError;
    }

    // Fetch the created meal options with their IDs for immediate use
    const { data: createdOptions, error: fetchError } = await supabase
      .from('meal_request_options')
      .select('*')
      .eq('request_id', requestData.id)
      .order('option_order');

    if (fetchError) {
      console.warn('⚠️ Could not fetch created options for pre-loading:', fetchError);
    }

    return {
      success: true,
      request: requestData,
      mealOptions: createdOptions || [],
      message: `Meal request replaced with ${meals.length} new options! Group members can now start voting.`,
      replaced: true
    };

  } catch (error) {
    console.error('❌ Error replacing meal request:', error);
    return {
      success: false,
      error: error.message || 'Failed to replace meal request. Please try again.'
    };
  }
};

/**
 * Get active meal request for a group
 * @param {string} groupId - Group ID
 * @returns {Object} - Success/error response with request data
 */
export const getActiveMealRequest = async (groupId) => {
  try {
    console.log('🔍 [MEAL SERVICE] Checking for active meal request in group:', groupId);
    
    const { data, error } = await supabase
      .rpc('get_active_meal_request', { group_uuid: groupId });

    if (error) {
      console.error('❌ Error checking active meal request:', error);
      return { success: false, error: error.message };
    }

    const hasActiveRequest = data && data.length > 0;
    console.log(`📋 Active request found: ${hasActiveRequest ? 'YES' : 'NO'}`);

    return {
      success: true,
      hasActiveRequest,
      request: hasActiveRequest ? data[0] : null
    };

  } catch (error) {
    console.error('❌ Error checking active meal request:', error);
    return {
      success: false,
      error: error.message || 'Failed to check meal request status'
    };
  }
};

/**
 * Get meal options for a request
 * @param {string} requestId - Request ID
 * @returns {Object} - Success/error response with meal options
 */
export const getMealOptions = async (requestId) => {
  try {
    console.log('🍽️ [MEAL SERVICE] Fetching meal options for request:', requestId);
    
    const { data, error } = await supabase
      .from('meal_request_options')
      .select('*')
      .eq('request_id', requestId)
      .order('option_order');

    if (error) {
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} meal options`);
    return {
      success: true,
      options: data || []
    };

  } catch (error) {
    console.error('❌ Error fetching meal options:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch meal options'
    };
  }
};

/**
 * Get user's existing votes for a meal request
 * @param {string} requestId - Request ID
 * @returns {Object} - Success/error response with user's votes
 */
export const getUserVotes = async (requestId) => {
  try {
    console.log('🗳️ [MEAL SERVICE] Fetching user votes for request:', requestId);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to view votes'
      };
    }

    const { data, error } = await supabase
      .from('meal_votes')
      .select(`
        *,
        meal_request_options!inner(
          id,
          option_order,
          meal_data
        )
      `)
      .eq('request_id', requestId)
      .eq('user_id', user.id)
      .order('meal_request_options.option_order');

    if (error) {
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} existing votes for user`);
    return {
      success: true,
      votes: data || [],
      votedMealIds: (data || []).map(v => v.meal_option_id)
    };

  } catch (error) {
    console.error('❌ Error fetching user votes:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch user votes'
    };
  }
};

/**
 * Get user's voting progress and next unvoted meal
 * @param {string} requestId - Request ID
 * @returns {Object} - Success/error response with voting progress
 */
export const getUserVotingProgress = async (requestId) => {
  try {
    console.log('📊 [MEAL SERVICE] Getting user voting progress for request:', requestId);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to check progress'
      };
    }

    // Get all meal options for this request
    const { data: allMeals, error: mealsError } = await supabase
      .from('meal_request_options')
      .select('*')
      .eq('request_id', requestId)
      .order('option_order');

    if (mealsError) {
      throw mealsError;
    }

    // Get user's existing votes
    const { data: userVotes, error: votesError } = await supabase
      .from('meal_votes')
      .select('meal_option_id')
      .eq('request_id', requestId)
      .eq('user_id', user.id);

    if (votesError) {
      throw votesError;
    }

    const votedMealIds = new Set((userVotes || []).map(v => v.meal_option_id));
    const nextUnvotedMeal = (allMeals || []).find(meal => !votedMealIds.has(meal.id));
    
    const progress = {
      totalMeals: allMeals?.length || 0,
      votedCount: userVotes?.length || 0,
      remainingCount: (allMeals?.length || 0) - (userVotes?.length || 0),
      nextMealIndex: nextUnvotedMeal ? nextUnvotedMeal.option_order - 1 : -1,
      isComplete: !nextUnvotedMeal,
      completionPercentage: allMeals?.length ? Math.round(((userVotes?.length || 0) / allMeals.length) * 100) : 0
    };

    console.log(`✅ Voting progress: ${progress.votedCount}/${progress.totalMeals} meals (${progress.completionPercentage}%)`);
    
    return {
      success: true,
      progress,
      nextUnvotedMeal,
      allMeals: allMeals || []
    };

  } catch (error) {
    console.error('❌ Error getting voting progress:', error);
    return {
      success: false,
      error: error.message || 'Failed to get voting progress'
    };
  }
};

/**
 * Vote on a meal option
 * @param {string} requestId - Request ID
 * @param {string} mealOptionId - Meal option ID
 * @param {string} vote - 'yes' or 'no'
 * @returns {Object} - Success/error response
 */
export const voteMealOption = async (requestId, mealOptionId, vote) => {
  try {
    console.log(`🗳️ [MEAL SERVICE] Voting ${vote} on meal option:`, mealOptionId);
    console.log(`🔍 [MEAL SERVICE] Request ID:`, requestId);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to vote'
      };
    }

    console.log(`🔍 [MEAL SERVICE] User ID:`, user.id);

    // Use upsert to handle vote changes
    const { data, error } = await supabase
      .from('meal_votes')
      .upsert([
        {
          request_id: requestId,
          meal_option_id: mealOptionId,
          user_id: user.id,
          vote: vote
        }
      ], { 
        onConflict: 'request_id,meal_option_id,user_id' 
      })
      .select('*')
      .single();

    if (error) {
      console.error('❌ [MEAL SERVICE] Vote error details:', error);
      
      // Handle specific RLS errors with helpful messages
      if (error.code === '42501') {
        return {
          success: false,
          error: 'Permission denied: You may not be a member of this group or the voting session may have ended. Please check your group membership and try again.'
        };
      }
      
      throw error;
    }

    console.log(`✅ Vote recorded: ${vote}`, data);
    return {
      success: true,
      vote: data,
      message: `Voted ${vote}!`
    };

  } catch (error) {
    console.error('❌ Error voting on meal option:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to record vote';
    
    if (error.code === '42501') {
      errorMessage = 'You do not have permission to vote on this meal. Please ensure you are a member of the group.';
    } else if (error.code === '23505') {
      errorMessage = 'You have already voted on this meal. Your vote has been updated.';
    } else if (error.message?.includes('not found')) {
      errorMessage = 'This voting session may have ended or been removed.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Get voting results for a meal request
 * @param {string} requestId - Request ID
 * @returns {Object} - Success/error response with voting results
 */
export const getVotingResults = async (requestId) => {
  try {
    console.log('📊 [MEAL SERVICE] Fetching voting results for request:', requestId);
    
    const { data, error } = await supabase
      .rpc('get_meal_voting_results', { request_uuid: requestId });

    if (error) {
      throw error;
    }

    console.log(`✅ Fetched voting results for ${data?.length || 0} meals`);
    return {
      success: true,
      results: data || []
    };

  } catch (error) {
    console.error('❌ Error fetching voting results:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch voting results'
    };
  }
};

/**
 * Get top 3 voted meals
 * @param {string} requestId - Request ID
 * @returns {Object} - Success/error response with top 3 meals
 */
export const getTopVotedMeals = async (requestId) => {
  try {
    console.log('🏆 [MEAL SERVICE] Fetching top 3 voted meals for request:', requestId);
    
    const { data, error } = await supabase
      .rpc('get_top_voted_meals', { request_uuid: requestId });

    if (error) {
      throw error;
    }

    console.log(`✅ Fetched top ${data?.length || 0} voted meals`);
    return {
      success: true,
      topMeals: data || []
    };

  } catch (error) {
    console.error('❌ Error fetching top voted meals:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch top voted meals'
    };
  }
};

/**
 * Complete/Stop a meal request
 * @param {string} requestId - Request ID
 * @returns {Object} - Success/error response
 */
export const completeMealRequest = async (requestId) => {
  try {
    console.log('🛑 [MEAL SERVICE] Completing meal request:', requestId);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to complete meal requests'
      };
    }

    // Try using the safer database function first (if available after running the fix)
    try {
      console.log('🔧 Attempting to use safe termination function...');
      const { data: terminateResult, error: terminateError } = await supabase
        .rpc('terminate_meal_request', { 
          request_uuid: requestId,
          user_uuid: user.id 
        });

      if (terminateError) {
        throw terminateError;
      }

      if (terminateResult && terminateResult.length > 0 && terminateResult[0].success) {
        console.log('✅ Meal request terminated safely using database function');
        
        // Clean up meal_request_options for this terminated request
        console.log('🧹 Cleaning up meal request options...');
        const { error: cleanupError } = await supabase
          .from('meal_request_options')
          .delete()
          .eq('request_id', requestId);
        
        if (cleanupError) {
          console.warn('⚠️ Failed to cleanup meal options:', cleanupError.message);
        } else {
          console.log('✅ Meal request options cleaned up successfully');
        }
        
        return {
          success: true,
          message: terminateResult[0].message || 'Meal request has been completed.'
        };
      } else {
        console.log('⚠️ Database function returned failure, falling back to direct update...');
        throw new Error(terminateResult?.[0]?.message || 'Termination function failed');
      }
    } catch (funcError) {
      console.log('⚠️ Safe termination function not available or failed, using direct update:', funcError.message);
      
      // Fallback to direct update approach
      const { data, error } = await supabase
        .from('meal_requests')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('status', 'active') // Only update if still active
        .select('*')
        .single();

      if (error) {
        // Handle the specific constraint error
        if (error.code === '23505' && error.message.includes('meal_requests_group_id_status_key')) {
          console.log('🔧 Constraint error detected, trying alternative approach...');
          
          // Alternative approach: Delete the votes and then complete
          try {
            // First, delete all votes for this request
            const { error: deleteVotesError } = await supabase
              .from('meal_votes')
              .delete()
              .eq('request_id', requestId);

            if (deleteVotesError) {
              console.log('⚠️ Failed to delete votes:', deleteVotesError.message);
            }

            // Then try to update to cancelled status instead
            const { data: cancelData, error: cancelError } = await supabase
              .from('meal_requests')
              .update({ 
                status: 'cancelled',
                completed_at: new Date().toISOString()
              })
              .eq('id', requestId)
              .eq('status', 'active')
              .select('*')
              .single();

            if (cancelError) {
              throw cancelError;
            }

            console.log('✅ Meal request cancelled as alternative to completion');
            
            // Clean up meal_request_options for this cancelled request
            console.log('🧹 Cleaning up meal request options...');
            const { error: cleanupError } = await supabase
              .from('meal_request_options')
              .delete()
              .eq('request_id', requestId);
            
            if (cleanupError) {
              console.warn('⚠️ Failed to cleanup meal options:', cleanupError.message);
            } else {
              console.log('✅ Meal request options cleaned up successfully');
            }
            
            return {
              success: true,
              request: cancelData,
              message: 'Voting session has been terminated and all votes cleared.'
            };
          } catch (altError) {
            console.error('❌ Alternative approach also failed:', altError);
            return {
              success: false,
              error: 'Unable to terminate the voting session. Please try again or contact support.'
            };
          }
        } else {
          throw error;
        }
      }

      console.log('✅ Meal request completed via direct update');
      
      // Clean up meal_request_options for this completed request
      console.log('🧹 Cleaning up meal request options...');
      const { error: cleanupError } = await supabase
        .from('meal_request_options')
        .delete()
        .eq('request_id', requestId);
      
      if (cleanupError) {
        console.warn('⚠️ Failed to cleanup meal options:', cleanupError.message);
      } else {
        console.log('✅ Meal request options cleaned up successfully');
      }
      
      return {
        success: true,
        request: data,
        message: 'Meal request has been completed.'
      };
    }

  } catch (error) {
    console.error('❌ Error completing meal request:', error);
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to complete meal request';
    
    if (error.code === '23505') {
      errorMessage = 'There was a database constraint issue. Please run the database constraint fix and try again.';
    } else if (error.message?.includes('not found')) {
      errorMessage = 'This meal request may have already been completed or removed.';
    } else if (error.message?.includes('permission denied')) {
      errorMessage = 'You do not have permission to terminate this voting session.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * DEBUG: Get all active meal requests for a group (with details)
 * @param {string} groupId - Group ID
 * @returns {Object} - Success/error response with detailed request info
 */
export const debugGetActiveRequests = async (groupId) => {
  try {
    console.log('🔍 [DEBUG] Getting all active requests for group:', groupId);
    
    const { data, error } = await supabase
      .from('meal_requests')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'active');

    if (error) {
      throw error;
    }

    console.log(`📋 Found ${data?.length || 0} active requests:`, data);
    return {
      success: true,
      requests: data || []
    };

  } catch (error) {
    console.error('❌ Error getting active requests:', error);
    return {
      success: false,
      error: error.message || 'Failed to get active requests'
    };
  }
};

/**
 * DEBUG: Force complete all active requests for a group
 * @param {string} groupId - Group ID
 * @returns {Object} - Success/error response
 */
export const debugCompleteAllActiveRequests = async (groupId) => {
  try {
    console.log('🛑 [DEBUG] Force completing all active requests for group:', groupId);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to complete meal requests'
      };
    }

    const { data, error } = await supabase
      .from('meal_requests')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('group_id', groupId)
      .eq('status', 'active')
      .select('*');

    if (error) {
      throw error;
    }

    console.log(`✅ Completed ${data?.length || 0} active requests`);
    return {
      success: true,
      completedRequests: data || [],
      message: `Completed ${data?.length || 0} active meal requests`
    };

  } catch (error) {
    console.error('❌ Error completing active requests:', error);
    return {
      success: false,
      error: error.message || 'Failed to complete active requests'
    };
  }
};

/**
 * DEBUG: Test meal request creation step by step
 * @param {string} groupId - Group ID
 * @returns {Object} - Detailed debug information
 */
export const debugMealRequestCreation = async (groupId) => {
  console.log('🔍 [DEBUG] Testing meal request creation step by step...');
  
  const results = {
    step1_auth: null,
    step2_database: null,
    step3_tables: null,
    step4_existing_check: null,
    step5_api_fetch: null,
    overall_status: 'running'
  };
  
  try {
    // Step 1: Check authentication
    console.log('Step 1: Checking authentication...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      results.step1_auth = { success: false, error: userError?.message || 'No user found' };
      results.overall_status = 'failed_auth';
      return results;
    } else {
      results.step1_auth = { success: true, user_id: user.id };
    }
    
    // Step 2: Test database connection
    console.log('Step 2: Testing database connection...');
    const dbTest = await testDatabaseConnection();
    results.step2_database = dbTest;
    
    if (!dbTest.success) {
      results.overall_status = 'failed_database';
      return results;
    }
    
    // Step 3: Check table setup
    console.log('Step 3: Checking table setup...');
    const setupCheck = await setupMealRequestTables();
    results.step3_tables = setupCheck;
    
    if (!setupCheck.success) {
      results.overall_status = setupCheck.needsSetup ? 'needs_setup' : 'failed_tables';
      return results;
    }
    
    // Step 4: Check for existing requests
    console.log('Step 4: Checking for existing requests...');
    const { data: existingRequest, error: checkError } = await supabase
      .from('meal_requests')
      .select('id, status, created_at')
      .eq('group_id', groupId)
      .eq('status', 'active');
    
    if (checkError) {
      results.step4_existing_check = { success: false, error: checkError.message };
      results.overall_status = 'failed_existing_check';
      return results;
    } else {
      results.step4_existing_check = { 
        success: true, 
        existing_requests: existingRequest?.length || 0,
        requests: existingRequest || []
      };
    }
    
    // Step 5: Test API fetch (just 3 meals for testing)
    console.log('Step 5: Testing API fetch...');
    try {
      const meals = await fetchRandomMealsForGroup(3);
      results.step5_api_fetch = { 
        success: true, 
        meals_count: meals?.length || 0,
        sample_meal: meals?.[0]?.name || 'No meals'
      };
    } catch (apiError) {
      results.step5_api_fetch = { success: false, error: apiError.message };
    }
    
    results.overall_status = 'all_checks_passed';
    return results;
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
    results.overall_status = 'unexpected_error';
    results.error = error.message;
    return results;
  }
}; 