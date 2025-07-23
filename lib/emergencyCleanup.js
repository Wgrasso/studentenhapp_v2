import { conflictResolution } from './conflictResolution';
import { supabase } from './supabase';

/**
 * Emergency cleanup utility for immediate conflict resolution
 */
export class EmergencyCleanup {
  
  /**
   * Clean up ALL groups that have conflicts
   * @returns {Promise<Object>} - Cleanup results for all groups
   */
  async cleanupAllGroups() {
    console.log('🚨 [EMERGENCY] Starting cleanup of ALL groups...');
    
    try {
      // Get all groups for the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }
      
      // Get user's groups
      const { data: groups, error } = await supabase
        .rpc('get_user_groups', { user_uuid: user.id });
      
      if (error) {
        console.error('❌ Error getting user groups:', error);
        return { success: false, error: error.message };
      }
      
      if (!groups || groups.length === 0) {
        return { success: true, message: 'No groups to clean up', results: [] };
      }
      
      console.log(`🚨 [EMERGENCY] Found ${groups.length} groups to check`);
      
      const cleanupResults = [];
      
      // Clean up each group
      for (const group of groups) {
        console.log(`🚨 [EMERGENCY] Cleaning up group: ${group.group_name} (${group.group_id})`);
        
        try {
          const result = await conflictResolution.forceCleanupGroup(group.group_id);
          cleanupResults.push({
            groupId: group.group_id,
            groupName: group.group_name,
            ...result
          });
        } catch (error) {
          console.error(`❌ Error cleaning group ${group.group_name}:`, error);
          cleanupResults.push({
            groupId: group.group_id,
            groupName: group.group_name,
            success: false,
            error: error.message
          });
        }
      }
      
      const successful = cleanupResults.filter(r => r.success).length;
      const failed = cleanupResults.filter(r => !r.success).length;
      
      console.log(`🚨 [EMERGENCY] Cleanup complete: ${successful} successful, ${failed} failed`);
      
      return {
        success: failed === 0,
        message: `Cleaned up ${successful}/${groups.length} groups`,
        results: cleanupResults,
        summary: {
          total: groups.length,
          successful,
          failed
        }
      };
      
    } catch (error) {
      console.error('🚨 [EMERGENCY] Cleanup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Clean up a specific group by ID
   * @param {string} groupId - Group ID to clean up
   * @returns {Promise<Object>} - Cleanup result
   */
  async cleanupSpecificGroup(groupId) {
    console.log(`🚨 [EMERGENCY] Cleaning up specific group: ${groupId}`);
    
    try {
      const result = await conflictResolution.forceCleanupGroup(groupId);
      
      console.log('🚨 [EMERGENCY] Specific group cleanup result:', result);
      
      return {
        success: result.success,
        message: result.success 
          ? `Successfully cleaned up group ${groupId}` 
          : `Failed to clean up group ${groupId}: ${result.error}`,
        details: result
      };
      
    } catch (error) {
      console.error('🚨 [EMERGENCY] Specific cleanup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get diagnostic information about conflicts across all groups
   * @returns {Promise<Object>} - Diagnostic information
   */
  async getDiagnostics() {
    console.log('🔍 [DIAGNOSTIC] Getting conflict diagnostics...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }
      
      // Get user's groups
      const { data: groups, error } = await supabase
        .rpc('get_user_groups', { user_uuid: user.id });
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      if (!groups || groups.length === 0) {
        return { success: true, message: 'No groups found', diagnostics: [] };
      }
      
      const diagnostics = [];
      
      for (const group of groups) {
        const conflicts = await conflictResolution.resolveGroupConflicts(group.group_id);
        
        diagnostics.push({
          groupId: group.group_id,
          groupName: group.group_name,
          memberCount: group.member_count,
          hasConflicts: conflicts.hasConflicts,
          requiresCleanup: conflicts.requiresCleanup,
          conflicts: conflicts.conflicts || []
        });
      }
      
      const groupsWithConflicts = diagnostics.filter(d => d.hasConflicts);
      const groupsNeedingCleanup = diagnostics.filter(d => d.requiresCleanup);
      
      return {
        success: true,
        summary: {
          totalGroups: groups.length,
          groupsWithConflicts: groupsWithConflicts.length,
          groupsNeedingCleanup: groupsNeedingCleanup.length
        },
        diagnostics,
        groupsWithConflicts,
        groupsNeedingCleanup
      };
      
    } catch (error) {
      console.error('🔍 [DIAGNOSTIC] Error getting diagnostics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Quick fix for the most common constraint violation
   * @returns {Promise<Object>} - Quick fix result
   */
  async quickFix() {
    console.log('⚡ [QUICK FIX] Running quick constraint fix...');
    
    try {
      // Get diagnostics first
      const diagnostics = await this.getDiagnostics();
      
      if (!diagnostics.success) {
        return diagnostics;
      }
      
      if (diagnostics.groupsNeedingCleanup.length === 0) {
        return {
          success: true,
          message: 'No conflicts found - all groups are clean!',
          details: diagnostics.summary
        };
      }
      
      // Clean up only groups that need it
      const cleanupResults = [];
      
      for (const group of diagnostics.groupsNeedingCleanup) {
        console.log(`⚡ [QUICK FIX] Cleaning ${group.groupName}...`);
        
        const result = await conflictResolution.forceCleanupGroup(group.groupId);
        cleanupResults.push({
          groupName: group.groupName,
          ...result
        });
      }
      
      const successful = cleanupResults.filter(r => r.success).length;
      
      return {
        success: successful === cleanupResults.length,
        message: `Quick fix complete: ${successful}/${cleanupResults.length} groups cleaned`,
        details: cleanupResults
      };
      
    } catch (error) {
      console.error('⚡ [QUICK FIX] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const emergencyCleanup = new EmergencyCleanup();

// Export convenience functions
export const cleanupAllGroups = () => emergencyCleanup.cleanupAllGroups();
export const cleanupSpecificGroup = (groupId) => emergencyCleanup.cleanupSpecificGroup(groupId);
export const getConflictDiagnostics = () => emergencyCleanup.getDiagnostics();
export const quickFix = () => emergencyCleanup.quickFix(); 