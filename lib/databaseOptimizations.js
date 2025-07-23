import { supabase } from './supabase';

// Request deduplication cache
const activeRequests = new Map();
const requestCache = new Map();

/**
 * Debounce function calls to prevent excessive API requests
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function calls to limit frequency
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Deduplicate identical API requests
 */
export const deduplicateRequest = async (key, requestFunction) => {
  // If the same request is already in progress, return that promise
  if (activeRequests.has(key)) {
    console.log(`🔄 [DEDUP] Reusing active request: ${key}`);
    return activeRequests.get(key);
  }

  // Check cache first
  const cached = requestCache.get(key);
  if (cached && (Date.now() - cached.timestamp) < 5 * 60 * 1000) { // 5 minute cache
    console.log(`✅ [CACHE] Using cached result: ${key}`);
    return cached.data;
  }

  // Execute the request
  console.log(`🚀 [REQUEST] Executing: ${key}`);
  const promise = requestFunction().finally(() => {
    // Remove from active requests when complete
    activeRequests.delete(key);
  });

  // Store the promise so duplicate requests can reuse it
  activeRequests.set(key, promise);

  try {
    const result = await promise;
    
    // Cache successful results
    if (result && result.success !== false) {
      requestCache.set(key, {
        data: result,
        timestamp: Date.now()
      });
      
      // Limit cache size to prevent memory issues
      if (requestCache.size > 50) {
        const firstKey = requestCache.keys().next().value;
        requestCache.delete(firstKey);
      }
    }
    
    return result;
  } catch (error) {
    console.error(`❌ [REQUEST] Failed: ${key}`, error);
    throw error;
  }
};

/**
 * Batch multiple database queries into a single transaction
 */
export const batchQueries = async (queries) => {
  console.log(`📦 [BATCH] Executing ${queries.length} queries`);
  
  try {
    const results = await Promise.allSettled(queries);
    
    const successes = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failures = results.filter(r => r.status === 'rejected').map(r => r.reason);
    
    console.log(`✅ [BATCH] ${successes.length} succeeded, ${failures.length} failed`);
    
    return {
      success: failures.length === 0,
      results: successes,
      errors: failures,
      total: queries.length,
      successCount: successes.length,
      failureCount: failures.length
    };
  } catch (error) {
    console.error('❌ [BATCH] Batch operation failed:', error);
    return {
      success: false,
      error: error.message,
      results: [],
      errors: [error]
    };
  }
};

/**
 * Optimized group loading with minimal data transfer
 */
export const loadGroupsOptimized = async (userId) => {
  const cacheKey = `groups_${userId}`;
  
  return deduplicateRequest(cacheKey, async () => {
    try {
      // Use RPC function for optimized query
      const { data, error } = await supabase.rpc('get_user_groups_optimized', { 
        user_uuid: userId 
      });
      
      if (error) throw error;
      
      return {
        success: true,
        groups: data || [],
        cached: false
      };
    } catch (error) {
      console.error('❌ Error loading groups optimized:', error);
      return {
        success: false,
        error: error.message,
        groups: []
      };
    }
  });
};

/**
 * Optimized dinner requests loading with joins
 */
export const loadDinnerRequestsOptimized = async (userId) => {
  const cacheKey = `dinner_requests_${userId}`;
  
  return deduplicateRequest(cacheKey, async () => {
    try {
      // Single query with all needed data
      const { data, error } = await supabase
        .from('dinner_requests')
        .select(`
          id,
          group_id,
          groups!dinner_requests_group_id_fkey(name),
          requester_id,
          profiles!dinner_requests_requester_id_fkey(full_name),
          request_date,
          request_time,
          recipe_type,
          deadline,
          status,
          created_at
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform to match expected format
      const requests = (data || []).map(request => ({
        id: request.id,
        groupId: request.group_id,
        groupName: request.groups?.name || 'Unknown Group',
        requesterName: request.profiles?.full_name || 'Unknown User',
        date: request.request_date,
        time: request.request_time,
        recipeType: request.recipe_type,
        deadline: request.deadline,
        status: request.status,
        createdAt: request.created_at
      }));
      
      return {
        success: true,
        requests,
        cached: false
      };
    } catch (error) {
      console.error('❌ Error loading dinner requests optimized:', error);
      return {
        success: false,
        error: error.message,
        requests: []
      };
    }
  });
};

/**
 * Preload related data for a group
 */
export const preloadGroupData = async (groupId) => {
  const cacheKey = `group_data_${groupId}`;
  
  return deduplicateRequest(cacheKey, async () => {
    try {
      console.log(`🔄 [PRELOAD] Loading data for group: ${groupId}`);
      
      // Batch load multiple related queries
      const queries = [
        supabase.from('group_members').select('user_id, role').eq('group_id', groupId),
        supabase.from('dinner_requests').select('*').eq('group_id', groupId).eq('status', 'pending'),
        supabase.from('meal_requests').select('*').eq('group_id', groupId).eq('status', 'active')
      ];
      
      const batchResult = await batchQueries(queries);
      
      if (batchResult.success) {
        const [members, dinnerRequests, mealRequests] = batchResult.results;
        
        return {
          success: true,
          data: {
            members: members?.data || [],
            dinnerRequests: dinnerRequests?.data || [],
            mealRequests: mealRequests?.data || []
          }
        };
      } else {
        throw new Error('Failed to preload group data');
      }
    } catch (error) {
      console.error('❌ Error preloading group data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
};

/**
 * Invalidate cache for specific keys or patterns
 */
export const invalidateCache = (pattern) => {
  console.log(`🧹 [CACHE] Invalidating cache pattern: ${pattern}`);
  
  if (typeof pattern === 'string') {
    // Exact match
    requestCache.delete(pattern);
    activeRequests.delete(pattern);
  } else if (pattern instanceof RegExp) {
    // Pattern match
    for (const key of requestCache.keys()) {
      if (pattern.test(key)) {
        requestCache.delete(key);
      }
    }
    for (const key of activeRequests.keys()) {
      if (pattern.test(key)) {
        activeRequests.delete(key);
      }
    }
  }
};

/**
 * Clear all caches
 */
export const clearAllCaches = () => {
  console.log('🧹 [CACHE] Clearing all caches');
  requestCache.clear();
  activeRequests.clear();
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  return {
    cached: requestCache.size,
    active: activeRequests.size,
    cacheKeys: Array.from(requestCache.keys()),
    activeKeys: Array.from(activeRequests.keys())
  };
};

/**
 * Optimistic update helper
 */
export const optimisticUpdate = async (
  optimisticUpdateFn,
  actualUpdatePromise,
  rollbackFn
) => {
  // Apply optimistic update immediately
  const optimisticResult = optimisticUpdateFn();
  
  try {
    // Wait for actual update
    const actualResult = await actualUpdatePromise;
    
    // Invalidate relevant caches
    if (actualResult.invalidateCache) {
      actualResult.invalidateCache.forEach(pattern => {
        invalidateCache(pattern);
      });
    }
    
    return actualResult;
  } catch (error) {
    // Rollback optimistic update
    if (rollbackFn) {
      rollbackFn(optimisticResult);
    }
    throw error;
  }
};

/**
 * Subscription management for real-time updates
 */
class SubscriptionManager {
  constructor() {
    this.subscriptions = new Map();
  }
  
  subscribe(key, tableName, filter, callback) {
    if (this.subscriptions.has(key)) {
      console.log(`⚠️ [SUBSCRIPTION] Replacing existing subscription: ${key}`);
      this.unsubscribe(key);
    }
    
    console.log(`📡 [SUBSCRIPTION] Creating subscription: ${key}`);
    
    const subscription = supabase
      .channel(`${key}_channel`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: tableName,
          filter: filter 
        }, 
        (payload) => {
          console.log(`📡 [SUBSCRIPTION] ${key} received:`, payload);
          
          // Invalidate relevant caches
          invalidateCache(new RegExp(key.split('_')[0]));
          
          // Call the callback
          callback(payload);
        }
      )
      .subscribe();
      
    this.subscriptions.set(key, subscription);
    return subscription;
  }
  
  unsubscribe(key) {
    const subscription = this.subscriptions.get(key);
    if (subscription) {
      console.log(`📡 [SUBSCRIPTION] Removing subscription: ${key}`);
      supabase.removeChannel(subscription);
      this.subscriptions.delete(key);
    }
  }
  
  unsubscribeAll() {
    console.log('📡 [SUBSCRIPTION] Removing all subscriptions');
    this.subscriptions.forEach((subscription, key) => {
      supabase.removeChannel(subscription);
    });
    this.subscriptions.clear();
  }
}

export const subscriptionManager = new SubscriptionManager(); 