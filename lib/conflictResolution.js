import { supabase } from './supabase';

/**
 * Service to handle conflicts and cleanup leftover active sessions
 */
class ConflictResolutionService {
  
  /**
   * Check for and resolve conflicts before creating a new dinner request
   * @param {string} groupId - Group ID to check
   * @returns {Promise<Object>} - Conflict resolution result
   */
  async resolveGroupConflicts(groupId) {
    console.log('🔍 [CONFLICT] Checking for conflicts in group:', groupId);
    
    try {
      // Check for active meal requests
      const activeMealRequests = await this.getActiveMealRequests(groupId);
      
      // Check for pending dinner requests
      const pendingDinnerRequests = await this.getPendingDinnerRequests(groupId);
      
      // Check for terminated session results
      const terminatedResults = await this.getTerminatedResults(groupId);
      
      const conflicts = [];
      
      if (activeMealRequests.length > 0) {
        conflicts.push({
          type: 'active_meal_request',
          count: activeMealRequests.length,
          requests: activeMealRequests
        });
      }
      
      if (pendingDinnerRequests.length > 0) {
        conflicts.push({
          type: 'pending_dinner_request', 
          count: pendingDinnerRequests.length,
          requests: pendingDinnerRequests
        });
      }
      
      if (terminatedResults) {
        conflicts.push({
          type: 'terminated_results',
          data: terminatedResults
        });
      }
      
      console.log(`🔍 [CONFLICT] Found ${conflicts.length} conflict types`);
      
      return {
        success: true,
        hasConflicts: conflicts.length > 0,
        conflicts: conflicts,
        requiresCleanup: conflicts.some(c => c.type !== 'terminated_results')
      };
      
    } catch (error) {
      console.error('❌ [CONFLICT] Error checking conflicts:', error);
      return {
        success: false,
        error: error.message,
        hasConflicts: false
      };
    }
  }
  
  /**
   * Clean up all conflicts for a group
   * @param {string} groupId - Group ID to clean up
   * @returns {Promise<Object>} - Cleanup result
   */
  async cleanupGroupConflicts(groupId) {
    console.log('🧹 [CONFLICT] Starting cleanup for group:', groupId);
    
    const cleanupResults = {
      mealRequests: 0,
      dinnerRequests: 0,
      mealOptions: 0,
      mealVotes: 0,
      dinnerResponses: 0,
      terminatedResults: false,
      errors: []
    };
    
    try {
      // 1. Clean up meal votes first (they reference meal requests)
      const mealVotesResult = await this.cleanupMealVotes(groupId);
      cleanupResults.mealVotes = mealVotesResult.count;
      if (mealVotesResult.error) cleanupResults.errors.push(mealVotesResult.error);
      
      // 2. Clean up meal options (they reference meal requests)
      const mealOptionsResult = await this.cleanupMealOptions(groupId);
      cleanupResults.mealOptions = mealOptionsResult.count;
      if (mealOptionsResult.error) cleanupResults.errors.push(mealOptionsResult.error);
      
      // 3. Clean up dinner request responses
      const dinnerResponsesResult = await this.cleanupDinnerResponses(groupId);
      cleanupResults.dinnerResponses = dinnerResponsesResult.count;
      if (dinnerResponsesResult.error) cleanupResults.errors.push(dinnerResponsesResult.error);
      
      // 4. Clean up meal requests
      const mealRequestsResult = await this.cleanupMealRequests(groupId);
      cleanupResults.mealRequests = mealRequestsResult.count;
      if (mealRequestsResult.error) cleanupResults.errors.push(mealRequestsResult.error);
      
      // 5. Clean up dinner requests  
      const dinnerRequestsResult = await this.cleanupDinnerRequests(groupId);
      cleanupResults.dinnerRequests = dinnerRequestsResult.count;
      if (dinnerRequestsResult.error) cleanupResults.errors.push(dinnerRequestsResult.error);
      
      // 6. Clear terminated results
      const terminatedResult = await this.clearTerminatedResults(groupId);
      cleanupResults.terminatedResults = terminatedResult.success;
      if (terminatedResult.error) cleanupResults.errors.push(terminatedResult.error);
      
      console.log('✅ [CONFLICT] Cleanup completed:', cleanupResults);
      
      return {
        success: cleanupResults.errors.length === 0,
        results: cleanupResults,
        message: `Cleaned up ${cleanupResults.mealRequests} meal requests, ${cleanupResults.dinnerRequests} dinner requests, ${cleanupResults.mealOptions} meal options, ${cleanupResults.mealVotes} votes, ${cleanupResults.dinnerResponses} responses`
      };
      
    } catch (error) {
      console.error('❌ [CONFLICT] Error during cleanup:', error);
      cleanupResults.errors.push(error.message);
      
      return {
        success: false,
        error: error.message,
        results: cleanupResults
      };
    }
  }
  
  /**
   * Get active meal requests for a group
   */
  async getActiveMealRequests(groupId) {
    try {
      const { data, error } = await supabase
        .from('meal_requests')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error getting active meal requests:', error);
      return [];
    }
  }
  
  /**
   * Get pending dinner requests for a group
   */
  async getPendingDinnerRequests(groupId) {
    try {
      const { data, error } = await supabase
        .from('dinner_requests')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'pending');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error getting pending dinner requests:', error);
      return [];
    }
  }
  
  /**
   * Get terminated session results for a group
   */
  async getTerminatedResults(groupId) {
    try {
      const { data, error } = await supabase
        .from('terminated_sessions')
        .select('*')
        .eq('group_id', groupId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('❌ Error getting terminated results:', error);
      return null;
    }
  }
  
  /**
   * Clean up meal votes for a group
   */
  async cleanupMealVotes(groupId) {
    try {
      // First get all meal request IDs for this group
      const { data: mealRequests } = await supabase
        .from('meal_requests')
        .select('id')
        .eq('group_id', groupId);
      
      if (!mealRequests || mealRequests.length === 0) {
        return { count: 0 };
      }
      
      const requestIds = mealRequests.map(req => req.id);
      
      const { error, count } = await supabase
        .from('meal_votes')
        .delete()
        .in('request_id', requestIds);
      
      if (error) throw error;
      
      console.log(`🧹 [CONFLICT] Cleaned up ${count || 0} meal votes`);
      return { count: count || 0 };
    } catch (error) {
      console.error('❌ Error cleaning meal votes:', error);
      return { count: 0, error: error.message };
    }
  }
  
  /**
   * Clean up meal options for a group
   */
  async cleanupMealOptions(groupId) {
    try {
      // First get all meal request IDs for this group
      const { data: mealRequests } = await supabase
        .from('meal_requests')
        .select('id')
        .eq('group_id', groupId);
      
      if (!mealRequests || mealRequests.length === 0) {
        return { count: 0 };
      }
      
      const requestIds = mealRequests.map(req => req.id);
      
      const { error, count } = await supabase
        .from('meal_request_options')
        .delete()
        .in('request_id', requestIds);
      
      if (error) throw error;
      
      console.log(`🧹 [CONFLICT] Cleaned up ${count || 0} meal options`);
      return { count: count || 0 };
    } catch (error) {
      console.error('❌ Error cleaning meal options:', error);
      return { count: 0, error: error.message };
    }
  }
  
  /**
   * Clean up dinner request responses for a group
   */
  async cleanupDinnerResponses(groupId) {
    try {
      // First get all dinner request IDs for this group
      const { data: dinnerRequests } = await supabase
        .from('dinner_requests')
        .select('id')
        .eq('group_id', groupId);
      
      if (!dinnerRequests || dinnerRequests.length === 0) {
        return { count: 0 };
      }
      
      const requestIds = dinnerRequests.map(req => req.id);
      
      const { error, count } = await supabase
        .from('dinner_request_responses')
        .delete()
        .in('request_id', requestIds);
      
      if (error) throw error;
      
      console.log(`🧹 [CONFLICT] Cleaned up ${count || 0} dinner responses`);
      return { count: count || 0 };
    } catch (error) {
      console.error('❌ Error cleaning dinner responses:', error);
      return { count: 0, error: error.message };
    }
  }
  
  /**
   * Clean up meal requests for a group
   */
  async cleanupMealRequests(groupId) {
    try {
      const { error, count } = await supabase
        .from('meal_requests')
        .delete()
        .eq('group_id', groupId);
      
      if (error) throw error;
      
      console.log(`🧹 [CONFLICT] Cleaned up ${count || 0} meal requests`);
      return { count: count || 0 };
    } catch (error) {
      console.error('❌ Error cleaning meal requests:', error);
      return { count: 0, error: error.message };
    }
  }
  
  /**
   * Clean up dinner requests for a group
   */
  async cleanupDinnerRequests(groupId) {
    try {
      const { error, count } = await supabase
        .from('dinner_requests')
        .delete()
        .eq('group_id', groupId);
      
      if (error) throw error;
      
      console.log(`🧹 [CONFLICT] Cleaned up ${count || 0} dinner requests`);
      return { count: count || 0 };
    } catch (error) {
      console.error('❌ Error cleaning dinner requests:', error);
      return { count: 0, error: error.message };
    }
  }
  
  /**
   * Clear terminated session results for a group
   */
  async clearTerminatedResults(groupId) {
    try {
      const { error } = await supabase
        .from('terminated_sessions')
        .delete()
        .eq('group_id', groupId);
      
      if (error) throw error;
      
      console.log('🧹 [CONFLICT] Cleared terminated session results');
      return { success: true };
    } catch (error) {
      console.error('❌ Error clearing terminated results:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Force cleanup a specific group with comprehensive logging
   */
  async forceCleanupGroup(groupId) {
    console.log('💥 [FORCE CLEANUP] Starting comprehensive cleanup for group:', groupId);
    
    const startTime = Date.now();
    
    try {
      // Run the comprehensive cleanup
      const result = await this.cleanupGroupConflicts(groupId);
      
      const duration = Date.now() - startTime;
      console.log(`💥 [FORCE CLEANUP] Completed in ${duration}ms:`, result);
      
      return {
        ...result,
        duration: duration,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('💥 [FORCE CLEANUP] Failed:', error);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }
}

// Export singleton instance
export const conflictResolution = new ConflictResolutionService();

// Export individual functions for backward compatibility
export const resolveGroupConflicts = (groupId) => conflictResolution.resolveGroupConflicts(groupId);
export const cleanupGroupConflicts = (groupId) => conflictResolution.cleanupGroupConflicts(groupId);
export const forceCleanupGroup = (groupId) => conflictResolution.forceCleanupGroup(groupId); 