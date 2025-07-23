import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { supabase } from './supabase';
import { getUserGroups } from './groupsService';
import { getAllDinnerRequests } from './dinnerRequestService';
import { getCurrentUserProfile } from './profileService';

// Initial state
const initialState = {
  // User data
  user: null,
  userProfile: null,
  isGuest: true,
  
  // Groups data with caching
  groups: [],
  groupsLoading: false,
  groupsLastUpdated: null,
  
  // Dinner requests with caching
  dinnerRequests: [],
  dinnerRequestsLoading: false,
  dinnerRequestsLastUpdated: null,
  
  // Local optimistic updates
  localResponseMap: new Map(),
  
  // App state
  currentScreen: 'profile',
  refreshTrigger: 0,
  
  // Cache management
  cacheExpiryTime: 5 * 60 * 1000, // 5 minutes
};

// Action types
const actionTypes = {
  SET_USER: 'SET_USER',
  SET_USER_PROFILE: 'SET_USER_PROFILE',
  SET_GUEST_STATUS: 'SET_GUEST_STATUS',
  
  SET_GROUPS_LOADING: 'SET_GROUPS_LOADING',
  SET_GROUPS: 'SET_GROUPS',
  UPDATE_GROUP: 'UPDATE_GROUP',
  ADD_GROUP: 'ADD_GROUP',
  
  SET_DINNER_REQUESTS_LOADING: 'SET_DINNER_REQUESTS_LOADING',
  SET_DINNER_REQUESTS: 'SET_DINNER_REQUESTS',
  UPDATE_DINNER_REQUEST: 'UPDATE_DINNER_REQUEST',
  REMOVE_DINNER_REQUEST: 'REMOVE_DINNER_REQUEST',
  
  ADD_LOCAL_RESPONSE: 'ADD_LOCAL_RESPONSE',
  CLEAR_LOCAL_RESPONSE: 'CLEAR_LOCAL_RESPONSE',
  
  SET_CURRENT_SCREEN: 'SET_CURRENT_SCREEN',
  TRIGGER_REFRESH: 'TRIGGER_REFRESH',
  
  INVALIDATE_CACHE: 'INVALIDATE_CACHE',
};

// Reducer
const appStateReducer = (state, action) => {
  switch (action.type) {
    case actionTypes.SET_USER:
      return { ...state, user: action.payload };
      
    case actionTypes.SET_USER_PROFILE:
      return { ...state, userProfile: action.payload };
      
    case actionTypes.SET_GUEST_STATUS:
      return { 
        ...state, 
        isGuest: action.payload,
        // Clear data when switching to guest
        ...(action.payload ? {
          groups: [],
          dinnerRequests: [],
          userProfile: null,
          localResponseMap: new Map()
        } : {})
      };
      
    case actionTypes.SET_GROUPS_LOADING:
      return { ...state, groupsLoading: action.payload };
      
    case actionTypes.SET_GROUPS:
      return { 
        ...state, 
        groups: action.payload,
        groupsLoading: false,
        groupsLastUpdated: Date.now()
      };
      
    case actionTypes.UPDATE_GROUP:
      return {
        ...state,
        groups: state.groups.map(group => 
          group.group_id === action.payload.group_id 
            ? { ...group, ...action.payload } 
            : group
        )
      };
      
    case actionTypes.ADD_GROUP:
      return {
        ...state,
        groups: [...state.groups, action.payload],
        groupsLastUpdated: Date.now()
      };
      
    case actionTypes.SET_DINNER_REQUESTS_LOADING:
      return { ...state, dinnerRequestsLoading: action.payload };
      
    case actionTypes.SET_DINNER_REQUESTS:
      return {
        ...state,
        dinnerRequests: action.payload,
        dinnerRequestsLoading: false,
        dinnerRequestsLastUpdated: Date.now()
      };
      
    case actionTypes.UPDATE_DINNER_REQUEST:
      return {
        ...state,
        dinnerRequests: state.dinnerRequests.map(request =>
          request.id === action.payload.id
            ? { ...request, ...action.payload }
            : request
        )
      };
      
    case actionTypes.REMOVE_DINNER_REQUEST:
      return {
        ...state,
        dinnerRequests: state.dinnerRequests.filter(request => request.id !== action.payload)
      };
      
    case actionTypes.ADD_LOCAL_RESPONSE:
      const newMap = new Map(state.localResponseMap);
      newMap.set(action.payload.requestId, action.payload.response);
      return { ...state, localResponseMap: newMap };
      
    case actionTypes.CLEAR_LOCAL_RESPONSE:
      const clearedMap = new Map(state.localResponseMap);
      clearedMap.delete(action.payload);
      return { ...state, localResponseMap: clearedMap };
      
    case actionTypes.SET_CURRENT_SCREEN:
      return { ...state, currentScreen: action.payload };
      
    case actionTypes.TRIGGER_REFRESH:
      return { ...state, refreshTrigger: state.refreshTrigger + 1 };
      
    case actionTypes.INVALIDATE_CACHE:
      const invalidations = {};
      if (action.payload.includes('groups')) {
        invalidations.groupsLastUpdated = null;
      }
      if (action.payload.includes('dinnerRequests')) {
        invalidations.dinnerRequestsLastUpdated = null;
      }
      return { ...state, ...invalidations };
      
    default:
      return state;
  }
};

// Context
const AppStateContext = createContext();

// Provider component
export const AppStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appStateReducer, initialState);

  // Helper function to check if cache is fresh
  const isCacheFresh = useCallback((lastUpdated) => {
    if (!lastUpdated) return false;
    return (Date.now() - lastUpdated) < state.cacheExpiryTime;
  }, [state.cacheExpiryTime]);

  // Load user profile with caching
  const loadUserProfile = useCallback(async (force = false) => {
    if (state.isGuest) return;
    
    try {
      const result = await getCurrentUserProfile();
      if (result.success) {
        dispatch({ type: actionTypes.SET_USER_PROFILE, payload: result.profile });
      }
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
    }
  }, [state.isGuest]);

  // Load groups with intelligent caching
  const loadGroups = useCallback(async (force = false) => {
    if (state.isGuest) return;
    
    // Use cache if fresh and not forced
    if (!force && isCacheFresh(state.groupsLastUpdated) && state.groups.length > 0) {
      console.log('✅ Using cached groups data');
      return state.groups;
    }
    
    if (state.groupsLoading) {
      console.log('⚠️ Groups already loading, skipping duplicate call');
      return state.groups;
    }
    
    dispatch({ type: actionTypes.SET_GROUPS_LOADING, payload: true });
    
    try {
      console.log('🔄 Loading fresh groups data...');
      const result = await getUserGroups();
      
      if (result.success) {
        dispatch({ type: actionTypes.SET_GROUPS, payload: result.groups });
        return result.groups;
      } else {
        console.error('❌ Failed to load groups:', result.error);
        dispatch({ type: actionTypes.SET_GROUPS_LOADING, payload: false });
        return [];
      }
    } catch (error) {
      console.error('❌ Error loading groups:', error);
      dispatch({ type: actionTypes.SET_GROUPS_LOADING, payload: false });
      return [];
    }
  }, [state.isGuest, state.groupsLoading, state.groups.length, state.groupsLastUpdated, isCacheFresh]);

  // Load dinner requests with intelligent caching
  const loadDinnerRequests = useCallback(async (force = false) => {
    if (state.isGuest) return;
    
    // Use cache if fresh and not forced
    if (!force && isCacheFresh(state.dinnerRequestsLastUpdated) && state.dinnerRequests.length >= 0) {
      console.log('✅ Using cached dinner requests data');
      return state.dinnerRequests;
    }
    
    if (state.dinnerRequestsLoading) {
      console.log('⚠️ Dinner requests already loading, skipping duplicate call');
      return state.dinnerRequests;
    }
    
    dispatch({ type: actionTypes.SET_DINNER_REQUESTS_LOADING, payload: true });
    
    try {
      console.log('🔄 Loading fresh dinner requests data...');
      const result = await getAllDinnerRequests();
      
      if (result.success) {
        dispatch({ type: actionTypes.SET_DINNER_REQUESTS, payload: result.requests || [] });
        return result.requests || [];
      } else {
        console.error('❌ Failed to load dinner requests:', result.error);
        dispatch({ type: actionTypes.SET_DINNER_REQUESTS_LOADING, payload: false });
        return [];
      }
    } catch (error) {
      console.error('❌ Error loading dinner requests:', error);
      dispatch({ type: actionTypes.SET_DINNER_REQUESTS_LOADING, payload: false });
      return [];
    }
  }, [state.isGuest, state.dinnerRequestsLoading, state.dinnerRequests.length, state.dinnerRequestsLastUpdated, isCacheFresh]);

  // Update group optimistically
  const updateGroup = useCallback((groupData) => {
    dispatch({ type: actionTypes.UPDATE_GROUP, payload: groupData });
  }, []);

  // Add group optimistically
  const addGroup = useCallback((groupData) => {
    dispatch({ type: actionTypes.ADD_GROUP, payload: groupData });
  }, []);

  // Update dinner request optimistically
  const updateDinnerRequest = useCallback((requestData) => {
    dispatch({ type: actionTypes.UPDATE_DINNER_REQUEST, payload: requestData });
  }, []);

  // Remove dinner request optimistically
  const removeDinnerRequest = useCallback((requestId) => {
    dispatch({ type: actionTypes.REMOVE_DINNER_REQUEST, payload: requestId });
  }, []);

  // Add local response for immediate UI updates
  const addLocalResponse = useCallback((requestId, response) => {
    dispatch({ type: actionTypes.ADD_LOCAL_RESPONSE, payload: { requestId, response } });
  }, []);

  // Clear local response
  const clearLocalResponse = useCallback((requestId) => {
    dispatch({ type: actionTypes.CLEAR_LOCAL_RESPONSE, payload: requestId });
  }, []);

  // Invalidate specific cache
  const invalidateCache = useCallback((cacheTypes) => {
    dispatch({ type: actionTypes.INVALIDATE_CACHE, payload: cacheTypes });
  }, []);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    console.log('🔄 Refreshing all app data...');
    dispatch({ type: actionTypes.TRIGGER_REFRESH });
    
    if (!state.isGuest) {
      await Promise.all([
        loadGroups(true),
        loadDinnerRequests(true),
        loadUserProfile(true)
      ]);
    }
  }, [state.isGuest, loadGroups, loadDinnerRequests, loadUserProfile]);

  // Set current screen
  const setCurrentScreen = useCallback((screen) => {
    dispatch({ type: actionTypes.SET_CURRENT_SCREEN, payload: screen });
  }, []);

  // Set auth status
  const setGuestStatus = useCallback((isGuest) => {
    dispatch({ type: actionTypes.SET_GUEST_STATUS, payload: isGuest });
  }, []);

  // Set user
  const setUser = useCallback((user) => {
    dispatch({ type: actionTypes.SET_USER, payload: user });
  }, []);

  // Auto-refresh data when auth status changes
  useEffect(() => {
    if (!state.isGuest) {
      loadGroups();
      loadDinnerRequests();
      loadUserProfile();
    }
  }, [state.isGuest, loadGroups, loadDinnerRequests, loadUserProfile]);

  // Context value
  const value = {
    // State
    ...state,
    
    // Actions
    loadGroups,
    loadDinnerRequests,
    loadUserProfile,
    updateGroup,
    addGroup,
    updateDinnerRequest,
    removeDinnerRequest,
    addLocalResponse,
    clearLocalResponse,
    invalidateCache,
    refreshAll,
    setCurrentScreen,
    setGuestStatus,
    setUser,
    
    // Utilities
    isCacheFresh,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

// Custom hook to use the context
export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

// Higher-order component for automatic data loading
export const withAutoRefresh = (WrappedComponent, dataTypes = []) => {
  return function WithAutoRefreshComponent(props) {
    const { loadGroups, loadDinnerRequests, refreshTrigger } = useAppState();
    
    useEffect(() => {
      if (dataTypes.includes('groups')) {
        loadGroups();
      }
      if (dataTypes.includes('dinnerRequests')) {
        loadDinnerRequests();
      }
    }, [refreshTrigger, loadGroups, loadDinnerRequests]);
    
    return <WrappedComponent {...props} />;
  };
}; 