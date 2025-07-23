import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAppState } from './AppStateContext';

/**
 * Hook for components that need groups data
 * Provides optimized groups data with automatic loading
 */
export const useGroups = () => {
  const { 
    groups, 
    groupsLoading, 
    isGuest, 
    loadGroups, 
    addGroup, 
    updateGroup 
  } = useAppState();

  // Memoize to prevent unnecessary re-renders
  const groupsData = useMemo(() => ({
    groups,
    loading: groupsLoading,
    refresh: () => loadGroups(true),
    addGroup,
    updateGroup,
    hasGroups: groups.length > 0
  }), [groups, groupsLoading, loadGroups, addGroup, updateGroup]);

  return isGuest ? { groups: [], loading: false, hasGroups: false } : groupsData;
};

/**
 * Hook for components that need dinner requests data
 * Provides optimized dinner requests with local response overlay
 */
export const useDinnerRequests = () => {
  const { 
    dinnerRequests, 
    dinnerRequestsLoading, 
    localResponseMap,
    isGuest, 
    loadDinnerRequests, 
    updateDinnerRequest,
    removeDinnerRequest,
    addLocalResponse,
    clearLocalResponse
  } = useAppState();

  // Filter out requests that have local responses (optimistic UI)
  const pendingRequests = useMemo(() => {
    return dinnerRequests.filter(request => !localResponseMap.has(request.id));
  }, [dinnerRequests, localResponseMap]);

  const requestsData = useMemo(() => ({
    requests: pendingRequests,
    allRequests: dinnerRequests,
    loading: dinnerRequestsLoading,
    localResponses: localResponseMap,
    refresh: () => loadDinnerRequests(true),
    updateRequest: updateDinnerRequest,
    removeRequest: removeDinnerRequest,
    addLocalResponse,
    clearLocalResponse,
    hasRequests: pendingRequests.length > 0
  }), [
    pendingRequests, 
    dinnerRequests,
    dinnerRequestsLoading, 
    localResponseMap,
    loadDinnerRequests, 
    updateDinnerRequest,
    removeDinnerRequest,
    addLocalResponse,
    clearLocalResponse
  ]);

  return isGuest ? { 
    requests: [], 
    loading: false, 
    hasRequests: false,
    localResponses: new Map()
  } : requestsData;
};

/**
 * Hook for components that need user profile data
 */
export const useUserProfile = () => {
  const { 
    user, 
    userProfile, 
    isGuest, 
    loadUserProfile 
  } = useAppState();

  const profileData = useMemo(() => ({
    user,
    profile: userProfile,
    refresh: () => loadUserProfile(true),
    isAuthenticated: !isGuest
  }), [user, userProfile, loadUserProfile, isGuest]);

  return profileData;
};

/**
 * Hook for managing authentication state
 */
export const useAuth = () => {
  const { 
    user, 
    isGuest, 
    setUser, 
    setGuestStatus,
    refreshAll 
  } = useAppState();

  const authData = useMemo(() => ({
    user,
    isGuest,
    isAuthenticated: !isGuest,
    signIn: (userData) => {
      setUser(userData);
      setGuestStatus(false);
    },
    signOut: () => {
      setUser(null);
      setGuestStatus(true);
    },
    refresh: refreshAll
  }), [user, isGuest, setUser, setGuestStatus, refreshAll]);

  return authData;
};

/**
 * Hook for debounced search functionality
 */
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook for optimistic updates pattern
 */
export const useOptimisticUpdate = (updateFunction, rollbackFunction) => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const executeUpdate = useCallback(async (optimisticData, actualUpdatePromise) => {
    setIsPending(true);
    setError(null);

    // Apply optimistic update immediately
    updateFunction(optimisticData);

    try {
      // Wait for actual update
      await actualUpdatePromise;
      setIsPending(false);
    } catch (err) {
      // Rollback on error
      rollbackFunction(optimisticData);
      setError(err);
      setIsPending(false);
      throw err;
    }
  }, [updateFunction, rollbackFunction]);

  return { executeUpdate, isPending, error };
};

/**
 * Hook for caching expensive computations
 */
export const useExpensiveComputation = (computeFn, dependencies, cacheKey) => {
  const cache = useMemo(() => new Map(), []);

  return useMemo(() => {
    const key = cacheKey || JSON.stringify(dependencies);
    
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = computeFn();
    cache.set(key, result);
    
    // Clear old cache entries (keep last 10)
    if (cache.size > 10) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  }, dependencies);
};

/**
 * Hook for managing loading states across multiple operations
 */
export const useLoadingState = () => {
  const [loadingOperations, setLoadingOperations] = useState(new Set());

  const startLoading = useCallback((operation) => {
    setLoadingOperations(prev => new Set(prev).add(operation));
  }, []);

  const stopLoading = useCallback((operation) => {
    setLoadingOperations(prev => {
      const newSet = new Set(prev);
      newSet.delete(operation);
      return newSet;
    });
  }, []);

  const isLoading = useMemo(() => loadingOperations.size > 0, [loadingOperations]);
  const isOperationLoading = useCallback((operation) => loadingOperations.has(operation), [loadingOperations]);

  return {
    isLoading,
    isOperationLoading,
    startLoading,
    stopLoading,
    loadingOperations: Array.from(loadingOperations)
  };
}; 