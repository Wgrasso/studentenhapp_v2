import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, Modal, Animated, Clipboard, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import { createGroupInSupabase, joinGroupByCode, getUserGroups, leaveGroup, deleteGroup, getGroupMembers, setFavoriteGroup, getFavoriteGroupId } from '../lib/groupsService';
import { getMealOptions } from '../lib/mealRequestService';
import { getActiveMealRequest, createMealRequest, replaceMealRequest, debugGetActiveRequests, debugCompleteAllActiveRequests, completeMealRequest, getTopVotedMeals, getUserVotingProgress } from '../lib/mealRequestService';
import { getGroupMemberResponses, getAllDinnerRequests, recordUserResponse, createMealFromRequest, completeDinnerRequest } from '../lib/dinnerRequestService';
import { ensureUserProfile } from '../lib/profileService';
import { terminatedSessionsService } from '../lib/terminatedSessionsService';
import { supabase } from '../lib/supabase';

// Safe image component for floating drawings
const SafeDrawing = ({ source, style, resizeMode = "contain" }) => {
  const [imageError, setImageError] = useState(false);
  
  if (imageError) return null;
  
  return (
    <Image 
      source={source}
      style={style}
      resizeMode={resizeMode}
      onError={() => setImageError(true)}
    />
  );
};

// Timer calculation functions (from MainProfileScreen)
const calculateTimeRemaining = (deadline) => {
  const now = new Date().getTime();
  const deadlineTime = new Date(deadline).getTime();
  const timeDiff = deadlineTime - now;

  if (timeDiff <= 0) {
    return 'Deadline passed   ';
  }

  const hours = Math.floor(timeDiff / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

  // Format with fixed width to prevent movement
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s remaining`;
  } else if (minutes > 0) {
    return `     ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s remaining`;
  } else {
    return `          ${seconds.toString().padStart(2, '0')}s remaining`;
  }
};

// Get timer color based on time remaining
const getTimerColor = (timeText) => {
  if (timeText === 'Deadline passed') return '#F44336'; // Red
  if (timeText.includes('s remaining') && !timeText.includes('m')) return '#FF9800'; // Orange for under 1 minute
  if (timeText.includes('m') && !timeText.includes('h')) {
    const minutes = parseInt(timeText.match(/(\d+)m/)?.[1] || '0');
    if (minutes < 5) return '#FF9800'; // Orange for under 5 minutes
  }
  return '#6B6B6B'; // Default gray
};

// Format time to 12-hour format
const formatTime = (hour, minutes) => {
  if (hour === null || minutes === null) return '';
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Enhanced User response buttons component with dinner request details and timer
const UserResponseButtons = ({ memberResponses, onResponse, dinnerRequestData, groupName, onLocalAccept }) => {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [timerAnimation] = useState(new Animated.Value(1));
  // Local state for immediate UI updates
  const [hasLocallyResponded, setHasLocallyResponded] = useState(false);
  const [userLocalResponse, setUserLocalResponse] = useState(null);
  
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (user && !error) {
          setCurrentUserId(user.id);
        }
      } catch (error) {
        console.error('Error getting current user:', error);
      }
    };
    
    getCurrentUser();
  }, []);

  // Reset local state when prop data confirms the response (API completed)
  useEffect(() => {
    if (propHasResponded && hasLocallyResponded) {
      // API call completed successfully, clear local state to sync with server
      setHasLocallyResponded(false);
      setUserLocalResponse(null);
    }
  }, [propHasResponded, hasLocallyResponded]);

  // Update timer every second when dinner request data is available
  useEffect(() => {
    let interval;
    
    if (dinnerRequestData && dinnerRequestData.deadline) {
      const updateTimer = () => {
        const remaining = calculateTimeRemaining(dinnerRequestData.deadline);
        setTimeRemaining(remaining);
        
        // Add pulsing animation for urgent deadlines
        const isUrgent = (remaining.includes('s remaining') && !remaining.includes('m')) || 
                        (remaining.includes('m') && !remaining.includes('h') && 
                         parseInt(remaining.match(/(\d+)m/)?.[1] || '0') < 5);
        
        if (isUrgent) {
          // Start pulsing animation
          Animated.loop(
            Animated.sequence([
              Animated.timing(timerAnimation, {
                toValue: 1.2,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.timing(timerAnimation, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
              }),
            ])
          ).start();
        } else {
          // Stop pulsing animation
          timerAnimation.setValue(1);
        }
      };
      
      // Update immediately
      updateTimer();
      
      // Then update every second
      interval = setInterval(updateTimer, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [dinnerRequestData]);
  
  if (!currentUserId) {
    return null;
  }
  
  // Check local state first (for immediate updates), then fall back to prop data
  const userResponse = memberResponses.find(r => r.userId === currentUserId);
  const propHasResponded = userResponse && userResponse.response !== 'pending';
  
  // Use local state if available, otherwise use prop data
  const hasResponded = hasLocallyResponded || propHasResponded;
  const finalResponse = hasLocallyResponded ? userLocalResponse : userResponse?.response;
  
  // Format request data for display
  const formatRequestData = () => {
    if (!dinnerRequestData) return null;
    
    const requestDate = new Date(dinnerRequestData.requestDate);
    const formattedDate = requestDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Format time from 24-hour to 12-hour
    const [hours, minutes] = dinnerRequestData.requestTime.split(':');
    const timeObj = { hour: parseInt(hours), minutes: parseInt(minutes) };
    const requestTime = formatTime(timeObj.hour, timeObj.minutes);

    return {
      date: formattedDate,
      time: requestTime,
      groupName: groupName || 'Your Group'
    };
  };

  const requestData = formatRequestData();
  
  if (hasResponded) {
    return (
      <View style={styles.alreadyRespondedContainer}>
        <Text style={styles.alreadyRespondedText}>
          You already responded: {finalResponse === 'accepted' ? 'YES' : 'NO'}
        </Text>
      </View>
    );
  }
  
  return (
    <View style={styles.dinnerRequestFullSection}>
      {/* Request Details */}
      {requestData && (
        <View style={styles.requestDetailsSection}>
          <Text style={styles.requestDetailsTitle}>Dinner Request Details</Text>
          <Text style={styles.requestDetailsMessage}>
            You have been invited to eat with {requestData.groupName} on {requestData.date} at {requestData.time}
          </Text>
        </View>
      )}

      {/* Deadline Timer */}
      {timeRemaining && (
        <Animated.View style={[styles.timerSection, { transform: [{ scale: timerAnimation }] }]}>
          <Text style={[styles.timerText, { color: getTimerColor(timeRemaining) }]}>
            {timeRemaining}
          </Text>
        </Animated.View>
      )}

      {/* Response Buttons */}
      <View style={styles.responseButtonContainer}>
        <TouchableOpacity 
          style={[styles.responseButton, styles.acceptButton]}
          onPress={() => {
            // INSTANT UI UPDATE: Show voting buttons immediately
            if (onLocalAccept) {
              onLocalAccept();
            }
            // Immediately update local state for instant UI feedback
            setHasLocallyResponded(true);
            setUserLocalResponse('accepted');
            // Then trigger the API call
            onResponse(true);
          }}
        >
          <Text style={styles.acceptButtonText}>Yes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.responseButton, styles.declineButton]}
          onPress={() => {
            // Immediately update local state for instant UI feedback
            setHasLocallyResponded(true);
            setUserLocalResponse('declined');
            // Then trigger the API call
            onResponse(false);
          }}
        >
          <Text style={styles.declineButtonText}>No</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function GroupsScreen({ route, navigation }) {
  const { isGuest } = route.params || { isGuest: true };
  
  // State management
  const [loading, setLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [createAnimation] = useState(new Animated.Value(0));
  const [joinAnimation] = useState(new Animated.Value(0));
  
  // Group Detail Popup states
  const [showGroupDetailModal, setShowGroupDetailModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetailAnimation] = useState(new Animated.Value(0));
  const [mealRequestLoading, setMealRequestLoading] = useState(false);
  const [mealCount, setMealCount] = useState(12); // Default 12 meals, range 3-20
  
  // Extra Options states
  const [difficulty, setDifficulty] = useState('Any'); // 'Easy', 'Medium', 'Hard', 'Any'
  
  // Members view states
  const [showMembersView, setShowMembersView] = useState(false);
  const [flipAnimation] = useState(new Animated.Value(0));
  const [members, setMembers] = useState([]);
  const [memberResponses, setMemberResponses] = useState([]);
  const [dinnerRequestStatus, setDinnerRequestStatus] = useState(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(null);

  // Button cooldown protection to prevent accidental rapid presses
  const [buttonCooldown, setButtonCooldown] = useState(false);
  
  // Ref to track loading state more reliably (prevents race conditions)
  const isLoadingRef = useRef(false);
  
  const withCooldown = (callback) => {
    if (buttonCooldown) {
      console.log('Button press blocked - cooldown active');
      return;
    }
    
    console.log('🔘 Button press allowed, starting cooldown');
    setButtonCooldown(true);
    callback();
    
    // Reset cooldown after 1 second
    setTimeout(() => {
      setButtonCooldown(false);
      console.log('✅ Button cooldown reset');
    }, 1000);
  };
  
  // Form state
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  
  // Custom Alert Modal states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertAnimation] = useState(new Animated.Value(0));
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtonText, setAlertButtonText] = useState('OK');
  const [alertOnPress, setAlertOnPress] = useState(() => () => {});
  
  // Confirmation Dialog states
  const [isConfirmDialog, setIsConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(() => () => {});
  const [currentUserId, setCurrentUserId] = useState(null);
  
  // State for storing terminated session results (top 3 meals) - persistent per group
  const [terminatedSessionResults, setTerminatedSessionResults] = useState(new Map()); // groupId -> results
  const [userVotingComplete, setUserVotingComplete] = useState(new Map()); // groupId -> boolean
  
  // Local state for instant button display when user clicks YES (optimistic UI)
  const [userLocallyAcceptedRequest, setUserLocallyAcceptedRequest] = useState(false);
  const [favoriteGroupId, setFavoriteGroupId] = useState(null);

    // Main effect - handles initial load and user changes
  useEffect(() => {
    console.log('🔄 User status changed - isGuest:', isGuest);
    
    // Clear previous user data first AND ensure alert is dismissed
    setGroups([]);
    setSelectedGroup(null);
    setShowGroupDetailModal(false);
    setAlertVisible(false);
    setIsConfirmDialog(false);
    alertAnimation.setValue(0);
    isLoadingRef.current = false;
    
    if (!isGuest) {
      console.log('🔄 Loading groups for authenticated user');
      
      // Load current user ID
      const getCurrentUserId = async () => {
        try {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (user && !error) {
            setCurrentUserId(user.id);
            console.log('👤 Current user ID set:', user.id);
          }
        } catch (error) {
          console.error('❌ Error getting current user:', error);
        }
      };
      
      getCurrentUserId();
      
      // Small delay to ensure cleanup is complete
      setTimeout(() => {
        loadUserGroups();
      }, 50);
    } else {
      console.log('🔄 Clearing data for guest user');
      setCurrentUserId(null);
      setGroupsLoading(false);
    }
  }, [isGuest]);

  // Navigation focus listener - only register once
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('🎯 Groups screen focused');
      
      // Check if we're returning from voting and should reopen the group modal
      if (route.params?.reopenGroupModal && route.params?.groupId) {
        console.log('🔄 Reopening group modal after voting for group:', route.params.groupId);
        
        // Find the group and reopen the modal
        const group = groups.find(g => g.group_id === route.params.groupId);
        if (group) {
          setTimeout(() => {
            handleGroupPress(group);
          }, 100);
        }
        
        // Clear the parameters via the parent navigation
        if (navigation.setParams) {
          navigation.setParams({ 
            switchToGroupsTab: undefined,
            reopenGroupModal: undefined, 
            groupId: undefined 
          });
        }
      }
      
      // Only refresh if user is authenticated and not already loading  
      if (!isGuest && !isLoadingRef.current) {
        console.log('🔄 Refreshing groups on screen focus');
        loadUserGroups();
      }
    });

    return unsubscribe;
  }, [navigation, groups]); // Added groups dependency to access current groups

  // Ensure terminated sessions are loaded whenever groups change
  useEffect(() => {
    if (groups.length > 0) {
      console.log('📊 Groups updated, ensuring terminated sessions are loaded');
      setTimeout(() => {
        loadTerminatedSessions(groups);
      }, 300); // Small delay to ensure groups state is stable
    }
  }, [groups.length]); // Only trigger when the number of groups changes

  // Listen for refresh parameter changes from other screens
  useEffect(() => {
    if (route.params?.refreshGroups && !isGuest && !isLoadingRef.current) {
      console.log('🔄 Refreshing groups due to parameter change:', route.params.refreshGroups);
      loadUserGroups();
      // Clear the parameter to prevent repeated refreshes
      navigation.setParams({ refreshGroups: undefined });
    }
    
    // Clear terminated results when new request is made for a group
    if (route.params?.clearTerminatedResults) {
      const groupId = route.params.clearTerminatedResults;
      console.log('🧹 Clearing terminated results for group:', groupId);
      setTerminatedSessionResults(prev => {
        const newMap = new Map(prev);
        newMap.delete(groupId);
        return newMap;
      });
      
      // Reset local acceptance state when new request is made for this group
      if (selectedGroup && selectedGroup.group_id === groupId) {
        console.log('🔄 Resetting local acceptance state for new request');
        setUserLocallyAcceptedRequest(false);
      }
      
      // Clear the parameter to prevent repeated clearing
      navigation.setParams({ clearTerminatedResults: undefined });
    }
  }, [route.params?.refreshGroups, route.params?.clearTerminatedResults, isGuest, navigation]);

  // Listen for immediate response updates from MainProfileScreen  
  useEffect(() => {
    if (route.params?.immediateResponse) {
      const { requestId, response, userId, timestamp } = route.params.immediateResponse;
      
      console.log('📱 [CROSS-SCREEN] Received immediate response:', {
        requestId,
        response,
        userId,
        timestamp
      });

      // Update selectedGroup's response data immediately if it matches
      if (selectedGroup && selectedGroup.activeDinnerRequest && selectedGroup.activeDinnerRequest.id === requestId) {
        console.log('🔄 [CROSS-SCREEN] Updating selectedGroup response data');
        
        // Update the dinner request responses in selectedGroup
        const updatedResponses = selectedGroup.dinnerRequestResponses ? [...selectedGroup.dinnerRequestResponses] : [];
        const existingIndex = updatedResponses.findIndex(r => r.userId === userId);
        
        if (existingIndex >= 0) {
          updatedResponses[existingIndex] = { ...updatedResponses[existingIndex], response };
        } else {
          updatedResponses.push({ userId, response });
        }
        
        setSelectedGroup(prev => ({
          ...prev,
          dinnerRequestResponses: updatedResponses
        }));

        // If response was "accepted", immediately show voting buttons
        if (response === 'accepted' && userId === currentUserId) {
          console.log('✅ [CROSS-SCREEN] User accepted - showing voting buttons immediately');
          setSelectedGroup(prev => ({
            ...prev,
            hasActiveMealRequest: true,
            activeMealRequest: prev.activeMealRequest || {
              id: `temp-${Date.now()}`,
              request_id: `temp-${Date.now()}`,
              preloadedForVoting: true
            }
          }));
        }

        // Check if we should show voting buttons (from MainProfileScreen)
        if (route.params.immediateResponse.showVotingButtons && userId === currentUserId) {
          console.log('🗳️ [CROSS-SCREEN] Showing voting buttons per MainProfileScreen request');
          setSelectedGroup(prev => ({
            ...prev,
            hasActiveMealRequest: true,
            activeMealRequest: prev.activeMealRequest || {
              id: `temp-${Date.now()}`,
              request_id: `temp-${Date.now()}`,
              preloadedForVoting: true
            }
          }));
        }
      }

      // Clear the parameter to prevent re-processing
      navigation.setParams({ immediateResponse: null });
    }
  }, [route.params?.immediateResponse, selectedGroup, currentUserId, navigation]);
  


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting - cleaning up');
      isLoadingRef.current = false;
      setGroups([]);
      setSelectedGroup(null);
      setShowGroupDetailModal(false);
    };
  }, []);

  // Check if user has completed voting for a group
  const checkUserVotingComplete = async (groupId, requestId) => {
    try {
      if (!requestId) return false;
      
      const progressResult = await getUserVotingProgress(requestId);
      if (progressResult.success) {
        setUserVotingComplete(prev => {
          const newMap = new Map(prev);
          newMap.set(groupId, progressResult.progress.isComplete);
          return newMap;
        });
        return progressResult.progress.isComplete;
      }
      return false;
    } catch (error) {
      console.error('Error checking voting progress:', error);
      return false;
    }
  };

  // Load terminated sessions from database
  const loadTerminatedSessions = async (groupsToLoad = null) => {
    try {
      console.log('🔄 Loading terminated sessions from database...');
      const groupsData = groupsToLoad || groups;
      
      if (!groupsData || groupsData.length === 0) {
        console.log('⚠️ No groups available to load terminated sessions');
        return;
      }
      
      // Don't clear existing terminated sessions - merge with existing
      const newMap = new Map(terminatedSessionResults);
      
      // Load terminated sessions for all groups
      for (const group of groupsData) {
        const sessionResult = await terminatedSessionsService.getTerminatedSession(group.group_id);
        
        if (sessionResult.success && sessionResult.data) {
          console.log(`📊 Found terminated session for group ${group.group_name}:`, sessionResult.data);
          newMap.set(group.group_id, {
            groupId: sessionResult.data.group_id,
            groupName: sessionResult.data.group_name,
            results: sessionResult.data.top_results || [],
            memberResponses: sessionResult.data.member_responses || [],
            terminatedAt: sessionResult.data.terminated_at
          });
        } else {
          console.log(`📊 No terminated session found for group ${group.group_name}`);
        }
      }
      
      setTerminatedSessionResults(newMap);
      console.log('✅ Loaded terminated sessions from database. Total sessions:', newMap.size);
      
      // Log what we loaded
      newMap.forEach((session, groupId) => {
        console.log(`📊 Session for ${session.groupName}: ${session.results.length} results, ${session.memberResponses.length} responses`);
      });
    } catch (error) {
      console.error('❌ Error loading terminated sessions:', error);
    }
  };

  const loadUserGroups = async () => {
    if (isGuest) {
      // Don't try to load groups for guest users
      setGroupsLoading(false);
      isLoadingRef.current = false;
      return;
    }

    // Prevent multiple simultaneous calls using ref (more reliable than state)
    if (isLoadingRef.current) {
      console.log('⚠️ Groups already loading (ref check), skipping duplicate call');
      return;
    }

    console.log('🔄 Starting to load user groups with optimizations...');
    isLoadingRef.current = true;
    setGroupsLoading(true);
    
    // Ensure user has a profile before loading groups
    try {
      console.log('👤 Ensuring user profile exists...');
      await ensureUserProfile();
    } catch (profileError) {
      console.log('⚠️ Could not ensure user profile:', profileError);
    }
    
    // Safety timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.log('🚨 GROUPS LOADING TIMEOUT: Force stopping loading after 10 seconds');
      isLoadingRef.current = false;
      setGroupsLoading(false);
      setGroups([]);
    }, 10000);
    
    try {
      // Use Promise.race to prevent hanging
      const loadPromise = getUserGroups();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Groups loading timeout')), 8000);
      });
      
      const result = await Promise.race([loadPromise, timeoutPromise]);
      
      clearTimeout(loadingTimeout);
      
      if (result && result.success) {
        console.log('✅ Groups loaded successfully:', result.groups?.length || 0);
        const basicGroups = result.groups || [];
        
        // Check for active meal requests and dinner requests for each group
        console.log('🔍 Checking for active meal requests and dinner requests...');
        const groupsWithMealRequests = await Promise.all(
          basicGroups.map(async (group) => {
            try {
              const mealRequestResult = await getActiveMealRequest(group.group_id);
              const dinnerRequestResult = await getGroupMemberResponses(group.group_id);
              
              console.log(`🍽️ [DEBUG] Group: ${group.group_name}`);
              console.log(`🍽️ [DEBUG] Meal request result:`, mealRequestResult);
              console.log(`🍽️ [DEBUG] Dinner request result:`, dinnerRequestResult);
              
              const hasActiveMeal = mealRequestResult.success && mealRequestResult.hasActiveRequest;
              const hasActiveDinner = dinnerRequestResult.success && dinnerRequestResult.hasActiveRequest;
              
              console.log(`📋 [DEBUG] Group ${group.group_name}:`);
              console.log(`📋 [DEBUG] - Has active meal request: ${hasActiveMeal}`);
              console.log(`📋 [DEBUG] - Has active dinner request: ${hasActiveDinner}`);
              
              if (hasActiveMeal) {
                console.log(`📋 [DEBUG] - Meal request details:`, mealRequestResult.request);
              }
              
                          // Check if this group has a terminated session that should be preserved
            const existingGroup = groups.find(g => g.group_id === group.group_id);
            const wasTerminated = existingGroup?._terminatedSession;
            const terminatedRecently = wasTerminated && existingGroup?._terminatedAt && 
              (new Date() - new Date(existingGroup._terminatedAt)) < 300000; // Within 5 minutes
            
            if (terminatedRecently) {
              console.log(`🛡️ Preserving terminated state for group: ${group.group_name}`);
              return {
                ...group,
                hasActiveMealRequest: false,
                activeMealRequest: null,
                hasActiveDinnerRequest: false,
                activeDinnerRequest: null,
                dinnerRequestResponses: [],
                dinnerRequestSummary: null,
                _terminatedSession: true,
                _terminatedAt: existingGroup._terminatedAt
              };
            }
            
            return {
              ...group,
              hasActiveMealRequest: hasActiveMeal,
              activeMealRequest: mealRequestResult.success ? mealRequestResult.request : null,
              hasActiveDinnerRequest: hasActiveDinner,
              activeDinnerRequest: dinnerRequestResult.success && dinnerRequestResult.hasActiveRequest ? dinnerRequestResult.activeRequest : null,
              dinnerRequestResponses: dinnerRequestResult.success ? dinnerRequestResult.memberResponses : [],
              dinnerRequestSummary: dinnerRequestResult.success ? dinnerRequestResult.summary : null
            };
            } catch (error) {
              console.log(`⚠️ Failed to check requests for group ${group.group_id}:`, error);
              console.error('❌ Detailed error:', error);
              return {
                ...group,
                hasActiveMealRequest: false,
                activeMealRequest: null,
                hasActiveDinnerRequest: false,
                activeDinnerRequest: null,
                dinnerRequestResponses: [],
                dinnerRequestSummary: null
              };
            }
          })
        );
        
        console.log('✅ Enhanced groups with meal request and dinner request data');
        
        // Debug: Log groups with dinner requests
        const groupsWithDinnerRequests = groupsWithMealRequests.filter(g => g.hasActiveDinnerRequest);
        console.log('🍽️ Groups with active dinner requests:', groupsWithDinnerRequests.length);
        groupsWithDinnerRequests.forEach(group => {
          console.log(`- ${group.group_name}: ${JSON.stringify(group.dinnerRequestSummary)}`);
        });
        setGroups(groupsWithMealRequests);
        
        // Load terminated sessions after groups are loaded
        // Pass the groups data directly to avoid timing issues
        setTimeout(() => {
          loadTerminatedSessions(groupsWithMealRequests);
        }, 200); // Increased delay to ensure state is updated
      } else {
        // Don't show error popup - just log and handle gracefully
        console.log('ℹ️ Could not load groups:', result?.error || 'Unknown error');
        setGroups([]);
      }
      
    } catch (error) {
      console.error('❌ Error loading groups:', error);
      clearTimeout(loadingTimeout);
      
      // Force reset to prevent freeze
      isLoadingRef.current = false;
      setGroups([]);
      
      // Don't show error to user unless it's critical
      if (error.message !== 'Groups loading timeout') {
        console.log('⚠️ Non-timeout error loading groups:', error);
      }
    } finally {
      // Always ensure loading state is cleared
      isLoadingRef.current = false;
      setGroupsLoading(false);
    }
  };

  // Regular alert function for simple messages
  const showAlert = (title, message, buttonText = 'OK', onPressCallback = null) => {
    try {
      console.log('🚨 Showing alert:', { title, message, buttonText });
      
      // Reset modals
      setLoading(false);
      setShowCreateModal(false);
      setShowJoinModal(false);
      createAnimation.setValue(0);
      joinAnimation.setValue(0);
      
      // Set up as regular alert (not confirmation)
      setIsConfirmDialog(false);
      setAlertTitle(title);
      setAlertMessage(message);
      setAlertButtonText(buttonText);
      
      // Set up single button action
      const alertCloseHandler = () => {
        console.log('🔄 Alert close handler triggered');
        try {
          hideAlert();
          if (onPressCallback) {
            onPressCallback();
          }
        } catch (error) {
          console.log('⚠️ Alert close error (non-critical):', error);
          setAlertVisible(false);
        }
      };
      
      setAlertOnPress(() => alertCloseHandler);
      
      // Show alert
      setAlertVisible(true);
      Animated.spring(alertAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
      
    } catch (error) {
      console.error('❌ Error in showAlert:', error);
      resetToInitialState();
    }
  };

  // Confirmation dialog function for destructive actions
  const showConfirmDialog = (title, message, confirmButtonText, confirmCallback) => {
    try {
      console.log('⚠️ Showing confirmation dialog:', { title, message, confirmButtonText });
      console.log('🔍 Current alert state before:', { alertVisible, isConfirmDialog, showGroupDetailModal });
      
      // Reset modals completely
      setLoading(false);
      setShowCreateModal(false);
      setShowJoinModal(false);
      setShowGroupDetailModal(false); // ENSURE group detail is closed
      createAnimation.setValue(0);
      joinAnimation.setValue(0);
      groupDetailAnimation.setValue(0); // Reset group detail animation
      
      // Set up as confirmation dialog
      setIsConfirmDialog(true);
      setAlertTitle(title);
      setAlertMessage(message);
      setAlertButtonText(confirmButtonText);
      setConfirmAction(() => confirmCallback);
      
      // Dummy function for alertOnPress (won't be used in confirm dialog)
      setAlertOnPress(() => () => {});
      
      // Show dialog with logging
      console.log('🔄 Setting alertVisible to true...');
      setAlertVisible(true);
      
      console.log('🔄 Starting alert animation...');
      Animated.spring(alertAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start((finished) => {
        console.log('✅ Alert animation finished:', finished);
      });
      
      // Debug state after setting
      setTimeout(() => {
        console.log('🔍 Alert state after setup:', { alertVisible, isConfirmDialog });
      }, 100);
      
    } catch (error) {
      console.error('❌ Error in showConfirmDialog:', error);
      resetToInitialState();
    }
  };

  const hideAlert = () => {
    console.log('🔄 Closing alert modal');
    
    try {
      Animated.spring(alertAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start(() => {
        console.log('🔄 Alert close animation completed');
        setAlertVisible(false);
        setIsConfirmDialog(false);
      });
      
      // Force close after animation timeout
      setTimeout(() => {
        if (alertVisible) {
          console.log('🚨 Force closing alert after animation timeout');
          setAlertVisible(false);
          setIsConfirmDialog(false);
        }
      }, 1000);
      
    } catch (error) {
      console.log('⚠️ Error closing alert (non-critical):', error);
      setAlertVisible(false);
      setIsConfirmDialog(false);
    }
  };

  const handleConfirm = () => {
    console.log('✅ User confirmed action - handleConfirm called');
    console.log('🔍 confirmAction exists:', !!confirmAction);
    try {
      hideAlert();
      if (confirmAction) {
        console.log('🔄 Executing confirm action...');
        confirmAction();
      } else {
        console.log('⚠️ No confirmAction found!');
      }
    } catch (error) {
      console.log('⚠️ Confirm action error:', error);
      hideAlert();
    }
  };

  const handleCancel = () => {
    console.log('❌ User cancelled action - handleCancel called');
    hideAlert();
  };

  const showCreateModalFunc = () => {
    if (isGuest) {
      showAlert('Sign In Required', 'Please sign in to create groups', 'Sign In', () => {
        navigation.navigate('SignIn');
      });
      return;
    }
    
    setShowCreateModal(true);
    Animated.spring(createAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const hideCreateModal = () => {
    try {
      console.log('🔄 Closing create modal...');
      setLoading(false); // Always reset loading first
      
      Animated.spring(createAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start(() => {
        try {
          setShowCreateModal(false);
          setGroupName('');
          setLoading(false); // Double-check loading state
        } catch (modalError) {
          console.log('⚠️ Error in modal close callback:', modalError);
          // Force reset states
          setShowCreateModal(false);
          setGroupName('');
          setLoading(false);
        }
      });
      
      // Safety timeout in case animation doesn't complete
      setTimeout(() => {
        setShowCreateModal(false);
        setGroupName('');
        setLoading(false);
      }, 1000);
      
    } catch (error) {
      console.log('⚠️ Error closing create modal:', error);
      // Force reset all states
      setShowCreateModal(false);
      setGroupName('');
      setLoading(false);
    }
  };

  const showJoinModalFunc = () => {
    if (isGuest) {
      showAlert('Sign In Required', 'Please sign in to join groups', 'Sign In', () => {
        navigation.navigate('SignIn');
      });
      return;
    }
    
    setShowJoinModal(true);
    Animated.spring(joinAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const hideJoinModal = () => {
    try {
      console.log('🔄 Closing join modal...');
      setLoading(false); // Always reset loading first
      
      Animated.spring(joinAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start(() => {
        try {
          setShowJoinModal(false);
          setJoinCode('');
          setLoading(false); // Double-check loading state
        } catch (modalError) {
          console.log('⚠️ Error in join modal close callback:', modalError);
          // Force reset states
          setShowJoinModal(false);
          setJoinCode('');
          setLoading(false);
        }
      });
      
      // Safety timeout in case animation doesn't complete
      setTimeout(() => {
        setShowJoinModal(false);
        setJoinCode('');
        setLoading(false);
      }, 1000);
      
    } catch (error) {
      console.log('⚠️ Error closing join modal:', error);
      // Force reset all states
      setShowJoinModal(false);
      setJoinCode('');
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      showAlert('Invalid Input', 'Please enter a group name', 'OK');
      return;
    }

    console.log('🏗️ Starting group creation process...');
    setLoading(true);
    
    // Multiple safety timeouts to prevent freezing
    let safetyTimeouts = [];
    
    // Main safety timeout - force complete reset after 15 seconds
    const mainTimeout = setTimeout(() => {
      console.log('🚨 MAIN SAFETY TIMEOUT: Force complete reset after 15 seconds');
      resetToInitialState();
      showAlert('Timeout Error', 'Group creation is taking too long. Please try again.', 'OK');
    }, 15000);
    safetyTimeouts.push(mainTimeout);
    
    // Secondary timeout - warn after 8 seconds
    const warningTimeout = setTimeout(() => {
      console.log('⚠️ WARNING: Group creation taking longer than expected...');
    }, 8000);
    safetyTimeouts.push(warningTimeout);
    
    try {
      console.log('🏗️ Calling createGroupInSupabase...');
      
      // Use Promise.race to ensure operation doesn't hang indefinitely
      const createPromise = createGroupInSupabase(groupName);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), 12000);
      });
      
      const result = await Promise.race([createPromise, timeoutPromise]);
      
      console.log('📋 Group creation result:', result);
      
      // Clear all safety timeouts since operation completed
      safetyTimeouts.forEach(timeout => clearTimeout(timeout));
      
      if (result && result.success) {
        console.log('✅ Group created successfully, updating UI...');
        
        // COMPLETE STATE RESET TO INITIAL CONDITIONS
        resetToInitialState();
        
        // Refresh groups list (non-blocking)
        console.log('🔄 Refreshing groups list...');
        loadUserGroups().catch(refreshError => {
          console.log('⚠️ Groups refresh failed (non-critical):', refreshError);
        });
        
        // Refresh MainProfileScreen groups immediately
        if (navigation.getParent()) {
          navigation.getParent().setParams({ 
            refreshMainProfileGroups: Date.now()
          });
        }
        
        // Show success message
        setTimeout(() => {
          try {
            console.log('🎉 Showing success message...');
            showAlert(
              'Group Created', 
              `"${result.group?.name || groupName}" has been created successfully!\n\nJoin Code: ${result.group?.join_code}\n\nShare this code with others to invite them to your group.`,
              'OK'
            );
          } catch (alertError) {
            console.log('⚠️ Alert display error (non-critical):', alertError);
          }
        }, 200); // Small delay to ensure reset is complete
        
      } else {
        console.log('❌ Group creation failed:', result?.error || 'Unknown error');
        
        // COMPLETE STATE RESET
        resetToInitialState();
        
        showAlert('Error', result?.error || 'Failed to create group. Please try again.', 'OK');
      }
      
    } catch (error) {
      console.error('❌ Unexpected error during group creation:', error);
      
      // Clear all safety timeouts
      safetyTimeouts.forEach(timeout => clearTimeout(timeout));
      
      // FORCE COMPLETE STATE RESET
      resetToInitialState();
      
      // Handle specific error types
      let errorMessage = 'Failed to create group. Please try again.';
      if (error.message === 'Operation timeout') {
        errorMessage = 'Group creation is taking too long. Please check your connection and try again.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      showAlert('Error', errorMessage, 'OK');
    }
  };

  // DEBUG FUNCTION - Check UI state
  const debugUIState = () => {
    const state = {
      loading,
      groupsLoading,
      showCreateModal,
      showJoinModal,
      alertVisible,
      groupName,
      joinCode,
      alertTitle,
      alertMessage,
      createAnimationValue: createAnimation._value,
      joinAnimationValue: joinAnimation._value,
      alertAnimationValue: alertAnimation._value
    };
    
    console.log('🔍 UI STATE DEBUG:', state);
    
    // Check if any blocking states are active
    const isBlocked = loading || groupsLoading || showCreateModal || showJoinModal || alertVisible;
    console.log('🚫 UI BLOCKED:', isBlocked);
    
    return state;
  };

  // COMPLETE STATE RESET - Returns page to initial state
  const resetToInitialState = () => {
    console.log('🔄 COMPLETE STATE RESET: Returning to initial state');
    
    try {
      // Reset all loading states
      isLoadingRef.current = false;
      setLoading(false);
      setGroupsLoading(false);
      setMealRequestLoading(false);
      setMembersLoading(false);
      
      // Reset all modal states
      setShowCreateModal(false);
      setShowJoinModal(false);
      setShowGroupDetailModal(false);
      setShowMembersView(false);
      setAlertVisible(false);
      setIsConfirmDialog(false);
      
      // Reset all form data
          setGroupName('');
    setJoinCode('');
      
      // Reset alert data
      setAlertTitle('');
      setAlertMessage('');
      setAlertButtonText('OK');
      setAlertOnPress(() => () => {});
      
      // Reset selection and error states
      setSelectedGroup(null);
      setMembersError(null);
      setMembers([]);
      
      // Reset animations to 0 (closed state)
      createAnimation.setValue(0);
      joinAnimation.setValue(0);
      alertAnimation.setValue(0);
      groupDetailAnimation.setValue(0);
      flipAnimation.setValue(0);
      
      // Reset button cooldown
      setButtonCooldown(false);
      
      console.log('✅ Complete state reset finished');
      
      // Verify reset worked
      setTimeout(() => {
        debugUIState();
      }, 100);
      
    } catch (error) {
      console.log('⚠️ Error during state reset (non-critical):', error);
      // Force set the most critical states even if others fail
      setLoading(false);
      setGroupsLoading(false);
      setMealRequestLoading(false);
      setAlertVisible(false);
    }
  };

  // Emergency recovery function for when app gets completely stuck
  const emergencyRecovery = () => {
    console.log('🚨 EMERGENCY RECOVERY: Complete app state reset');
    
    // First try normal reset
    resetToInitialState();
    
    // Force reload groups after reset
    setTimeout(() => {
      if (!isGuest) {
        console.log('🔄 Emergency: Forcing groups reload');
        isLoadingRef.current = false; // Reset ref before starting new load
        setGroupsLoading(true);
        loadUserGroups().catch(error => {
          console.log('❌ Emergency reload failed:', error);
          isLoadingRef.current = false;
          setGroupsLoading(false);
          setGroups([]);
        });
      }
    }, 500);
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim()) {
      showAlert('Invalid Input', 'Please enter a join code', 'OK');
      return;
    }

    console.log('🚪 Starting join group process with code:', joinCode);
    setLoading(true);
    
    // Multiple safety timeouts for join process
    let safetyTimeouts = [];
    
    // Main safety timeout - force complete reset after 10 seconds
    const mainTimeout = setTimeout(() => {
      console.log('🚨 JOIN SAFETY TIMEOUT: Force complete reset after 10 seconds');
      resetToInitialState();
      showAlert('Timeout Error', 'Joining group is taking too long. Please try again.', 'OK');
    }, 10000);
    safetyTimeouts.push(mainTimeout);
    
    try {
      // Use Promise.race to prevent hanging
      const joinPromise = joinGroupByCode(joinCode);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Join operation timeout')), 8000);
      });
      
      const result = await Promise.race([joinPromise, timeoutPromise]);
      
      console.log('📋 Join group result:', result);
      
      // Clear safety timeouts
      safetyTimeouts.forEach(timeout => clearTimeout(timeout));
      
      if (result && result.success) {
        console.log('✅ Successfully joined group:', result.group?.name);
        
        // COMPLETE STATE RESET TO INITIAL CONDITIONS
        resetToInitialState();
        
        // Refresh groups list (non-blocking)
        console.log('🔄 Refreshing groups list...');
        loadUserGroups().catch(refreshError => {
          console.log('⚠️ Groups refresh failed (non-critical):', refreshError);
        });
        
        // Refresh MainProfileScreen groups immediately
        if (navigation.getParent()) {
          navigation.getParent().setParams({ 
            refreshMainProfileGroups: Date.now()
          });
        }
        
        // Show brief success message that auto-dismisses
        setTimeout(() => {
          try {
            showAlert(
              'Joined Group', 
              `Successfully joined "${result.group?.name}"!`,
              'OK'
            );
          } catch (alertError) {
            console.log('⚠️ Success alert error (non-critical):', alertError);
          }
        }, 200); // Small delay to ensure reset is complete
        
      } else {
        console.log('❌ Join group failed:', result?.error);
        
        // COMPLETE STATE RESET
        resetToInitialState();
        
        let errorMessage = result?.error || 'Failed to join group. Please try again.';
        
        // Provide more helpful error messages
        if (errorMessage.includes('Group not found')) {
          errorMessage = 'Group not found. Please check that the join code is correct and try again.';
        } else if (errorMessage.includes('already a member')) {
          errorMessage = 'You are already a member of this group.';
        } else if (errorMessage.includes('Database error')) {
          errorMessage = 'There was a problem accessing the group. Please try again in a moment.';
        }
        
        showAlert('Cannot Join Group', errorMessage, 'OK');
      }
      
    } catch (error) {
      console.error('❌ Unexpected error during join:', error);
      
      // Clear safety timeouts
      safetyTimeouts.forEach(timeout => clearTimeout(timeout));
      
      // FORCE COMPLETE STATE RESET
      resetToInitialState();
      
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.message === 'Join operation timeout') {
        errorMessage = 'Joining is taking too long. Please check your connection and try again.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      showAlert('Error', errorMessage, 'OK');
    }
  };

  const handleLeaveGroup = async (groupId, groupName) => {
    showConfirmDialog(
      'Leave Group',
      `Are you sure you want to leave "${groupName}"?`,
      'Leave Group',
      async () => {
        console.log('🚪 User confirmed leaving group');
        setLoading(true);
        
        try {
          const result = await leaveGroup(groupId);
          
          // Reset state regardless of result
          resetToInitialState();
          
          if (result.success) {
            console.log('✅ Successfully left group');
            
            // Refresh groups list
            loadUserGroups().catch(refreshError => {
              console.log('⚠️ Groups refresh failed (non-critical):', refreshError);
            });
            
            // Show success message
            setTimeout(() => {
              showAlert('Left Group', result.message, 'OK');
            }, 200);
          } else {
            console.log('❌ Failed to leave group:', result.error);
            showAlert('Error', result.error, 'OK');
          }
          
        } catch (error) {
          console.error('❌ Unexpected error leaving group:', error);
          resetToInitialState();
          showAlert('Error', 'An unexpected error occurred. Please try again.', 'OK');
        }
      }
    );
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    console.log('🗑️ Starting delete group process for:', groupName);
    
    showConfirmDialog(
      'Delete Group',
      `Are you sure you want to permanently delete "${groupName}"?\n\nThis action cannot be undone and will remove all members from the group.`,
      'Delete Forever',
      async () => {
        console.log('🗑️ User confirmed deletion, proceeding...');
        setLoading(true);
        
        // Multiple safety timeouts for delete process
        let safetyTimeouts = [];
        
        // Main safety timeout - force complete reset after 10 seconds
        const mainTimeout = setTimeout(() => {
          console.log('🚨 DELETE SAFETY TIMEOUT: Force complete reset after 10 seconds');
          resetToInitialState();
          showAlert('Timeout Error', 'Deleting group is taking too long. Please try again.', 'OK');
        }, 10000);
        safetyTimeouts.push(mainTimeout);
        
        try {
          // Use Promise.race to prevent hanging
          const deletePromise = deleteGroup(groupId);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Delete operation timeout')), 8000);
          });
          
          const result = await Promise.race([deletePromise, timeoutPromise]);
          
          console.log('📋 Delete group result:', result);
          
          // Clear safety timeouts
          safetyTimeouts.forEach(timeout => clearTimeout(timeout));
          
          if (result && result.success) {
            console.log('✅ Successfully deleted group:', result.group?.name);
            
            // COMPLETE STATE RESET TO INITIAL CONDITIONS
            resetToInitialState();
            
            // Refresh groups list (non-blocking)
            console.log('🔄 Refreshing groups list...');
            loadUserGroups().catch(refreshError => {
              console.log('⚠️ Groups refresh failed (non-critical):', refreshError);
            });
            

            
          } else {
            console.log('❌ Delete group failed:', result?.error);
            
            // COMPLETE STATE RESET
            resetToInitialState();
            
            let errorMessage = result?.error || 'Failed to delete group. Please try again.';
            
            // Provide more helpful error messages
            if (errorMessage.includes('not found')) {
              errorMessage = 'Group not found or has already been deleted.';
            } else if (errorMessage.includes('not the creator')) {
              errorMessage = 'Only the group creator can delete this group.';
            } else if (errorMessage.includes('Database error')) {
              errorMessage = 'There was a problem accessing the group. Please try again in a moment.';
            }
            
            showAlert('Cannot Delete Group', errorMessage, 'OK');
          }
          
        } catch (error) {
          console.error('❌ Unexpected error during delete:', error);
          
          // Clear safety timeouts
          safetyTimeouts.forEach(timeout => clearTimeout(timeout));
          
          // FORCE COMPLETE STATE RESET
          resetToInitialState();
          
          let errorMessage = 'An unexpected error occurred. Please try again.';
          if (error.message === 'Delete operation timeout') {
            errorMessage = 'Deleting is taking too long. Please check your connection and try again.';
          } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            errorMessage = 'Network error. Please check your connection and try again.';
          }
          
          showAlert('Error', errorMessage, 'OK');
        }
      }
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Group Detail Modal Functions
  const openGroupDetailModal = (group) => {
    console.log('📋 [MODAL DEBUG] Opening group detail for:', group.group_name);
    console.log('📋 [MODAL DEBUG] Group data:', {
      hasActiveMealRequest: group.hasActiveMealRequest,
      hasActiveDinnerRequest: group.hasActiveDinnerRequest,
      activeMealRequest: group.activeMealRequest,
      activeDinnerRequest: group.activeDinnerRequest
    });
    
    // If group doesn't have active request, ensure meals are preloaded
    if (!group.hasActiveMealRequest) {
      const { getPreloadedGroupMeals, preloadAllMeals } = require('../lib/mealPreloadService');
      const preloadedMeals = getPreloadedGroupMeals(group.group_id);
      
      if (!preloadedMeals || preloadedMeals.length === 0) {
        console.log('⚠️ No preloaded meals for group, starting preload...');
        // Start preloading in background
        preloadAllMeals([group]).catch(error => {
          console.error('❌ Error preloading meals:', error);
        });
      }
    }
    
    // Load members data and dinner request status
    console.log('🔄 Loading members data...');
    loadGroupMembers(group.group_id);
    
    console.log('🔄 Loading dinner request status...');
    loadDinnerRequestStatus(group.group_id);
    
    // Clear any termination flags and set the selected group
    const cleanGroup = { ...group };
    delete cleanGroup._terminatedSession;
    setSelectedGroup(cleanGroup);
    setShowGroupDetailModal(true);
    
    // Reset local acceptance state when opening a different group
    setUserLocallyAcceptedRequest(false);
    
    // Check if user has completed voting for this group
    if (cleanGroup.activeMealRequest?.request_id || cleanGroup.activeMealRequest?.id) {
      const requestId = cleanGroup.activeMealRequest?.request_id || cleanGroup.activeMealRequest?.id;
      checkUserVotingComplete(cleanGroup.group_id, requestId);
    }
    
    Animated.spring(groupDetailAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };
  
  const hideGroupDetailModal = () => {
    console.log('🔄 Closing group detail modal');
    
    try {
      // Force immediate state reset to prevent freezing
      setMealRequestLoading(false);
      
      // Clear member data when closing modal
      setMembers([]);
      setMembersError(null);
      setMemberResponses([]);
      setDinnerRequestStatus(null);
      // NOTE: Don't clear terminated session results - they should persist!
      
      Animated.spring(groupDetailAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start(() => {
        try {
          setShowGroupDetailModal(false);
          setSelectedGroup(null);
          setMealRequestLoading(false);
        } catch (modalError) {
          console.log('⚠️ Error in modal close callback:', modalError);
          // Force reset states
          setShowGroupDetailModal(false);
          setSelectedGroup(null);
          setMealRequestLoading(false);
        }
      });
      
      // Safety timeout in case animation doesn't complete
      setTimeout(() => {
        setShowGroupDetailModal(false);
        setSelectedGroup(null);
        setMealRequestLoading(false);
      }, 800);
      
    } catch (error) {
      console.log('⚠️ Error closing group detail modal:', error);
      // Force complete reset
      setShowGroupDetailModal(false);
      setSelectedGroup(null);
      setMealRequestLoading(false);
    }
  };

  const loadGroupMembers = async (groupId = null) => {
    const targetGroupId = groupId || selectedGroup?.group_id;
    const targetGroupName = groupId ? 'preload target' : selectedGroup?.group_name;
    
    console.log('🚨 LOAD MEMBERS UI FUNCTION CALLED!');
    console.log('🚨 Target group:', targetGroupName, 'ID:', targetGroupId);
    
    if (!targetGroupId) return;
    
    try {
      console.log('🔄 Loading members for group:', targetGroupName, 'ID:', targetGroupId);
      setMembersLoading(true);
      setMembersError(null);
      
      const result = await getGroupMembers(targetGroupId);
      
      if (result.success) {
        console.log(`✅ Loaded ${result.members.length} members for group ${targetGroupName}`);
        console.log('👥 Members data:', result.members);
        setMembers(result.members);
        
        // Display helpful message if there are RLS issues
        if (result.message) {
          console.log('ℹ️ Service message:', result.message);
          setMembersError(result.message); // Use the error field to display the helpful message
        }
      } else {
        console.log('❌ Failed to load members:', result.error);
        setMembersError(result.error || 'Failed to load members');
      }
    } catch (error) {
      console.error('❌ Error loading members:', error);
      setMembersError('Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  };

  const loadDinnerRequestStatus = async (groupId = null) => {
    const targetGroupId = groupId || selectedGroup?.group_id;
    if (!targetGroupId) return;

    console.log('🍽️ Loading dinner request status for group:', targetGroupId);
    
    try {
      const result = await getGroupMemberResponses(targetGroupId);
      
      if (result.success) {
        console.log('✅ Loaded dinner request status:', result);
        setDinnerRequestStatus(result.hasActiveRequest ? result : null);
        setMemberResponses(result.memberResponses || []);
      } else {
        console.error('❌ Failed to load dinner request status:', result.error);
        setDinnerRequestStatus(null);
        setMemberResponses([]);
      }
    } catch (error) {
      console.error('❌ Error loading dinner request status:', error);
      setDinnerRequestStatus(null);
      setMemberResponses([]);
    }
  };

  // Flip functions removed - members are now shown directly in the main group view

  // Role and join date functions removed - no longer needed

  const getMemberResponseStatus = (memberId) => {
    if (!dinnerRequestStatus || !dinnerRequestStatus.hasActiveRequest) {
      return null;
    }
    
    const response = memberResponses.find(r => r.userId === memberId);
    return response ? response.response : 'pending';
  };

  // Synchronous helper to check if current user accepted the dinner request
  const currentUserAcceptedDinnerRequest = () => {
    if (!currentUserId || !selectedGroup?.hasActiveDinnerRequest || !selectedGroup?.dinnerRequestResponses) {
      return false;
    }
    
    const userResponse = selectedGroup?.dinnerRequestResponses?.find(r => r.userId === currentUserId);
    const accepted = userResponse?.response === 'accepted';
    
    console.log('📋 [USER RESPONSE CHECK] Current user:', currentUserId);
    console.log('📋 [USER RESPONSE CHECK] User response:', userResponse?.response);
    console.log('📋 [USER RESPONSE CHECK] Accepted:', accepted);
    
    return accepted;
  };

  const getResponseIndicatorStyle = (status) => {
    switch (status) {
      case 'accepted':
        return { backgroundColor: '#8B7355', color: '#FFFFFF' };
      case 'declined':
        return { backgroundColor: '#6B6B6B', color: '#FFFFFF' };
      case 'pending':
        return { backgroundColor: '#FFC107', color: '#2D2D2D' };
      default:
        return null;
    }
  };

  const getResponseText = (status) => {
    switch (status) {
      case 'accepted':
        return 'YES';
      case 'declined':
        return 'NO';
      case 'pending':
        return 'PENDING';
      default:
        return '';
    }
  };

  const copyJoinCode = async (joinCode) => {
    try {
      await Clipboard.setString(joinCode);
      showAlert(
        'Copied!',
        `Join code "${joinCode}" copied to clipboard`,
        'OK'
      );
      
      // Auto-hide after 1.5 seconds
      setTimeout(() => {
        hideAlert();
      }, 1500);
    } catch (error) {
      console.error('❌ Error copying to clipboard:', error);
      showAlert(
        'Copy Failed',
        'Could not copy join code to clipboard',
        'OK'
      );
    }
  };

  const handleDinnerRequestResponse = async (accepted) => {
    if (!dinnerRequestStatus?.hasActiveRequest) {
      console.error('❌ No active dinner request to respond to');
      return;
    }

    const requestId = dinnerRequestStatus.activeRequest.id;
    const response = accepted ? 'accepted' : 'declined';
    console.log(`📝 User ${response} the dinner request:`, requestId);

    try {
      const result = await recordUserResponse(requestId, response);
      
      if (result.success) {
        console.log('✅ Request response saved successfully');
        
        let alertMessage = result.message;
        
        let mealSessionCreated = false;
        let newMealRequestId = null;
        
        // Show response status (meal session was created when request was sent)
        if (result.readiness) {
          alertMessage += `\n\nResponses: ${result.readiness.responses_count}/${result.readiness.total_members} members (${result.readiness.accepted_count} accepted)`;
          if (result.readiness.is_ready) {
            alertMessage += `\n\nGreat! Everyone has responded. You can now vote on meals!`;
          }
        }
        
        showAlert('Response Sent', alertMessage, 'OK');
        
        // Refresh the dinner request status and group data
        await loadDinnerRequestStatus();
        await loadUserGroups();
        
        // IMMEDIATE CROSS-SCREEN SYNC: Update MainProfileScreen (remove notification)
        if (navigation.getParent()) {
          navigation.getParent().setParams({ 
            refreshGroups: Date.now(),
            immediateResponseFromGroup: {
              requestId: requestId,
              response: response,
              userId: currentUserId,
              timestamp: Date.now()
            }
          });
        }

        // IMMEDIATE UI UPDATE: Show voting buttons if user accepted
        if (accepted && selectedGroup) {
          console.log('✅ [GROUP PAGE] User accepted - showing voting buttons immediately');
          
          // Update current user's response in the dinnerRequestResponses
          const updatedResponses = selectedGroup?.dinnerRequestResponses ? [...selectedGroup.dinnerRequestResponses] : [];
          const userResponseIndex = updatedResponses.findIndex(r => r.userId === currentUserId);
          
          if (userResponseIndex >= 0) {
            updatedResponses[userResponseIndex] = { ...updatedResponses[userResponseIndex], response: 'accepted' };
          } else {
            updatedResponses.push({ userId: currentUserId, response: 'accepted' });
          }
          
          setSelectedGroup(prev => ({
            ...prev,
            hasActiveMealRequest: true,
            activeMealRequest: prev.activeMealRequest || {
              id: `temp-${Date.now()}`,
              request_id: `temp-${Date.now()}`,
              preloadedForVoting: true
            },
            dinnerRequestResponses: updatedResponses
          }));
        }

        // CRITICAL: Update the selectedGroup state with fresh response data
        if (selectedGroup && !selectedGroup._terminatedSession) {
          // Small delay to ensure groups data is loaded, then update selectedGroup
          setTimeout(() => {
            setSelectedGroup(prev => {
              // Don't update if session has been terminated
              if (prev?._terminatedSession) {
                console.log('🚫 Skipping selectedGroup update - session terminated');
                return prev;
              }
              
              const updatedGroupData = groups.find(g => g.group_id === prev?.group_id);
              if (updatedGroupData) {
                console.log('🔄 Updating selectedGroup with fresh response data');
                return {
                  ...updatedGroupData,
                  // Preserve any existing meal request data and user response updates
                  hasActiveMealRequest: updatedGroupData.hasActiveMealRequest || prev.hasActiveMealRequest,
                  activeMealRequest: updatedGroupData.activeMealRequest || prev.activeMealRequest,
                  dinnerRequestResponses: prev.dinnerRequestResponses || updatedGroupData.dinnerRequestResponses
                };
              }
              return prev;
            });
          }, 100);
        }
        
      } else {
        console.error('❌ Failed to save response:', result.error);
        showAlert('Error', result.error, 'OK');
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      showAlert('Error', 'An unexpected error occurred while saving your response.', 'OK');
    }
  };

  const getCurrentUserResponseStatus = async () => {
    if (!dinnerRequestStatus?.hasActiveRequest) {
      return null;
    }
    
    // Get current user ID
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        return null;
      }
      
      const userResponse = memberResponses.find(r => r.userId === user.id);
      return userResponse ? userResponse.response : 'pending';
    } catch (error) {
      console.error('❌ Error getting current user response status:', error);
      return null;
    }
  };
  
  // Meal Request Functions
  const handleRequestMeal = async () => {
    if (!selectedGroup) return;
    
    console.log('🍽️ Starting meal request for group:', selectedGroup.group_name);
    
    // Check if we have preloaded meals first
    const { getPreloadedGroupMeals } = require('../lib/mealPreloadService');
    const preloadedMeals = getPreloadedGroupMeals(selectedGroup.group_id);
    
    // Only show loading if we don't have preloaded meals
    if (!preloadedMeals || preloadedMeals.length === 0) {
      setMealRequestLoading(true);
    }
    
    try {
      // Add timeout protection to prevent indefinite hanging
      const requestTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Meal request creation timeout after 20 seconds'));
        }, 20000);
      });
      
      const createPromise = createMealRequest(selectedGroup.group_id, mealCount);
      const result = await Promise.race([createPromise, requestTimeoutPromise]);
      
      if (result.success) {
        console.log('✅ Meal request created successfully');
        console.log('📋 [MEAL CREATE] Result:', result);
        
        // Update selected group state immediately to show voting buttons
        const updatedGroup = {
          ...selectedGroup,
          hasActiveMealRequest: true,
          activeMealRequest: {
            id: result.request.id,
            request_id: result.request.id,
            ...result.request,
            mealOptions: result.mealOptions || [],
            preloadedForVoting: true // Flag to indicate voting data is ready
          }
        };
        
        console.log('📋 [MEAL CREATE] Updating selectedGroup to:', updatedGroup);
        
        // Update state to show voting buttons instantly
        setSelectedGroup(updatedGroup);
        
        // Refresh groups list in background
        loadUserGroups();
        
        // Show success message
        showAlert(
          'Meal Session Created!',
          'Voting session has been created. You can now vote on meals, view results, or terminate the session.',
          'OK'
        );
        
      } else {
        console.log('❌ Meal request failed:', result.error);
        
        // Handle existing request found case with simple alert and immediate replacement
        if (result.error === 'EXISTING_REQUEST_FOUND' && result.existingRequest) {
          const existingReq = result.existingRequest;
          const mealCount = existingReq.mealOptions?.length || existingReq.totalOptions || 0;
          
          // Simple confirmation without complex modal states
          console.log('🔄 Active request found, asking user for replacement');
          
          // Use React Native's built-in Alert for simplicity
          Alert.alert(
            'Active Request Found',
            `${existingReq.requesterName} created a meal request on ${existingReq.createdDate} at ${existingReq.createdTime} with ${mealCount} meal options.\n\nWould you like to replace it with a new request?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  console.log('❌ User cancelled meal request replacement');
                  setMealRequestLoading(false);
                }
              },
              {
                text: 'Replace Request',
                style: 'destructive',
                onPress: () => {
                  console.log('✅ User confirmed meal request replacement');
                  handleReplaceMealRequest(existingReq.id);
                }
              }
            ],
            { cancelable: true }
          );
          return; // Don't show the regular alert
        }
        
        let alertTitle = 'Cannot Create Meal Request';
        let alertMessage = result.error;
        
        // Provide more helpful messages for common errors
        if (result.error.includes('Database setup required')) {
          alertTitle = 'Setup Required';
          alertMessage = 'The meal request feature needs to be set up in the database. Please try again in a few moments or contact support if this persists.';
        } else if (result.error.includes('already has an active meal request')) {
          alertTitle = 'Active Request Exists';
          alertMessage = 'This group already has an active meal request. You can view the voting session or clear old requests if needed.';
          
          // For active request conflicts, show options
          showConfirmDialog(
            'Active Request Found',
            'This group already has an active meal request. Would you like to view the current voting session or clear old requests?',
            'View Details',
            () => handleDebugActiveRequests()
          );
          return; // Don't show the regular alert
        } else if (result.error.includes('API error') || result.error.includes('Failed to fetch meals')) {
          alertTitle = 'Recipe Service Unavailable';
          alertMessage = 'Unable to fetch recipes right now. Please check your internet connection and try again.';
        }
        
        showAlert(alertTitle, alertMessage, 'OK');
      }
      
    } catch (error) {
      console.error('❌ Unexpected error creating meal request:', error);
      
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.message === 'Meal request creation timeout after 20 seconds') {
        errorMessage = 'Creating meal request is taking too long. Please check your connection and try again.';
      }
      
      // Use simple Alert instead of custom modal
      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setMealRequestLoading(false);
    }
  };

  // Handle replacing an existing meal request
  const handleReplaceMealRequest = async (existingRequestId) => {
    if (!selectedGroup) return;
    
    console.log('🔄 Replacing meal request for group:', selectedGroup.group_name);
    setMealRequestLoading(true);
    
    // Add timeout protection to prevent freezing
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request replacement timeout after 15 seconds'));
      }, 15000);
    });
    
    try {
      const replacePromise = replaceMealRequest(selectedGroup.group_id, mealCount, existingRequestId);
      const result = await Promise.race([replacePromise, timeoutPromise]);
      
      if (result.success) {
        console.log('✅ Meal request replaced successfully');
        
        // Update selected group state immediately to show voting buttons
        const updatedGroup = {
          ...selectedGroup,
          hasActiveMealRequest: true,
          activeMealRequest: {
            id: result.request.id,
            request_id: result.request.id,
            ...result.request,
            mealOptions: result.mealOptions || [],
            preloadedForVoting: true
          }
        };
        
        setSelectedGroup(updatedGroup);
        
        // Refresh groups list in background
        loadUserGroups();
        
        // Show success message using simple Alert
        Alert.alert(
          'Request Replaced!',
          result.message,
          [{ text: 'OK', style: 'default' }]
        );
        
      } else {
        console.log('❌ Meal request replacement failed:', result.error);
        Alert.alert(
          'Replacement Failed',
          result.error || 'Failed to replace the meal request. Please try again.',
          [{ text: 'OK', style: 'default' }]
        );
      }
      
    } catch (error) {
      console.error('❌ Unexpected error replacing meal request:', error);
      
      let errorMessage = 'An unexpected error occurred while replacing the request.';
      if (error.message === 'Request replacement timeout after 15 seconds') {
        errorMessage = 'Request replacement is taking too long. Please try again.';
      }
      
      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setMealRequestLoading(false);
    }
  };

  // Debug Functions for Active Requests
  const handleDebugActiveRequests = async () => {
    if (!selectedGroup) return;
    
    console.log('🔍 Debugging active requests for group:', selectedGroup.group_name);
    
    try {
      const result = await debugGetActiveRequests(selectedGroup.group_id);
      
      if (result.success && result.requests.length > 0) {
        const activeRequest = result.requests[0];
        const requestDate = new Date(activeRequest.created_at).toLocaleDateString();
        
        showConfirmDialog(
          'Active Meal Request Found',
          `Found active request created on ${requestDate}. This request has ${activeRequest.total_options || 0} meal options. Would you like to clear this request to create a new one?`,
          'Clear & Create New',
          () => handleClearActiveRequests()
        );
      } else {
        showAlert(
          'No Active Requests',
          'No active meal requests found. This might be a temporary issue. Please try creating a new request.',
          'OK'
        );
      }
    } catch (error) {
      console.error('❌ Error debugging active requests:', error);
      showAlert(
        'Debug Error',
        'Unable to check active requests. Please try again.',
        'OK'
      );
    }
  };

  const handleClearActiveRequests = async () => {
    if (!selectedGroup) return;
    
    console.log('🛑 Clearing active requests for group:', selectedGroup.group_name);
    setMealRequestLoading(true);
    
    try {
      const result = await debugCompleteAllActiveRequests(selectedGroup.group_id);
      
      if (result.success) {
        console.log('✅ Cleared active requests successfully');
        
        // Refresh groups to update status
        loadUserGroups();
        
        showAlert(
          'Requests Cleared',
          `Cleared ${result.completedRequests?.length || 0} active request(s). You can now create a new meal request.`,
          'Create New Request',
          () => {
            // Auto-trigger new meal request creation
            setTimeout(() => {
              handleRequestMeal();
            }, 500);
          }
        );
      } else {
        showAlert(
          'Clear Failed',
          result.error || 'Failed to clear active requests.',
          'OK'
        );
      }
    } catch (error) {
      console.error('❌ Error clearing active requests:', error);
      showAlert(
        'Clear Error',
        'An unexpected error occurred while clearing requests.',
        'OK'
      );
    } finally {
      setMealRequestLoading(false);
    }
  };

  // Terminate Session Function
  const handleTerminateSession = async () => {
    if (!selectedGroup || !selectedGroup.activeMealRequest) {
      console.log('❌ No selected group or active request found');
      showAlert(
        'Cannot Terminate',
        'No active voting session found to terminate.',
        'OK'
      );
      return;
    }
    
    const requestId = selectedGroup.activeMealRequest?.request_id || selectedGroup.activeMealRequest?.id;
    console.log('🛑 About to terminate session with ID:', requestId);
    console.log('🔍 Full activeMealRequest object:', selectedGroup.activeMealRequest);
    
    if (!requestId) {
      console.error('❌ No request ID found in activeMealRequest');
      showAlert(
        'Cannot Terminate',
        'Unable to find request ID. Please try refreshing the groups list.',
        'OK'
      );
      return;
    }
    
    // SIMPLIFIED: Just show the confirmation dialog directly
    showConfirmDialog(
      'Terminate Voting Session',
      'Are you sure you want to terminate this voting session? This will stop all voting and show the final results. This action cannot be undone.',
      'Terminate',
      async () => {
        console.log('🛑 User confirmed termination for request ID:', requestId);
        setMealRequestLoading(true);
        
        try {
          // STEP 1: Get top 3 voted meals before terminating the session
          console.log('🏆 Getting top 3 results before termination...');
          const topResultsResponse = await getTopVotedMeals(requestId);
          
          let topResults = null;
          if (topResultsResponse.success && topResultsResponse.topMeals && topResultsResponse.topMeals.length > 0) {
            topResults = topResultsResponse.topMeals.slice(0, 3); // Ensure we only get top 3
            console.log('✅ Successfully retrieved top 3 results:', topResults);
          } else {
            console.warn('⚠️ Could not get top results:', topResultsResponse.error);
            console.warn('⚠️ Response structure:', topResultsResponse);
            
            // Try alternative approach - get voting results directly
            console.log('🔄 Attempting to get voting results as fallback...');
            const { getVotingResults } = require('../lib/mealRequestService');
            const votingResultsResponse = await getVotingResults(requestId);
            
            if (votingResultsResponse.success && votingResultsResponse.results && votingResultsResponse.results.length > 0) {
              // Sort by yes votes and take top 3
              const sortedResults = votingResultsResponse.results
                .sort((a, b) => (b.yes_votes || 0) - (a.yes_votes || 0))
                .slice(0, 3);
              
              topResults = sortedResults;
              console.log('✅ Retrieved top 3 results from voting results fallback:', topResults);
            } else {
              console.warn('⚠️ Could not get voting results either:', votingResultsResponse.error);
            }
          }
          
          // Get final member responses (who is eating and who isn't)
          const finalMemberResponses = selectedGroup.dinnerRequestResponses || [];
          
          // STEP 2: Save terminated session to permanent storage
          console.log('💾 Saving terminated session to database...');
          const saveResult = await terminatedSessionsService.saveTerminatedSession(
            selectedGroup.group_id,
            selectedGroup.group_name,
            topResults && topResults.length > 0 ? topResults : [],
            finalMemberResponses
          );
          
          if (!saveResult.success) {
            console.error('❌ Failed to save terminated session:', saveResult.error);
            showAlert(
              'Save Error',
              'Failed to save session results. Please try again.',
              'OK'
            );
            setMealRequestLoading(false);
            return;
          }
          
          // STEP 3: Clean up all active session data
          console.log('🧹 Cleaning up all active session data...');
          const cleanupResult = await terminatedSessionsService.cleanupActiveSession(selectedGroup.group_id);
          
          if (!cleanupResult.success && !cleanupResult.partialSuccess) {
            console.warn('⚠️ Failed to cleanup active session:', cleanupResult.error);
            // Continue anyway - the session is still saved and terminated
          } else if (cleanupResult.partialSuccess) {
            console.warn('⚠️ Partial cleanup success:', cleanupResult.error);
            // Continue anyway - most cleanup was successful
          }
          
          console.log('✅ Session terminated and saved successfully');
          
          // STEP 4: COMPLETELY CLEAR all request information from local state
          if (selectedGroup) {
            console.log('🧹 Completely clearing all request information from selectedGroup');
            setSelectedGroup(prev => ({
              ...prev,
              hasActiveDinnerRequest: false,
              hasActiveMealRequest: false,
              activeDinnerRequest: null,
              activeMealRequest: null,
              dinnerRequestResponses: [],
              dinnerRequestSummary: null,
              // Mark as terminated to prevent any background updates from overriding
              _terminatedSession: true,
              _terminatedAt: new Date().toISOString()
            }));
            
            // Reset local acceptance state when session is terminated
            setUserLocallyAcceptedRequest(false);
          }
          
          // STEP 5: COMPLETELY CLEAR all request information from groups list
          console.log('🧹 Completely clearing all request information from groups list...');
          setGroups(prevGroups => {
            const updatedGroups = prevGroups.map(group => {
              if (group.group_id === selectedGroup.group_id) {
                console.log('🧹 Completely clearing request info from group:', group.group_name);
                return {
                  ...group,
                  hasActiveDinnerRequest: false,
                  hasActiveMealRequest: false,
                  activeDinnerRequest: null,
                  activeMealRequest: null,
                  dinnerRequestResponses: [],
                  dinnerRequestSummary: null,
                  // Mark as terminated to prevent background refresh from overriding
                  _terminatedSession: true,
                  _terminatedAt: new Date().toISOString()
                };
              }
              return group;
            });
            console.log('✅ Completely cleared all request information from groups');
            return updatedGroups;
          });
          
          // STEP 6: Update local terminated sessions state for immediate display
          console.log('📊 Updating local terminated sessions state for immediate display');
          setTerminatedSessionResults(prev => {
            const newMap = new Map(prev);
            newMap.set(selectedGroup.group_id, {
              groupId: selectedGroup.group_id,
              groupName: selectedGroup.group_name,
              results: topResults && topResults.length > 0 ? topResults : [],
              memberResponses: finalMemberResponses,
              terminatedAt: new Date().toISOString()
            });
            console.log('📊 Local terminated sessions updated:', newMap);
            return newMap;
          });
          
          // STEP 7: Wait longer before server refresh to ensure database updates complete
          // The terminated sessions should persist because they're now in the database
          setTimeout(() => {
            console.log('🔄 Performing delayed server refresh after termination...');
            console.log('📊 Current terminated sessions before refresh:', terminatedSessionResults.size);
            loadUserGroups();
          }, 3000); // Increased delay to allow database updates to complete
          
          // Show success message with results info
          const resultsCount = topResults ? topResults.length : 0;
          const successMessage = resultsCount > 0 
            ? `Voting session terminated! Top ${resultsCount} results are displayed below.`
            : 'Voting session terminated. No votes were recorded.';
            
          showAlert(
            'Session Terminated',
            successMessage,
            'OK'
          );
          
          // Auto-hide alert after 3 seconds
          setTimeout(() => {
            hideAlert();
          }, 3000);
          
        } catch (error) {
          console.error('❌ Error terminating session:', error);
          showAlert(
            'Termination Error',
            'An unexpected error occurred while terminating the session. Please try again.',
            'OK'
          );
        } finally {
          setMealRequestLoading(false);
        }
      }
    );
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigation.navigate('SignIn');
    } catch (error) {
      console.error('❌ Error signing out:', error);
      showAlert('Error', 'Failed to sign out. Please try again.');
    }
  };

  // Load favorite group on mount
  useEffect(() => {
    const loadFavoriteGroup = async () => {
      const favId = await getFavoriteGroupId();
      setFavoriteGroupId(favId);
    };
    loadFavoriteGroup();
  }, []);

  if (isGuest) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Floating Background Drawings */}
        <SafeDrawing source={require('../assets/drawing5.png')} style={styles.floatingDrawing1} />
        <SafeDrawing source={require('../assets/drawing6.jpg')} style={styles.floatingDrawing2} />
        <SafeDrawing source={require('../assets/drawing7.png')} style={styles.floatingDrawing3} />
        <SafeDrawing source={require('../assets/drawing8.png')} style={styles.floatingDrawing4} />
        <SafeDrawing source={require('../assets/drawing9.png')} style={styles.floatingDrawing5} />
        
        <View style={styles.guestContainer}>
          {/* Background Content - Blurred */}
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            style={styles.blurredBackground}
          >
            <View style={styles.header}>
              <Text style={styles.title}>My Cooking Groups</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
              <View style={styles.createButton}>
                <Text style={styles.createButtonText}>Create Group</Text>
              </View>
              
              <View style={styles.joinButton}>
                <Text style={styles.joinButtonText}>Join Group</Text>
              </View>
            </View>

            {/* Fake Groups List */}
            <View style={styles.groupsContainer}>
              <Text style={styles.sectionTitle}>Your Groups</Text>
              
              <View style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>Family Dinner Club</Text>
                    <Text style={styles.groupDescription}>Weekly meal planning with the family</Text>
                  </View>
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>Admin</Text>
                  </View>
                </View>
                
                <View style={styles.groupDetails}>
                  <View style={styles.groupDetail}>
                    <Text style={styles.detailLabel}>Join Code</Text>
                    <Text style={styles.detailValue}>ABC12345</Text>
                  </View>
                  <View style={styles.groupDetail}>
                    <Text style={styles.detailLabel}>Members</Text>
                    <Text style={styles.detailValue}>4</Text>
                  </View>
                  <View style={styles.groupDetail}>
                    <Text style={styles.detailLabel}>Created</Text>
                    <Text style={styles.detailValue}>Jan 15, 2024</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Overlay with Sign In Button */}
          <View style={styles.signInOverlay}>
            <View style={styles.signInCard}>
              <Text style={styles.signInTitle}>Sign In to View Groups</Text>
              <Text style={styles.signInSubtitle}>
                Create cooking groups, share recipes, and plan meals together with friends and family
              </Text>
              <TouchableOpacity 
                style={styles.signInButton}
                onPress={() => navigation.navigate('SignIn')}
              >
                <Text style={styles.signInButtonText}>Sign In to Your Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Floating Background Drawings */}
      <SafeDrawing source={require('../assets/drawing5.png')} style={styles.floatingDrawing1} />
      <SafeDrawing source={require('../assets/drawing6.jpg')} style={styles.floatingDrawing2} />
      <SafeDrawing source={require('../assets/drawing7.png')} style={styles.floatingDrawing3} />
      <SafeDrawing source={require('../assets/drawing8.png')} style={styles.floatingDrawing4} />
      <SafeDrawing source={require('../assets/drawing9.png')} style={styles.floatingDrawing5} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Cooking Groups</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.createButton} onPress={showCreateModalFunc}>
            <Text style={styles.createButtonText}>Create Group</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.joinButton} onPress={showJoinModalFunc}>
            <Text style={styles.joinButtonText}>Join Group</Text>
          </TouchableOpacity>
        </View>

        {/* Groups List */}
        <View style={styles.groupsContainer}>
          <Text style={styles.sectionTitle}>Your Groups</Text>
          
          {groupsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B7355" />
              <Text style={styles.loadingText}>Loading your groups...</Text>
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Groups Yet</Text>
              <Text style={styles.emptyText}>
                Create your first cooking group or join an existing one to get started!
              </Text>
            </View>
          ) : (
            groups.map((group) => (
              <TouchableOpacity 
                key={group.group_id} 
                style={[
                  styles.groupCard,
                  (group.hasActiveMealRequest || group.hasActiveDinnerRequest) && styles.shinyGroupCard
                ]}
                onPress={() => openGroupDetailModal(group)}
                activeOpacity={0.7}
              >
                <View style={styles.groupHeader}>
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>{group.group_name}</Text>
                    {group.group_description ? (
                      <Text style={styles.groupDescription}>{group.group_description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.groupActions}>
                    <TouchableOpacity
                      style={styles.starButton}
                      onPress={(e) => {
                        e.stopPropagation(); // Prevent opening detail modal
                        if (group.group_id !== favoriteGroupId) {
                          withCooldown(async () => {
                            const result = await setFavoriteGroup(group.group_id);
                            if (result.success) {
                              setFavoriteGroupId(group.group_id);
                            } else {
                              showAlert('Error', result.error);
                            }
                          });
                        }
                      }}
                    >
                      <Text style={[styles.starIcon, group.group_id === favoriteGroupId && styles.starIconActive]}>
                        ★
                      </Text>
                    </TouchableOpacity>
                    <View style={[
                      styles.groupBadge,
                      (group.hasActiveMealRequest || group.hasActiveDinnerRequest) && styles.activeMealBadge
                    ]}>
                      <Text style={styles.groupBadgeText}>
                        {group.hasActiveMealRequest 
                          ? 'Voting' 
                          : group.hasActiveDinnerRequest 
                            ? 'Dinner Request'
                            : (group.is_creator ? 'Admin' : group.user_role)}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.groupDetails}>
                  <View style={styles.membersDetail}>
                    <Text style={styles.detailLabel}>Members</Text>
                    <Text style={styles.detailValue}>{group.member_count}</Text>
                  </View>
                  <View style={styles.groupDetail}>
                    <Text style={styles.detailLabel}>Created</Text>
                    <Text style={styles.detailValue}>{formatDate(group.created_at)}</Text>
                  </View>
                </View>

                {/* Join Code and Action Button Row */}
                <View style={styles.joinCodeActionRow}>
                  <View style={styles.joinCodeSection}>
                    <Text style={styles.detailLabel}>Join Code</Text>
                    <Text style={styles.joinCodeValue}>{group.join_code}</Text>
                  </View>
                  
                  {group.is_creator ? (
                    <TouchableOpacity 
                      style={styles.compactDeleteButton}
                      onPress={(e) => {
                        e.stopPropagation(); // Prevent opening detail modal
                        withCooldown(() => handleDeleteGroup(group.group_id, group.group_name));
                      }}
                    >
                      <Text style={styles.compactDeleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.compactLeaveButton}
                      onPress={(e) => {
                        e.stopPropagation(); // Prevent opening detail modal
                        withCooldown(() => handleLeaveGroup(group.group_id, group.group_name));
                      }}
                    >
                      <Text style={styles.compactLeaveButtonText}>Leave</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Profile Actions */}
        <View style={styles.profileActionContainer}>
          <TouchableOpacity 
            style={styles.editProfileButton}
            onPress={() => navigation.navigate('Profile', { isGuest: false })}
          >
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Create Group Modal */}
      <Modal visible={showCreateModal} transparent={true} animationType="none">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackground} activeOpacity={1} onPress={hideCreateModal} />
          
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [{ scale: createAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                opacity: createAnimation,
              },
            ]}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create New Group</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Group Name</Text>
                <TextInput
                  style={styles.input}
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="Enter group name"
                  placeholderTextColor="#A0A0A0"
                  maxLength={50}
                />
              </View>



              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={hideCreateModal}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.confirmButton, loading && styles.buttonDisabled]} 
                  onPress={() => withCooldown(() => handleCreateGroup())}
                  disabled={loading}
                >
                  <Text style={styles.confirmButtonText}>
                    {loading ? 'Creating...' : 'Create Group'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Join Group Modal */}
      <Modal visible={showJoinModal} transparent={true} animationType="none">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackground} activeOpacity={1} onPress={hideJoinModal} />
          
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [{ scale: joinAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                opacity: joinAnimation,
              },
            ]}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Join Group</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Join Code</Text>
                <TextInput
                  style={styles.input}
                  value={joinCode}
                  onChangeText={(text) => setJoinCode(text.toUpperCase())}
                  placeholder="Enter 8-character join code"
                  placeholderTextColor="#A0A0A0"
                  maxLength={8}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={hideJoinModal}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.confirmButton, loading && styles.buttonDisabled]} 
                  onPress={() => withCooldown(() => handleJoinGroup())}
                  disabled={loading}
                >
                  <Text style={styles.confirmButtonText}>
                    {loading ? 'Joining...' : 'Join Group'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Custom Alert Modal */}
      <Modal visible={alertVisible} transparent={true} animationType="none" onRequestClose={hideAlert} statusBarTranslucent={true}>
        <View style={styles.alertOverlay}>
          {/* Touchable background to dismiss alert */}
          <TouchableOpacity 
            style={styles.alertBackground}
            activeOpacity={1}
            onPress={hideAlert}
          />
          
          <Animated.View 
            style={[
              styles.alertContainer,
              {
                transform: [
                  {
                    scale: alertAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: alertAnimation,
              },
            ]}
          >
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>{alertTitle}</Text>
              <Text style={styles.alertMessage}>{alertMessage}</Text>
              
              {isConfirmDialog ? (
                // Confirmation dialog with Cancel and Confirm buttons
                <View style={styles.confirmButtonContainer}>
                  <TouchableOpacity style={styles.cancelConfirmButton} onPress={handleCancel}>
                    <Text style={styles.cancelConfirmButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.confirmButton,
                      alertButtonText.includes('Delete') && styles.deleteConfirmButton
                    ]} 
                    onPress={handleConfirm}
                  >
                    <Text style={[
                      styles.confirmButtonText,
                      alertButtonText.includes('Delete') && styles.deleteConfirmButtonText
                    ]}>
                      {alertButtonText}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                // Regular alert with single OK button
                <TouchableOpacity style={styles.alertButton} onPress={alertOnPress}>
                  <Text style={styles.alertButtonText}>{alertButtonText}</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Group Detail Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={showGroupDetailModal}
        onRequestClose={hideGroupDetailModal}
      >
        <View style={styles.groupModalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackground} 
            activeOpacity={1} 
            onPress={hideGroupDetailModal} 
          />
          
          <View style={styles.perspectiveContainer}>
            <Animated.View 
              style={[
                styles.flipCardContainer,
                {
                  transform: [
                    {
                      scale: groupDetailAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    }
                  ],
                  opacity: groupDetailAnimation,
                },
              ]}
            >
              {/* Front Side - Group Details */}
              <Animated.View 
                style={[
                  styles.flipCardFront,
                  {
                    transform: [
                      { 
                        rotateY: flipAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '-180deg'],
                        })
                      }
                    ],
                    opacity: flipAnimation.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1, 0, 0],
                    }),
                  }
                ]}
                pointerEvents={showMembersView ? 'none' : 'auto'}
              >
            {/* Modal Header */}
            <View style={styles.groupModalHeader}>
              <TouchableOpacity style={styles.backButton} onPress={hideGroupDetailModal}>
                <Text style={styles.backArrow}>←</Text>
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
              <Text style={styles.headerGroupName}>{selectedGroup?.group_name}</Text>
              
              {/* Request Meal Button or Member Count */}
              {(() => {
                const hasActiveDinnerRequest = selectedGroup?.hasActiveDinnerRequest;
                const hasActiveMealRequest = selectedGroup?.hasActiveMealRequest;
                const showRequestMealButton = !hasActiveDinnerRequest && !hasActiveMealRequest;
                
                return showRequestMealButton ? (
                  <TouchableOpacity 
                    style={styles.headerRequestMealButton}
                    onPress={() => {
                      console.log('📍 Request Meal button pressed for group:', selectedGroup?.group_name);
                      console.log('📍 Navigating to MainProfileScreen with pre-selected group');
                      
                      // Close the modal
                      hideGroupDetailModal();
                      
                      // Navigate to MainProfileScreen with the group pre-selected
                      if (navigation && navigation.navigate) {
                        navigation.navigate('Profile', {
                          preSelectedGroup: {
                            group_id: selectedGroup?.group_id,
                            group_name: selectedGroup?.group_name,
                            member_count: selectedGroup?.member_count
                          }
                        });
                      } else {
                        console.log('💡 Navigation not available, please navigate to Profile tab manually');
                      }
                    }}
                  >
                    <Text style={styles.headerRequestMealButtonText}>Request Meal</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.headerMemberCount}>({selectedGroup?.member_count} Members)</Text>
                );
              })()}
            </View>

            {/* Modal Content */}
            <ScrollView style={styles.groupModalContent} showsVerticalScrollIndicator={false}>
              {selectedGroup && (
                <View style={styles.groupModalInfo}>

                  {selectedGroup.group_description && (
                    <View style={styles.groupModalDescription}>
                      <Text style={styles.groupModalSectionTitle}>Description</Text>
                      <Text style={styles.groupDescriptionText}>{selectedGroup.group_description}</Text>
                    </View>
                  )}

                  <View style={styles.groupModalDescription}>
                    <Text style={styles.groupModalSectionTitle}>Join Code</Text>
                    <View style={styles.joinCodeContainer}>
                      <Text style={styles.joinCodeDisplay}>{selectedGroup.join_code}</Text>
                      <TouchableOpacity 
                        style={styles.copyButton}
                        onPress={() => copyJoinCode(selectedGroup.join_code)}
                      >
                        <Text style={styles.copyButtonText}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                  </View>



                  {/* Dinner Request Response Buttons */}
                  {selectedGroup.hasActiveDinnerRequest && (
                    <View style={styles.dinnerRequestResponseSection}>
                      <UserResponseButtons 
                        memberResponses={selectedGroup.dinnerRequestResponses || []}
                        onResponse={handleDinnerRequestResponse}
                        dinnerRequestData={selectedGroup.activeDinnerRequest}
                        groupName={selectedGroup.group_name}
                        onLocalAccept={() => {
                          console.log('🚀 [INSTANT] User clicked YES - showing voting buttons immediately');
                          setUserLocallyAcceptedRequest(true);
                        }}
                      />

                    </View>
                  )}

                  {/* Action Buttons - Show INSTANTLY when user clicks YES (optimistic UI) */}
                  {selectedGroup && (() => {
                    console.log('📋 [RENDER DEBUG] Checking voting buttons for:', selectedGroup?.group_name);
                    
                    // INSTANT BUTTON DISPLAY: Show buttons immediately if user clicked YES locally
                    const userLocallyAccepted = userLocallyAcceptedRequest;
                    const userAcceptedRequest = currentUserAcceptedDinnerRequest(); // Supabase check (backup)
                    const hasActiveDinnerRequest = selectedGroup?.hasActiveDinnerRequest;
                    
                    // Show buttons if:
                    // 1. User clicked YES locally (instant) OR confirmed via Supabase (backup) AND
                    // 2. There's still an active dinner request (meal session exists since request creation)
                    const shouldShowButtons = (userLocallyAccepted || userAcceptedRequest) && hasActiveDinnerRequest;
                    
                    console.log('📋 [RENDER DEBUG] userLocallyAccepted:', userLocallyAccepted);
                    console.log('📋 [RENDER DEBUG] userAcceptedRequest:', userAcceptedRequest);
                    console.log('📋 [RENDER DEBUG] hasActiveDinnerRequest:', hasActiveDinnerRequest);
                    console.log('📋 [RENDER DEBUG] FINAL RESULT:', shouldShowButtons);
                    
                    return shouldShowButtons;
                  })() && (
                    <View style={styles.groupModalActions}>
                      <Text style={styles.activeSectionTitle}>Active Voting Session</Text>
                      
                      {/* Vote Button - Only show if user hasn't completed voting */}
                      {selectedGroup && !userVotingComplete.get(selectedGroup?.group_id) && (
                        <TouchableOpacity 
                          style={styles.voteButtonNew}
                          onPress={() => {
                          const requestId = selectedGroup?.activeMealRequest?.request_id || selectedGroup?.activeMealRequest?.id;
                          console.log('🗳️ Navigating to voting screen for request:', requestId);
                          console.log('🔍 Full activeMealRequest:', selectedGroup?.activeMealRequest);
                          
                          if (!requestId) {
                            console.error('❌ No request ID found in activeMealRequest');
                            showAlert('Error', 'Cannot start voting: No active meal request found.', 'OK');
                            return;
                          }
                          
                          // If we have preloaded meals, transition instantly
                          if (selectedGroup?.activeMealRequest?.preloadedForVoting) {
                            console.log('✨ Using preloaded meals for instant voting transition');
                            hideGroupDetailModal();
                            navigation.navigate('VotingScreen', {
                              requestId: requestId,
                              groupName: selectedGroup?.group_name,
                              groupId: selectedGroup?.group_id,
                              preloadedMealOptions: selectedGroup?.activeMealRequest?.mealOptions || [],
                              returnToGroupModal: true // Flag to indicate we should return to group modal
                            });
                          } else {
                            // Show loading state and fetch meals if not preloaded
                            console.log('⚠️ No preloaded meals, fetching before transition...');
                            setMealRequestLoading(true);
                            
                            // Get meals and then transition
                            getMealOptions(requestId)
                              .then(result => {
                                setMealRequestLoading(false);
                                if (result.success) {
                                  hideGroupDetailModal();
                                  navigation.navigate('VotingScreen', {
                                    requestId: requestId,
                                    groupName: selectedGroup?.group_name,
                                    groupId: selectedGroup?.group_id,
                                    preloadedMealOptions: result.options || [],
                                    returnToGroupModal: true // Flag to indicate we should return to group modal
                                  });
                                } else {
                                  showAlert('Error', 'Failed to load meal options. Please try again.', 'OK');
                                }
                              })
                              .catch(() => {
                                setMealRequestLoading(false);
                                showAlert('Error', 'Failed to load meal options. Please try again.', 'OK');
                              });
                          }
                        }}
                      >
                        <Text style={styles.voteButtonTextNew}>Vote</Text>
                      </TouchableOpacity>
                      )}
                      
                      {/* Reveal Results Button */}
                      <TouchableOpacity 
                        style={styles.revealButtonNew}
                        onPress={() => {
                          const requestId = selectedGroup?.activeMealRequest?.request_id || selectedGroup?.activeMealRequest?.id;
                          
                          if (!requestId) {
                            console.error('❌ No request ID found for results');
                            showAlert('Error', 'Cannot show results: No active meal request found.', 'OK');
                            return;
                          }
                          
                          hideGroupDetailModal();
                          navigation.navigate('ResultsScreen', {
                            requestId: requestId,
                            groupName: selectedGroup?.group_name,
                            groupId: selectedGroup?.group_id,
                            returnToGroupModal: true // Flag to indicate we should return to group modal
                          });
                        }}
                      >
                        <Text style={styles.revealButtonTextNew}>Reveal Results</Text>
                      </TouchableOpacity>
                      
                      {/* Terminate Session Button */}
                      <TouchableOpacity 
                        style={styles.terminateButtonNew}
                        onPress={() => {
                          console.log('🔘 Terminate button pressed');
                          console.log('🔍 Current state:', { alertVisible, isConfirmDialog, showGroupDetailModal });
                          withCooldown(() => handleTerminateSession());
                        }}
                      >
                        <Text style={styles.terminateButtonTextNew}>Terminate Session</Text>
                      </TouchableOpacity>
                    </View>
                  )}



                  {/* Members Section */}
                  <View style={styles.groupModalDescription}>
                    <Text style={styles.groupModalSectionTitle}>Members</Text>
                    {membersLoading ? (
                      <View style={styles.membersLoadingContainer}>
                        <ActivityIndicator size="small" color="#8B7355" />
                        <Text style={styles.membersLoadingText}>Loading members...</Text>
                      </View>
                    ) : membersError ? (
                      <View style={styles.membersErrorContainer}>
                        <Text style={styles.membersErrorTitle}>Unable to Load Members</Text>
                        <Text style={styles.membersErrorMessage}>{membersError}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={loadGroupMembers}>
                          <Text style={styles.retryButtonText}>Try Again</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <View style={styles.membersHeader}>
                          <Text style={styles.membersTitle}>
                            {members.length} {members.length === 1 ? 'Member' : 'Members'}
                          </Text>
                        </View>

                        {members.map((member, index) => {
                          const responseStatus = getMemberResponseStatus(member.user_id);
                          return (
                            <View key={member.user_id || index} style={styles.memberCard}>
                              <View style={styles.memberInfo}>
                                <View style={styles.memberDetails}>
                                  <Text style={styles.memberName}>
                                    {member.user_name || member.full_name || 'Unknown User'}
                                  </Text>
                                  <Text style={styles.memberEmail}>
                                    {member.email || 'No email available'}
                                  </Text>
                                </View>
                                
                                <View style={styles.memberBadges}>
                                  {/* Dinner Request Response Indicator */}
                                  {responseStatus && (
                                    <View style={[styles.responseIndicator, getResponseIndicatorStyle(responseStatus)]}>
                                      <Text style={[styles.responseText, { color: getResponseIndicatorStyle(responseStatus).color }]}>
                                        {getResponseText(responseStatus)}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </View>
                          );
                        })}

                        {members.length === 0 && (
                          <View style={styles.emptyMembersState}>
                            <Text style={styles.emptyMembersTitle}>No Members Found</Text>
                            <Text style={styles.emptyMembersText}>This group doesn't have any members yet.</Text>
                          </View>
                        )}
                      </>
                    )}

                    {/* Terminated Session Results - Show Top 3 Meals + Member Responses */}
                    {selectedGroup && (() => {
                      const groupResults = terminatedSessionResults.get(selectedGroup?.group_id);
                      console.log('🔍 [RESULTS DEBUG] Group ID:', selectedGroup?.group_id);
                      console.log('🔍 [RESULTS DEBUG] Terminated results map:', terminatedSessionResults);
                      console.log('🔍 [RESULTS DEBUG] Group results:', groupResults);
                      
                      return groupResults && (
                        <View style={styles.terminatedResultsSection}>
                          <Text style={styles.terminatedResultsTitle}>Final Results</Text>
                          
                          {/* Member Responses Section */}
                          {groupResults.memberResponses && groupResults.memberResponses.length > 0 && (
                            <View style={styles.memberResponsesSection}>
                              <Text style={styles.memberResponsesTitle}>Who's Eating</Text>
                              <View style={styles.memberResponsesGrid}>
                                {groupResults.memberResponses.map((response, index) => {
                                  const member = members.find(m => m.user_id === response.userId);
                                  const memberName = member?.user_name || member?.full_name || 'Unknown';
                                  const isEating = response.response === 'accepted';
                                  
                                  return (
                                    <View key={index} style={[
                                      styles.memberResponseItem,
                                      isEating ? styles.memberResponseEating : styles.memberResponseNotEating
                                    ]}>
                                      <Text style={[
                                        styles.memberResponseName,
                                        isEating ? styles.memberResponseEatingText : styles.memberResponseNotEatingText
                                      ]}>
                                        {memberName}
                                      </Text>
                                      <Text style={[
                                        styles.memberResponseStatus,
                                        isEating ? styles.memberResponseEatingText : styles.memberResponseNotEatingText
                                      ]}>
                                        {isEating ? 'Eating' : 'Not eating'}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                            </View>
                          )}
                          
                          {/* Top 3 Meals Section */}
                          {groupResults.results && groupResults.results.length > 0 && (
                            <View style={styles.topMealsSection}>
                              <Text style={styles.topMealsTitle}>Top {groupResults.results.length} Voted Meals</Text>
                              
                              {groupResults.results.map((meal, index) => {
                                console.log(`🔍 [RESULTS DEBUG] Meal ${index + 1}:`, meal);
                                return (
                                  <View key={index} style={styles.resultMealItem}>
                                    <View style={styles.resultMealRank}>
                                      <Text style={styles.resultMealRankText}>#{index + 1}</Text>
                                    </View>
                                    
                                    <View style={styles.resultMealContent}>
                                      <Text style={styles.resultMealName} numberOfLines={2}>
                                        {meal.meal_data?.name || meal.name || 'Unnamed Recipe'}
                                      </Text>
                                      <Text style={styles.resultMealVotes}>
                                        {meal.yes_votes || 0} yes • {meal.no_votes || 0} no
                                      </Text>
                                      {(meal.meal_data?.description || meal.description) && (
                                        <Text style={styles.resultMealDescription} numberOfLines={2}>
                                          {meal.meal_data?.description || meal.description}
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                          
                          <TouchableOpacity 
                            style={styles.clearResultsButton}
                            onPress={async () => {
                              console.log('🧹 Clearing all results for group:', selectedGroup?.group_name);
                              console.log('🧹 Current terminated sessions before clear:', terminatedSessionResults.size);
                              
                              // Clear from database
                              const clearResult = await terminatedSessionsService.clearTerminatedSession(selectedGroup?.group_id);
                              
                              if (clearResult.success) {
                                // Clear from local state
                                setTerminatedSessionResults(prev => {
                                  const newMap = new Map(prev);
                                  newMap.delete(selectedGroup?.group_id);
                                  console.log('🧹 Terminated sessions after clear:', newMap.size);
                                  return newMap;
                                });
                                
                                // Also clear any terminated session markers from group state
                                if (selectedGroup?._terminatedSession) {
                                  setSelectedGroup(prev => ({
                                    ...prev,
                                    _terminatedSession: false,
                                    _terminatedAt: null
                                  }));
                                }
                                
                                console.log('✅ Successfully cleared results for group:', selectedGroup?.group_name);
                              } else {
                                console.error('❌ Failed to clear results:', clearResult.error);
                                showAlert(
                                  'Clear Error',
                                  'Failed to clear results. Please try again.',
                                  'OK'
                                );
                              }
                            }}
                          >
                            <Text style={styles.clearResultsButtonText}>Clear Results</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })()}
                  </View>
                </View>
              )}


            </ScrollView>
              </Animated.View>


            </Animated.View>
          </View>
        </View>
      </Modal>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEFEFE',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 90,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerLogo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    lineHeight: 40,
    color: '#2D2D2D',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#6B6B6B',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  createButton: {
    flex: 1,
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  joinButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#8B7355',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#8B7355',
    letterSpacing: 0.2,
  },
  groupsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    lineHeight: 30,
    color: '#2D2D2D',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#6B6B6B',
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'rgba(248, 246, 243, 0.5)',
    borderRadius: 16,
  },
  emptyTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    lineHeight: 26,
    color: '#2D2D2D',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  groupCard: {
    backgroundColor: 'rgba(248, 246, 243, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  groupInfo: {
    flex: 1,
    marginRight: 12,
  },
  groupName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    lineHeight: 26,
    color: '#2D2D2D',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  groupDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  groupBadge: {
    backgroundColor: '#8B7355',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  groupBadgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#FEFEFE',
    letterSpacing: 0.1,
  },
  groupDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  membersDetail: {
    flex: 1,
    alignItems: 'flex-start',
    marginRight: 16,
  },
  groupDetail: {
    flex: 1,
    alignItems: 'flex-end',
  },
  detailLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#A0A0A0',
    marginBottom: 4,
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#2D2D2D',
    letterSpacing: 0.1,
  },
  leaveButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8B7355',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  leaveButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#8B7355',
    letterSpacing: 0.1,
  },
  deleteButton: {
    backgroundColor: '#CC4444',
    borderWidth: 1,
    borderColor: '#CC4444',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#CC4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  deleteButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.1,
  },
  guestContainer: {
    flex: 1,
    position: 'relative',
  },
  blurredBackground: {
    flex: 1,
    opacity: 0.3,
  },
  signInOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  signInCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#2D2D2D',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    alignItems: 'center',
  },
  signInTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    lineHeight: 34,
    color: '#2D2D2D',
    marginBottom: 16,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  signInSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: '#6B6B6B',
    marginBottom: 28,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 45, 45, 0.6)',
    paddingHorizontal: 24,
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: '#FEFEFE',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 300,
    maxWidth: '90%',
    shadowColor: '#2D2D2D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalContent: {
    alignItems: 'center',
    width: '100%',
  },
  modalTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    lineHeight: 30,
    color: '#2D2D2D',
    marginBottom: 24,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#2D2D2D',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  input: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#2D2D2D',
    backgroundColor: 'rgba(248, 246, 243, 0.8)',
    borderWidth: 1,
    borderColor: '#E8E6E3',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16, // Increased from 12 to 16 to prevent text cutoff
    letterSpacing: 0.1,
    minHeight: 48, // Ensure consistent minimum height
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E8E6E3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#8B7355',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  alertOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 45, 45, 0.6)',
    paddingHorizontal: 24,
  },
  alertBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  alertContainer: {
    backgroundColor: '#FEFEFE',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 300,
    maxWidth: '90%',
    shadowColor: '#2D2D2D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  alertContent: {
    alignItems: 'center',
    width: '100%',
  },
  alertTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    lineHeight: 34,
    color: '#2D2D2D',
    marginBottom: 16,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  alertMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 28,
    letterSpacing: 0.1,
  },
  alertButton: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  alertButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  confirmButtonContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelConfirmButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E8E6E3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelConfirmButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  deleteConfirmButton: {
    backgroundColor: '#CC4444',
    shadowColor: '#CC4444',
  },
  deleteConfirmButtonText: {
    color: '#FEFEFE',
  },
  // Floating Background Drawings
  floatingDrawing1: {
    position: 'absolute',
    top: '8%',
    left: '5%',
    width: 120,
    height: 120,
    opacity: 0.08,
    zIndex: -1,
    transform: [{ rotate: '12deg' }],
  },
  floatingDrawing2: {
    position: 'absolute',
    top: '25%',
    right: '8%',
    width: 100,
    height: 100,
    opacity: 0.06,
    zIndex: -1,
    transform: [{ rotate: '-8deg' }],
  },
  floatingDrawing3: {
    position: 'absolute',
    top: '50%',
    left: '10%',
    width: 110,
    height: 110,
    opacity: 0.07,
    zIndex: -1,
    transform: [{ rotate: '15deg' }],
  },
  floatingDrawing4: {
    position: 'absolute',
    top: '75%',
    right: '15%',
    width: 90,
    height: 90,
    opacity: 0.05,
    zIndex: -1,
    transform: [{ rotate: '-12deg' }],
  },
  floatingDrawing5: {
    position: 'absolute',
    top: '88%',
    left: '15%',
    width: 85,
    height: 85,
    opacity: 0.06,
    zIndex: -1,
    transform: [{ rotate: '9deg' }],
  },
  signInButton: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  signInButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
     joinCodeActionRow: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     marginTop: 8,
   },
   joinCodeSection: {
     flex: 1,
     alignItems: 'flex-start',
     marginRight: 16,
   },
  joinCodeValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#2D2D2D',
    letterSpacing: 0.1,
  },
     compactDeleteButton: {
     backgroundColor: '#CC4444',
     borderWidth: 1,
     borderColor: '#CC4444',
     borderRadius: 6,
     paddingVertical: 8,
     paddingHorizontal: 56,
     alignItems: 'center',
     minWidth: 90,
     shadowColor: '#CC4444',
     shadowOffset: { width: 0, height: 1 },
     shadowOpacity: 0.2,
     shadowRadius: 2,
     elevation: 1,
   },
   compactDeleteButtonText: {
     fontFamily: 'Inter_500Medium',
     fontSize: 13,
     lineHeight: 18,
     color: '#FEFEFE',
     letterSpacing: 0.1,
   },
   compactLeaveButton: {
     backgroundColor: 'transparent',
     borderWidth: 1,
     borderColor: '#8B7355',
     borderRadius: 6,
     paddingVertical: 8,
     paddingHorizontal: 58,
     alignItems: 'center',
     minWidth: 90,
   },
   compactLeaveButtonText: {
     fontFamily: 'Inter_500Medium',
     fontSize: 13,
     lineHeight: 18,
     color: '#8B7355',
     letterSpacing: 0.1,
   },
  shinyGroupCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.05)', // Light gold tint
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)', // Gold border
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  activeMealBadge: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  groupDetailModal: {
    backgroundColor: '#FEFEFE',
    borderRadius: 20,
    padding: 32,
    alignItems: 'stretch',
    shadowColor: '#2D2D2D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  groupDetailContent: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabelModal: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#2D2D2D',
    letterSpacing: 0.1,
  },
  detailValueModal: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    letterSpacing: 0.1,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  joinCodeValueModal: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
    color: '#8B7355',
    letterSpacing: 1.5,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  mealRequestSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  activeMealRequestInfo: {
    flex: 1,
    marginLeft: 16,
  },
  activeMealRequestText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#8B7355',
    textAlign: 'right',
  },
  mealRequestDetail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#6B6B6B',
    textAlign: 'right',
    marginTop: 2,
  },
  noMealRequestText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  groupDetailButtons: {
    flexDirection: 'column',
    gap: 12,
  },
  requestMealButton: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  requestMealButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  viewVotingButton: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  viewVotingButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E8E6E3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  
  // New Group Detail Modal Styles (matching IdeasScreen structure)
  groupModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(45, 45, 45, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 50,
  },
  
  perspectiveContainer: {
    perspective: 1000,
    width: '100%',
    maxWidth: 380,
    height: '95%',
  },
  
  flipCardContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  
  flipCardFront: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#FEFEFE',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#2D2D2D',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    backfaceVisibility: 'hidden',
  },
  
  flipCardBack: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#FEFEFE',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#2D2D2D',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    backfaceVisibility: 'hidden',
  },
  
  groupModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3F0',
    backgroundColor: '#FEFEFE',
  },
  
  membersButton: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  
  membersButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F5F3F0',
  },
  
  backArrow: {
    fontFamily: 'Inter_500Medium',
    fontSize: 18,
    color: '#8B7355',
    marginRight: 6,
  },
  
  backText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#8B7355',
    letterSpacing: 0.2,
  },
  headerGroupName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    lineHeight: 26,
    color: '#2D2D2D',
    letterSpacing: 0.3,
    flex: 1,
    textAlign: 'center',
  },
  headerMemberCount: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  
  groupModalContent: {
    flex: 1,
    backgroundColor: '#FEFEFE',
  },
  
  groupModalInfo: {
    padding: 32,
  },
  
  groupModalTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    lineHeight: 34,
    color: '#2D2D2D',
    marginBottom: 26,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  
  groupModalMetrics: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 30,
    gap: 20,
  },
  
  groupModalMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  
  groupMetricLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#8B7355',
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  
  groupMetricValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 22,
    color: '#2D2D2D',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  
  groupModalDescription: {
    marginBottom: 26,
  },
  
  groupModalSectionTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: '#2D2D2D',
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  
  groupDescriptionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  
  joinCodeContainer: {
    backgroundColor: '#F5F3F0',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E8E6E3',
  },
  
  joinCodeDisplay: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    lineHeight: 26,
    color: '#8B7355',
    letterSpacing: 2,
    flex: 1,
  },
  
  copyButton: {
    backgroundColor: '#8B7355',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginLeft: 12,
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  
  copyButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.1,
  },
  
  activeMealRequestContainer: {
    alignItems: 'center',
  },
  
  activeMealRequestBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 8,
  },
  
  activeMealRequestBadgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 18,
    color: '#2D2D2D',
    letterSpacing: 0.1,
  },
  
  mealRequestDateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  
  noMealRequestTextNew: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: '#6B6B6B',
    letterSpacing: 0.1,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  groupModalActions: {
    alignItems: 'center',
    marginTop: 12,
  },
  
  requestMealButtonNew: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingHorizontal: 36,
    paddingVertical: 16,
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  
  requestMealButtonTextNew: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.3,
  },
  
  viewVotingButtonNew: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingHorizontal: 36,
    paddingVertical: 16,
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  
  viewVotingButtonTextNew: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.3,
  },
  
  debugButtonNew: {
    backgroundColor: '#6B6B6B',
    borderRadius: 12,
    paddingHorizontal: 36,
    paddingVertical: 16,
    shadowColor: '#6B6B6B',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  
  debugButtonTextNew: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 18,
    color: '#FEFEFE',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  
  activeSectionTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 16,
    lineHeight: 22,
    color: '#2D2D2D',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  
  voteButtonNew: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingHorizontal: 36,
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  
  voteButtonTextNew: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  
  revealButtonNew: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingHorizontal: 36,
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  
  revealButtonTextNew: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  
  terminateButtonNew: {
    backgroundColor: '#CC4444',
    borderRadius: 12,
    paddingHorizontal: 36,
    paddingVertical: 16,
    shadowColor: '#CC4444',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  
  terminateButtonTextNew: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  

  
  // Members Styles
  membersLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  
  membersLoadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#6B6B6B',
    marginTop: 16,
    textAlign: 'center',
  },
  
  membersErrorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  
  membersErrorTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    lineHeight: 26,
    color: '#2D2D2D',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  membersErrorMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    marginBottom: 24,
    textAlign: 'center',
  },
  
  retryButton: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  
  retryButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.1,
  },
  
  membersHeader: {
    marginBottom: 20,
  },
  
  membersTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: '#2D2D2D',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  
  memberCard: {
    backgroundColor: 'rgba(248, 246, 243, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 115, 85, 0.1)',
  },
  
  memberInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  
  memberDetails: {
    flex: 1,
    marginRight: 12,
  },
  
  memberName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 16,
    lineHeight: 22,
    color: '#2D2D2D',
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  
  memberEmail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#6B6B6B',
    marginBottom: 3,
    letterSpacing: 0.1,
  },
  
  memberJoinDate: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 15,
    color: '#A0A0A0',
    letterSpacing: 0.1,
  },
  
  memberBadges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  
  responseIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 60,
    alignItems: 'center',
  },
  
  responseText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  
  roleText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.1,
  },
  
  emptyMembersState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  
  emptyMembersTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: '#2D2D2D',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  
  emptyMembersText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  
  // Meal Count Slider Styles
  mealCountContainer: {
    backgroundColor: 'rgba(248, 246, 243, 0.8)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 115, 85, 0.2)',
  },
  mealCountLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#2D2D2D',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  sliderContainer: {
    alignItems: 'center',
  },
  sliderValue: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: '#8B7355',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 8,
  },
  sliderThumb: {
    backgroundColor: '#8B7355',
    width: 20,
    height: 20,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  sliderLabelText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  
  // Meal Options Sliders Styles
  mealOptionsContainer: {
    backgroundColor: 'rgba(248, 246, 243, 0.8)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 115, 85, 0.2)',
  },
  
  sliderSection: {
    marginBottom: 20,
  },
  
  sliderLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#2D2D2D',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  
  optionsSlider: {
    width: '100%',
    height: 40,
    marginBottom: 8,
  },
  
  sliderRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  
  rangeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },

  // Profile Action Buttons
  profileActionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    marginBottom: 16,
    gap: 16,
    paddingHorizontal: 8,
  },
  editProfileButton: {
    backgroundColor: '#8B7355',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    flex: 1,
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  editProfileButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  logoutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8B7355',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    flex: 1,
  },
  logoutButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#8B7355',
    letterSpacing: 0.2,
  },
  // Dinner Request Response Styles
  dinnerRequestResponseSection: {
    backgroundColor: '#F8F6F3',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E6E3',
  },
  dinnerRequestTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
    color: '#2D2D2D',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  dinnerRequestInfo: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    marginBottom: 16,
    letterSpacing: 0.1,
  },
  responseButtonContainer: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  responseButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#2D2D2D',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptButton: {
    backgroundColor: '#8B7355',
  },
  declineButton: {
    backgroundColor: '#6B6B6B',
  },
  acceptButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  declineButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  alreadyRespondedContainer: {
    backgroundColor: '#E8E6E3',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  alreadyRespondedText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  dinnerRequestFullSection: {
    flexDirection: 'column',
    marginBottom: 16,
    backgroundColor: 'rgba(139, 115, 85, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  requestDetailsSection: {
    flex: 1,
  },
  requestDetailsTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: '#2D2D2D',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  requestDetailsMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  timerSection: {
    alignItems: 'center',
    marginVertical: 12,
  },
    timerText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Terminated Session Results Styles
  terminatedResultsSection: {
    marginTop: 24,
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  terminatedResultsTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    lineHeight: 28,
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  terminatedResultsSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.1,
  },
  resultMealItem: {
    flexDirection: 'row',
    backgroundColor: '#FEFEFE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#2D2D2D',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.1)',
  },
  resultMealRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B7355',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  resultMealRankText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
    color: '#FEFEFE',
    fontWeight: '600',
  },
  resultMealContent: {
    flex: 1,
  },
  resultMealName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: '#2D2D2D',
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  resultMealVotes: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 18,
    color: '#8B7355',
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  resultMealDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  clearResultsButton: {
    backgroundColor: 'rgba(107, 107, 107, 0.1)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(107, 107, 107, 0.2)',
  },
  clearResultsButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },

  // Member Responses Section Styles
  memberResponsesSection: {
    marginBottom: 20,
    backgroundColor: 'rgba(139, 115, 85, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 115, 85, 0.2)',
  },
  memberResponsesTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: '#2D2D2D',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  memberResponsesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberResponseItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  memberResponseEating: {
    backgroundColor: 'rgba(139, 115, 85, 0.1)',
    borderColor: '#8B7355',
  },
  memberResponseNotEating: {
    backgroundColor: 'rgba(107, 107, 107, 0.1)',
    borderColor: '#6B6B6B',
  },
  memberResponseName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  memberResponseEatingText: {
    color: '#8B7355',
  },
  memberResponseNotEatingText: {
    color: '#6B6B6B',
  },
  memberResponseStatus: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
    textAlign: 'center',
    marginTop: 2,
  },
  
  // Top Meals Section Styles
  topMealsSection: {
    marginBottom: 20,
  },
  topMealsTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: '#2D2D2D',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // Request Meal Section Styles
  requestMealSection: {
    marginTop: 24,
    marginBottom: 20,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(139, 115, 85, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 115, 85, 0.2)',
  },
  requestMealButtonNew: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  requestMealButtonTextNew: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
 
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  starIcon: {
    fontSize: 24,
    color: '#D1D1D1',
  },
  starIconActive: {
    color: '#FFD700',
  },
}); 