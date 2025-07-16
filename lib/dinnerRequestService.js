import { supabase } from './supabase';

/**
 * Saves a dinner request to the database
 * Replaces any existing request for the same group
 * @param {Object} requestData - The dinner request data
 * @returns {Object} - Success/error response
 */
export const saveDinnerRequest = async (requestData) => {
  console.log('💾 [SERVICE] Saving dinner request:', requestData);
  
  try {
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to send dinner requests'
      };
    }

    // Prepare the request data for database
    const dinnerRequest = {
      group_id: requestData.groupId,
      requester_id: user.id,
      request_date: requestData.date, // Should be in YYYY-MM-DD format
      request_time: requestData.time, // Should be in HH:MM:SS format
      recipe_type: requestData.recipeType,
      deadline: `${requestData.date}T${requestData.deadlineTime}`, // Convert to timestamp
      status: 'pending'
    };

    console.log('📝 Prepared dinner request data:', dinnerRequest);

    // First, delete any existing pending requests for this group
    console.log('🗑️ Deleting existing requests for group:', requestData.groupId);
    const { data: deletedData, error: deleteError } = await supabase
      .from('dinner_requests')
      .delete()
      .eq('group_id', requestData.groupId)
      .eq('status', 'pending')
      .select();

    if (deleteError) {
      console.error('⚠️ Error deleting existing requests:', deleteError);
      // Continue anyway - maybe there were no existing requests
    } else {
      console.log('✅ Deleted existing requests:', deletedData?.length || 0);
    }

    // Insert the new request
    console.log('➕ Inserting new dinner request...');
    const { data, error } = await supabase
      .from('dinner_requests')
      .insert(dinnerRequest)
      .select(); // Get the inserted data back

    console.log('📝 Inserted data:', data);
    console.log('❌ Insert error (if any):', error);

    if (error) {
      console.error('❌ Error saving dinner request:', error);
      console.error('❌ Error details:', error.message, error.code, error.hint);
      return {
        success: false,
        error: error.message || 'Failed to save dinner request'
      };
    }

    console.log('✅ Dinner request saved successfully');
    
    // Automatically create meal session with 10 meals
    console.log('🍽️ Auto-creating meal session with 10 meals...');
    try {
      // Import the meal service to create meal session
      const { createMealRequest } = await import('./mealRequestService');
      
      const mealResult = await createMealRequest(requestData.groupId, 10);
      
      if (mealResult.success) {
        console.log('✅ Meal session auto-created successfully');
        return {
          success: true,
          message: 'Dinner request sent and meal voting session created with 10 options!',
          mealSessionCreated: true,
          mealRequestId: mealResult.request.id
        };
      } else {
        console.warn('⚠️ Dinner request saved but meal session creation failed:', mealResult.error);
        return {
          success: true,
          
          mealSessionCreated: false
        };
      }
    } catch (error) {
      console.error('❌ Error auto-creating meal session:', error);
      return {
        success: true,
        
        mealSessionCreated: false
      };
    }

  } catch (error) {
    console.error('❌ Unexpected error saving dinner request:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Gets all pending dinner requests for the user's groups
 * @returns {Object} - Success/error response with requests array
 */
export const getAllDinnerRequests = async () => {
  console.log('📥 [SERVICE] Loading all dinner requests...');
  
  try {
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to view dinner requests'
      };
    }

    console.log('🔍 Looking for dinner requests for user:', user.id);

    // First, let's check what groups the user is in
    console.log('👥 Checking user groups...');
    const { data: userGroups, error: groupError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (groupError) {
      console.error('❌ Error loading user groups:', groupError);
    } else {
      console.log('✅ User is in groups:', userGroups?.map(g => g.group_id));
    }

    // Query the table directly to get ALL pending requests from user's groups
    console.log('🔍 Querying dinner_requests table (simple query first)...');
    const { data: simpleRequestData, error: simpleError } = await supabase
      .from('dinner_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    console.log('📋 Simple query result:', simpleRequestData);
    console.log('❌ Simple query error (if any):', simpleError);

    // Now try with the join
    console.log('🔍 Querying dinner_requests table (with join)...');
    const { data: requestData, error } = await supabase
      .from('dinner_requests')
      .select(`
        id,
        group_id,
        groups!dinner_requests_group_id_fkey(name),
        requester_id,
        request_date,
        request_time,
        recipe_type,
        deadline,
        status,
        created_at
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    console.log('📋 Join query result:', requestData);
    console.log('❌ Join query error (if any):', error);

    if (error) {
      console.error('❌ Error loading dinner request:', error);
      console.error('❌ Error details:', error.message, error.code, error.hint);
      return {
        success: false,
        error: error.message || 'Failed to load dinner requests'
      };
    }

    if (!requestData || requestData.length === 0) {
      console.log('📭 No dinner requests found');
      return {
        success: true,
        requests: [],
        message: 'No pending dinner requests found'
      };
    }

    console.log(`✅ Found ${requestData.length} dinner requests`);

    // Format all requests for the frontend
    const formattedRequests = requestData.map(request => {
      // Get requester name - for now use a generic name
      // We could enhance this later by storing names in the request or user_profiles table
      let requesterName = 'Group Member';
      if (request.requester_id === user.id) {
        // If it's the current user's request, use their info
        requesterName = user.user_metadata?.full_name || 
                      user.user_metadata?.name || 
                      user.email?.split('@')[0] || 
                      'You';
      }

      return {
        id: request.id,
        groupId: request.group_id,
        groupName: request.groups?.name || 'Unknown Group',
        requesterId: request.requester_id,
        requesterName: requesterName,
        date: request.request_date,
        time: request.request_time,
        recipeType: request.recipe_type,
        deadline: request.deadline, // This is now a full timestamp
        status: request.status,
        createdAt: request.created_at
      };
    });

    return {
      success: true,
      requests: formattedRequests,
      totalCount: formattedRequests.length
    };

  } catch (error) {
    console.error('❌ Unexpected error loading dinner request:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Records individual user response to a dinner request
 * @param {string} requestId - The ID of the request to respond to
 * @param {string} response - The user's response ('accepted' or 'declined')
 * @returns {Object} - Success/error response with readiness info
 */
export const recordUserResponse = async (requestId, response) => {
  console.log(`📝 [SERVICE] Recording user response ${response} for request:`, requestId);
  
  try {
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to respond to dinner requests'
      };
    }

    // Insert or update user's response
    const { data: responseData, error: responseError } = await supabase
      .from('dinner_request_responses')
      .upsert({
        request_id: requestId,
        user_id: user.id,
        response: response,
        responded_at: new Date().toISOString()
      }, {
        onConflict: 'request_id,user_id'
      })
      .select();

    if (responseError) {
      console.error('❌ Error recording response:', responseError);
      return {
        success: false,
        error: responseError.message || 'Failed to record response'
      };
    }

    console.log('✅ User response recorded successfully');

    // Check if request is ready for meal creation (simplified)
    let readiness = null;
    try {
      // Get group member count and response counts
      const { data: requestInfo, error: requestInfoError } = await supabase
        .from('dinner_requests')
        .select('group_id')
        .eq('id', requestId)
        .single();

      if (!requestInfoError && requestInfo) {
        // Count group members
        const { count: memberCount } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', requestInfo.group_id)
          .eq('is_active', true);

        // Count responses
        const { count: responseCount } = await supabase
          .from('dinner_request_responses')
          .select('*', { count: 'exact', head: true })
          .eq('request_id', requestId);

        // Count accepted responses
        const { count: acceptedCount } = await supabase
          .from('dinner_request_responses')
          .select('*', { count: 'exact', head: true })
          .eq('request_id', requestId)
          .eq('response', 'accepted');

        readiness = {
          is_ready: (responseCount >= (memberCount / 2)) && (acceptedCount >= 2),
          total_members: memberCount || 0,
          responses_count: responseCount || 0,
          accepted_count: acceptedCount || 0,
          group_id: requestInfo.group_id,
          requester_id: user.id
        };
      }
    } catch (readinessError) {
      console.error('⚠️ Error checking readiness:', readinessError);
      // Continue anyway - response was saved
    }
    
    return {
      success: true,
      message: `Response recorded successfully!`,
      responseRecorded: true,
      readiness: readiness || null
    };

  } catch (error) {
    console.error('❌ Unexpected error recording response:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Gets all responses for a dinner request
 * @param {string} requestId - The ID of the request to get responses for
 * @returns {Object} - Success/error response with responses data
 */
export const getRequestResponses = async (requestId) => {
  console.log('📥 [SERVICE] Loading responses for request:', requestId);
  
  try {
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to view responses'
      };
    }

    // Get responses using simple query
    const { data: responsesData, error } = await supabase
      .from('dinner_request_responses')
      .select('user_id, response, responded_at')
      .eq('request_id', requestId)
      .order('responded_at', { ascending: false });

    if (error) {
      console.error('❌ Error loading responses:', error);
      return {
        success: false,
        error: error.message || 'Failed to load responses'
      };
    }

    console.log('✅ Loaded responses:', responsesData);

    // Get group member count for context
    let totalMembers = 0;
    try {
      const { data: requestInfo } = await supabase
        .from('dinner_requests')
        .select('group_id')
        .eq('id', requestId)
        .single();

      if (requestInfo) {
        const { count } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', requestInfo.group_id)
          .eq('is_active', true);
        
        totalMembers = count || 0;
      }
    } catch (error) {
      console.log('⚠️ Could not get member count:', error);
    }

    return {
      success: true,
      responses: responsesData || [],
      totalMembers: totalMembers,
      responsesCount: responsesData?.length || 0
    };

  } catch (error) {
    console.error('❌ Unexpected error loading responses:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Creates a meal voting session from a dinner request when ready
 * @param {string} requestId - The ID of the dinner request
 * @returns {Object} - Success/error response
 */
export const createMealFromRequest = async (requestId) => {
  console.log('🍽️ [SERVICE] Creating meal session from request:', requestId);
  
  try {
    // Import the meal service dynamically to avoid circular imports
    const { createMealRequest } = await import('./mealRequestService');
    
    // Get request details
    const { data: requestData, error: requestError } = await supabase
      .from('dinner_requests')
      .select('group_id, requester_id, recipe_type')
      .eq('id', requestId)
      .single();

    if (requestError || !requestData) {
      return {
        success: false,
        error: 'Could not find dinner request details'
      };
    }

    // Create the meal voting session
    const mealResult = await createMealRequest(requestData.group_id, 20); // 20 meal options

    if (mealResult.success) {
      // Update dinner request status to completed
      await supabase
        .from('dinner_requests')
        .update({ status: 'completed' })
        .eq('id', requestId);
        
      console.log('✅ Meal session created successfully');
      return {
        success: true,
        mealRequestId: mealResult.requestId,
        message: 'Meal voting session created successfully!'
      };
    } else {
      return {
        success: false,
        error: mealResult.error || 'Failed to create meal session'
      };
    }

  } catch (error) {
    console.error('❌ Unexpected error creating meal session:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Gets member response status for a group's active dinner request
 * @param {string} groupId - The ID of the group
 * @returns {Object} - Success/error response with member status
 */
export const getGroupMemberResponses = async (groupId) => {
  console.log('👥 [SERVICE] Loading member responses for group:', groupId);
  
  try {
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to view member responses'
      };
    }

    // Get active dinner request for the group
    const { data: requestData, error: requestError } = await supabase
      .from('dinner_requests')
      .select('id, requester_id, request_date, request_time, deadline, recipe_type')
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (requestError) {
      return {
        success: false,
        error: requestError.message
      };
    }

    if (!requestData || requestData.length === 0) {
      return {
        success: true,
        hasActiveRequest: false,
        memberResponses: []
      };
    }

    const activeRequest = requestData[0];

    // Get all group members
    const { data: membersData, error: membersError } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('is_active', true);

    if (membersError) {
      return {
        success: false,
        error: membersError.message
      };
    }

    // Get responses for the active request
    const { data: responsesData, error: responsesError } = await supabase
      .from('dinner_request_responses')
      .select('user_id, response, responded_at')
      .eq('request_id', activeRequest.id);

    if (responsesError) {
      return {
        success: false,
        error: responsesError.message
      };
    }

    // Create a map of user responses
    const responseMap = {};
    responsesData.forEach(response => {
      responseMap[response.user_id] = response;
    });

    // Combine member list with response status
    const memberResponses = membersData.map(member => ({
      userId: member.user_id,
      response: responseMap[member.user_id]?.response || 'pending',
      respondedAt: responseMap[member.user_id]?.responded_at || null
    }));

    const acceptedCount = memberResponses.filter(m => m.response === 'accepted').length;
    const declinedCount = memberResponses.filter(m => m.response === 'declined').length;
    const pendingCount = memberResponses.filter(m => m.response === 'pending').length;

    return {
      success: true,
      hasActiveRequest: true,
      activeRequest: {
        id: activeRequest.id,
        requesterId: activeRequest.requester_id,
        requesterName: 'Group Member', // We'll get this from user data if needed
        requestDate: activeRequest.request_date,
        requestTime: activeRequest.request_time,
        deadline: activeRequest.deadline,
        recipeType: activeRequest.recipe_type
      },
      memberResponses,
      summary: {
        total: memberResponses.length,
        accepted: acceptedCount,
        declined: declinedCount,
        pending: pendingCount
      }
    };

  } catch (error) {
    console.error('❌ Unexpected error loading member responses:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Completes/terminates a dinner request
 * @param {string} requestId - The ID of the dinner request to complete
 * @returns {Object} - Success/error response
 */
export const completeDinnerRequest = async (requestId) => {
  console.log('🛑 [SERVICE] Completing dinner request:', requestId);
  
  try {
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'You must be signed in to complete dinner requests'
      };
    }

    // Update the dinner request status to completed
    const { data, error } = await supabase
      .from('dinner_requests')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .eq('status', 'pending') // Only update if still pending
      .select('*')
      .single();

    if (error) {
      console.error('❌ Error completing dinner request:', error);
      return {
        success: false,
        error: error.message || 'Failed to complete dinner request'
      };
    }

    console.log('✅ Dinner request completed successfully');
    return {
      success: true,
      request: data,
      message: 'Dinner request has been completed.'
    };

  } catch (error) {
    console.error('❌ Unexpected error completing dinner request:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}; 