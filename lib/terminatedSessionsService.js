import { supabase } from './supabase';

export const terminatedSessionsService = {
  /**
   * Save terminated session results to permanent storage
   */
  async saveTerminatedSession(groupId, groupName, topResults, memberResponses) {
    try {
      console.log('💾 [TERMINATED] Saving terminated session for group:', groupName);
      
      // First, check if there's already a terminated session for this group
      const { data: existingSession, error: checkError } = await supabase
        .from('terminated_sessions')
        .select('*')
        .eq('group_id', groupId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing terminated session:', checkError);
        return { success: false, error: checkError };
      }
      
      const sessionData = {
        group_id: groupId,
        group_name: groupName,
        top_results: topResults,
        member_responses: memberResponses,
        terminated_at: new Date().toISOString()
      };
      
      let result;
      if (existingSession) {
        // Update existing session
        result = await supabase
          .from('terminated_sessions')
          .update(sessionData)
          .eq('group_id', groupId);
      } else {
        // Insert new session
        result = await supabase
          .from('terminated_sessions')
          .insert([sessionData]);
      }
      
      if (result.error) {
        console.error('Error saving terminated session:', result.error);
        return { success: false, error: result.error };
      }
      
      console.log('✅ [TERMINATED] Successfully saved terminated session');
      return { success: true, data: result.data };
      
    } catch (error) {
      console.error('Error in saveTerminatedSession:', error);
      return { success: false, error };
    }
  },

  /**
   * Get terminated session results for a group
   */
  async getTerminatedSession(groupId) {
    try {
      const { data, error } = await supabase
        .from('terminated_sessions')
        .select('*')
        .eq('group_id', groupId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No terminated session found
          return { success: true, data: null };
        }
        console.error('Error getting terminated session:', error);
        return { success: false, error };
      }
      
      return { success: true, data };
      
    } catch (error) {
      console.error('Error in getTerminatedSession:', error);
      return { success: false, error };
    }
  },

  /**
   * Clear terminated session results for a group
   */
  async clearTerminatedSession(groupId) {
    try {
      console.log('🗑️ [TERMINATED] Clearing terminated session for group:', groupId);
      
      const { error } = await supabase
        .from('terminated_sessions')
        .delete()
        .eq('group_id', groupId);
      
      if (error) {
        console.error('Error clearing terminated session:', error);
        return { success: false, error };
      }
      
      console.log('✅ [TERMINATED] Successfully cleared terminated session');
      return { success: true };
      
    } catch (error) {
      console.error('Error in clearTerminatedSession:', error);
      return { success: false, error };
    }
  },

  /**
   * Clean up all active session data for a group
   */
  async cleanupActiveSession(groupId) {
    try {
      console.log('🧹 [CLEANUP] Cleaning up active session data for group:', groupId);
      
      let cleanupErrors = [];
      
      // First get all dinner requests for this group to find their IDs
      const dinnerRequestsQuery = await supabase
        .from('dinner_requests')
        .select('id')
        .eq('group_id', groupId);
      
      if (dinnerRequestsQuery.error) {
        console.error('Error querying dinner requests:', dinnerRequestsQuery.error);
        cleanupErrors.push(`Query dinner requests: ${dinnerRequestsQuery.error.message}`);
      }
      
      // Delete dinner request responses first (they reference dinner requests)
      if (dinnerRequestsQuery.data && dinnerRequestsQuery.data.length > 0) {
        const dinnerRequestIds = dinnerRequestsQuery.data.map(req => req.id);
        
        const responsesResult = await supabase
          .from('dinner_request_responses')
          .delete()
          .in('request_id', dinnerRequestIds);
        
        if (responsesResult.error) {
          console.error('Error deleting dinner request responses:', responsesResult.error);
          cleanupErrors.push(`Delete responses: ${responsesResult.error.message}`);
        } else {
          console.log('✅ [CLEANUP] Deleted dinner request responses');
        }
      }
      
      // Delete all meal requests for this group
      const mealRequestsResult = await supabase
        .from('meal_requests')
        .delete()
        .eq('group_id', groupId);
      
      if (mealRequestsResult.error) {
        console.error('Error deleting meal requests:', mealRequestsResult.error);
        cleanupErrors.push(`Delete meal requests: ${mealRequestsResult.error.message}`);
      } else {
        console.log('✅ [CLEANUP] Deleted meal requests');
      }
      
      // Delete all dinner requests for this group
      const dinnerRequestsResult = await supabase
        .from('dinner_requests')
        .delete()
        .eq('group_id', groupId);
      
      if (dinnerRequestsResult.error) {
        console.error('Error deleting dinner requests:', dinnerRequestsResult.error);
        cleanupErrors.push(`Delete dinner requests: ${dinnerRequestsResult.error.message}`);
      } else {
        console.log('✅ [CLEANUP] Deleted dinner requests');
      }
      
      // Also try to delete any meal votes for this group
      // First get meal request IDs for this group
      const mealRequestsQuery = await supabase
        .from('meal_requests')
        .select('id')
        .eq('group_id', groupId);
      
      if (mealRequestsQuery.data && mealRequestsQuery.data.length > 0) {
        const mealRequestIds = mealRequestsQuery.data.map(req => req.id);
        
        const mealVotesResult = await supabase
          .from('meal_votes')
          .delete()
          .in('request_id', mealRequestIds);
        
        if (mealVotesResult.error) {
          console.error('Error deleting meal votes:', mealVotesResult.error);
          cleanupErrors.push(`Delete meal votes: ${mealVotesResult.error.message}`);
        } else {
          console.log('✅ [CLEANUP] Deleted meal votes');
        }
      }
      
      if (cleanupErrors.length > 0) {
        console.warn('⚠️ [CLEANUP] Some cleanup operations failed:', cleanupErrors);
        return { 
          success: false, 
          error: `Cleanup partially failed: ${cleanupErrors.join(', ')}`,
          partialSuccess: true 
        };
      }
      
      console.log('✅ [CLEANUP] Successfully cleaned up all active session data');
      return { success: true };
      
    } catch (error) {
      console.error('Error in cleanupActiveSession:', error);
      return { success: false, error };
    }
  }
}; 