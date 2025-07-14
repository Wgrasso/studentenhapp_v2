import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, Image, Modal, Animated, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { getUserGroups } from '../lib/groupsService';
import { saveDinnerRequest, getAllDinnerRequests, recordUserResponse, createMealFromRequest } from '../lib/dinnerRequestService';

// Safe image component that handles missing drawings gracefully
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

export default function MainProfileScreen({ route, navigation, hideBottomNav }) {
  const { isGuest } = route.params || { isGuest: true };
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: ''
  });

  // Request state
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState({ hour: null, minutes: null });
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [userGroups, setUserGroups] = useState([]);
  const [currentRequests, setCurrentRequests] = useState([]);
  const [currentRequestIndex, setCurrentRequestIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [timerAnimation] = useState(new Animated.Value(1));
  
  // Local state for immediate cross-screen sync
  const [localResponseMap, setLocalResponseMap] = useState(new Map()); // requestId -> response
  const [currentUserId, setCurrentUserId] = useState(null);

  // Modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRequestNotification, setShowRequestNotification] = useState(false);
  const [modalAnimation] = useState(new Animated.Value(0));
  const [notificationAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    if (!isGuest) {
      loadUserProfile();
      loadUserGroups();
      loadCurrentUserId();
    } else {
      setLoading(false);
    }
  }, [isGuest]);

  // Listen for immediate response updates from GroupsScreen
  useEffect(() => {
    if (route.params?.immediateResponseFromGroup) {
      const { requestId, response, userId, timestamp } = route.params.immediateResponseFromGroup;
      
      console.log('📱 [CROSS-SCREEN] Received immediate response from GroupsScreen:', {
        requestId,
        response,
        userId,
        timestamp
      });

      // Store the response locally
      setLocalResponseMap(prev => new Map(prev).set(requestId, response));
      
      // Remove the notification for this request immediately
      const updatedRequests = currentRequests.filter(req => req.id !== requestId);
      setCurrentRequests(updatedRequests);
      
      // Adjust current index if needed
      if (updatedRequests.length === 0) {
        closeNotification();
      } else if (currentRequestIndex >= updatedRequests.length) {
        setCurrentRequestIndex(Math.max(0, updatedRequests.length - 1));
      }

      // Clear the parameter to prevent re-processing
      navigation.setParams({ immediateResponseFromGroup: null });
    }
  }, [route.params?.immediateResponseFromGroup, currentRequests, currentRequestIndex, navigation]);

  // Listen for group creation/update events to refresh group list
  useEffect(() => {
    if (route.params?.refreshMainProfileGroups && !isGuest) {
      console.log('🔄 [CROSS-SCREEN] Refreshing MainProfile groups due to group creation/update');
      loadUserGroups();
      // Clear the parameter to prevent repeated refreshes
      navigation.setParams({ refreshMainProfileGroups: undefined });
    }
  }, [route.params?.refreshMainProfileGroups, isGuest, navigation]);

  // Listen for preSelectedGroup parameter to auto-fill group selection
  useEffect(() => {
    if (route.params?.preSelectedGroup && !isGuest) {
      console.log('📍 [CROSS-SCREEN] Auto-selecting group from GroupsScreen:', route.params.preSelectedGroup.group_name);
      setSelectedGroup(route.params.preSelectedGroup);
      // Clear the parameter to prevent repeated selections
      navigation.setParams({ preSelectedGroup: undefined });
    }
  }, [route.params?.preSelectedGroup, isGuest, navigation]);

  const loadCurrentUserId = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (user && !error) {
        setCurrentUserId(user.id);
        console.log('👤 [MainProfile] Current user ID set:', user.id);
      }
    } catch (error) {
      console.error('❌ [MainProfile] Error getting current user:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      // Get basic user info
      const name = user.user_metadata?.full_name || 'Unknown User';
      const email = user.email || '';

      setUserInfo({
        name,
        email
      });
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('👤 No user found, setting empty groups');
        setUserGroups([]);
        return;
      }

      console.log('📥 Loading groups for user:', user.id);
      const result = await getUserGroups(); // Note: getUserGroups doesn't need user.id parameter
      console.log('📝 Loaded groups result:', result);
      
      // getUserGroups returns { success: boolean, groups: array } or { success: false, error: string }
      if (result.success && Array.isArray(result.groups)) {
        console.log('✅ Setting groups:', result.groups.length, 'groups found');
        setUserGroups(result.groups);
      } else {
        console.log('⚠️ No groups found or error:', result.error || 'Unknown error');
        setUserGroups([]);
      }
    } catch (error) {
      console.error('❌ Error loading user groups:', error);
      setUserGroups([]); // Ensure we always have an array
    }
  };

  // Generate next 7 days for date selection
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: date,
        label: i === 0 ? 'Today' : date.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        }),
        fullLabel: date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      });
    }
    return dates;
  };

  // Generate time options (hours and 15-minute intervals)
  const getTimeOptions = () => {
    const hours = [];
    const minutes = [0, 15, 30, 45];
    
    for (let h = 6; h <= 23; h++) {
      hours.push(h);
    }
    
    return { hours, minutes };
  };

  const openModal = (modalType) => {
    switch (modalType) {
      case 'group':
        setShowGroupModal(true);
        break;
      case 'date':
        setShowDateModal(true);
        break;
      case 'time':
        setShowTimeModal(true);
        break;
      case 'confirm':
        setShowConfirmModal(true);
        break;
      case 'notification':
        setShowRequestNotification(true);
        Animated.spring(notificationAnimation, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
        return;
    }
    
    Animated.spring(modalAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const closeModal = () => {
    Animated.spring(modalAnimation, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      setShowGroupModal(false);
      setShowDateModal(false);
      setShowTimeModal(false);
      setShowConfirmModal(false);
    });
  };

  const closeNotification = () => {
    Animated.spring(notificationAnimation, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      setShowRequestNotification(false);
    });
  };

  const handleRequestResponse = async (accepted) => {
    if (currentRequests.length === 0 || currentRequestIndex >= currentRequests.length) {
      console.error('❌ No current request to respond to');
      return;
    }

    const currentRequest = currentRequests[currentRequestIndex];
    const response = accepted ? 'accepted' : 'declined';
    console.log(`📝 User ${response} the dinner request:`, currentRequest.id);

    // IMMEDIATE UI UPDATE: Store response locally and remove from notification
    setLocalResponseMap(prev => new Map(prev).set(currentRequest.id, response));
    
    // Remove the responded request from the list immediately
    const updatedRequests = currentRequests.filter((_, index) => index !== currentRequestIndex);
    setCurrentRequests(updatedRequests);
    
    // Adjust index if needed
    if (updatedRequests.length === 0) {
      closeNotification();
    } else if (currentRequestIndex >= updatedRequests.length) {
      setCurrentRequestIndex(updatedRequests.length - 1);
    }

    // IMMEDIATE CROSS-SCREEN SYNC: Update GroupsScreen immediately
    if (navigation.getParent()) {
      navigation.getParent().setParams({ 
        refreshGroups: Date.now(),
        immediateResponse: {
          requestId: currentRequest.id,
          response: response,
          userId: currentUserId,
          timestamp: Date.now(),
          showVotingButtons: response === 'accepted' // Signal to show voting buttons immediately
        }
      });
    }

    try {
      const result = await recordUserResponse(currentRequest.id, response);
      
      if (result.success) {
        console.log('✅ Request response saved successfully');
        
        let alertMessage = result.message;
        
        // Show response status (meal session was created when request was sent)
        if (result.readiness) {
          alertMessage += `\n\nResponses: ${result.readiness.responses_count}/${result.readiness.total_members} members (${result.readiness.accepted_count} accepted)`;
          if (result.readiness.is_ready) {
            alertMessage += `\n\nGreat! Everyone has responded. You can now vote on meals!`;
          }
        }
        
        Alert.alert('Response Sent', alertMessage);
        
      } else {
        console.error('❌ Failed to save response:', result.error);
        // If API failed, revert the local state
        setLocalResponseMap(prev => {
          const newMap = new Map(prev);
          newMap.delete(currentRequest.id);
          return newMap;
        });
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      // If API failed, revert the local state
      setLocalResponseMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(currentRequest.id);
        return newMap;
      });
      Alert.alert('Error', 'An unexpected error occurred while saving your response.');
    }
  };

  // Load real dinner request data from database
  const loadDinnerRequests = async () => {
    console.log('📥 Loading dinner requests from database...');
    
    try {
      const result = await getAllDinnerRequests();
      
      if (result.success && result.requests.length > 0) {
        console.log('✅ Loaded dinner requests:', result.requests);
        setCurrentRequests(result.requests);
        setCurrentRequestIndex(0); // Start with first request
        return result.requests; // Return the loaded requests
      } else {
        console.log('📭 No dinner requests found:', result.message);
        setCurrentRequests([]);
        setCurrentRequestIndex(0);
        return []; // Return empty array
      }
    } catch (error) {
      console.error('❌ Error loading dinner requests:', error);
      setCurrentRequests([]);
      setCurrentRequestIndex(0);
      return []; // Return empty array on error
    }
  };

  // Get current request data for display
  const getCurrentRequestData = () => {
    if (currentRequests.length > 0 && currentRequestIndex < currentRequests.length) {
      const currentRequest = currentRequests[currentRequestIndex];
      
      // Use real data from database
      const requestDate = new Date(currentRequest.date);
      const formattedDate = requestDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      // Format time from 24-hour to 12-hour
      const [hours, minutes] = currentRequest.time.split(':');
      const timeObj = { hour: parseInt(hours), minutes: parseInt(minutes) };
      const requestTime = formatTime(timeObj.hour, timeObj.minutes);

      // Format deadline time (now it's a timestamp)
      const deadlineDate = new Date(currentRequest.deadline);
      const deadline = formatTime(deadlineDate.getHours(), deadlineDate.getMinutes());

      return {
        requesterName: currentRequest.requesterName,
        date: formattedDate,
        time: requestTime,
        groupName: currentRequest.groupName,
        deadline: deadline,
        recipe: currentRequest.recipeType,
        requestId: currentRequest.id
      };
    }

    // Fallback to form selections or mock data
    if (selectedGroup && selectedDate && selectedTime.hour !== null) {
      const requestTime = formatTime(selectedTime.hour, selectedTime.minutes);
      // Calculate deadline (30 minutes before the meal time)
      const deadlineHour = selectedTime.hour;
      const deadlineMinutes = selectedTime.minutes - 30;
      let adjustedHour = deadlineHour;
      let adjustedMinutes = deadlineMinutes;
      
      if (adjustedMinutes < 0) {
        adjustedMinutes += 60;
        adjustedHour -= 1;
      }
      
      const deadline = formatTime(adjustedHour, adjustedMinutes);

      return {
        requesterName: userInfo.name || "Unknown User",
        date: selectedDate.fullLabel,
        time: requestTime,
        groupName: selectedGroup.group_name || selectedGroup.name,
        deadline: deadline,
        recipe: selectedRecipe || 'random'
      };
    }

    // Final fallback mock data
    return {
      requesterName: userInfo.name || "Test User",
      date: "Friday, December 15, 2023",
      time: "7:00 PM",
      groupName: "Study Group Alpha",
      deadline: "6:30 PM"
    };
  };

  const formatTime = (hour, minutes) => {
    if (hour === null || minutes === null) return '';
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Calculate time remaining until deadline
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

  // Update timer every second when notification is open
  useEffect(() => {
    let interval;
    
    if (showRequestNotification && currentRequests.length > 0 && currentRequestIndex < currentRequests.length) {
      const currentRequest = currentRequests[currentRequestIndex];
      
      const updateTimer = () => {
        const remaining = calculateTimeRemaining(currentRequest.deadline);
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
  }, [showRequestNotification, currentRequests, currentRequestIndex]);

  const canSendRequest = () => {
    return selectedGroup && selectedDate && selectedTime.hour !== null && selectedTime.minutes !== null;
  };

  const handleSendRequest = () => {
    if (!canSendRequest()) return;
    // Set default recipe option to "Random" when opening confirmation
    if (!selectedRecipe) {
      setSelectedRecipe('random');
    }
    openModal('confirm');
  };

  const confirmSendRequest = async () => {
    if (!selectedGroup || !selectedDate || selectedTime.hour === null || !selectedRecipe) {
      Alert.alert('Error', 'Please complete all selections before sending the request.');
      return;
    }

    console.log('📤 Sending dinner request...');

    // Format date for database (YYYY-MM-DD)
    const formattedDate = selectedDate.date.toISOString().split('T')[0];
    
    // Format time for database (HH:MM:SS)
    const formattedTime = `${selectedTime.hour.toString().padStart(2, '0')}:${selectedTime.minutes.toString().padStart(2, '0')}:00`;
    
    // Calculate deadline time (30 minutes before meal time)
    const deadlineHour = selectedTime.hour;
    const deadlineMinutes = selectedTime.minutes - 30;
    let adjustedHour = deadlineHour;
    let adjustedMinutes = deadlineMinutes;
    
    if (adjustedMinutes < 0) {
      adjustedMinutes += 60;
      adjustedHour -= 1;
    }
    
    const formattedDeadline = `${adjustedHour.toString().padStart(2, '0')}:${adjustedMinutes.toString().padStart(2, '0')}:00`;

    const requestData = {
      groupId: selectedGroup.group_id,
      date: formattedDate,
      time: formattedTime,
      recipeType: selectedRecipe,
      deadlineTime: formattedDeadline
    };

    console.log('📝 Request data to send:', requestData);

    try {
      const result = await saveDinnerRequest(requestData);
      
      if (result.success) {
        console.log('✅ Dinner request sent successfully');
        console.log('🍽️ Meal session created:', result.mealSessionCreated);
        
        let successMessage = result.message;
        if (result.mealSessionCreated) {
          successMessage += '\n\nGroup members can now respond and start voting immediately!';
        }
        
        Alert.alert('Success', successMessage);
        closeModal();
        
        // Trigger refresh of groups data when navigating back
        if (navigation.getParent()) {
          navigation.getParent().setParams({ 
            refreshGroups: Date.now(),
            clearTerminatedResults: selectedGroup.group_id // Clear previous results for this group
          });
        }
        
        // Reset selections
        setSelectedGroup(null);
        setSelectedDate(null);
        setSelectedTime({ hour: null, minutes: null });
        setSelectedRecipe(null);
      } else {
        console.error('❌ Failed to send dinner request:', result.error);
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred while sending the request.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isGuest) {
    return (
      <SafeAreaView style={styles.container}>
        <SafeDrawing 
          source={require('../assets/drawing1.png')}
          style={styles.subtleBackground}
        />
        
        <View style={styles.guestContainer}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            style={styles.blurredBackground}
          >
            <View style={styles.nameSection}>
              <View style={styles.nameContainer}>
                <View style={styles.nameContent}>
                  <Text style={styles.nameText}>John Smith</Text>
                </View>
                <Image 
                  source={require('../assets/studentenhapp-logo.png')}
                  style={styles.profileLogo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.signInOverlay}>
            <View style={styles.signInCard}>
              <Text style={styles.signInTitle}>Sign In to Request Meals</Text>
              <Text style={styles.signInSubtitle}>
                Join your student groups and start requesting meals together
              </Text>
              <TouchableOpacity 
                style={styles.signInButton}
                onPress={() => navigation.navigate('SignIn')}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const availableDates = getAvailableDates();
  const { hours, minutes } = getTimeOptions();

  return (
    <SafeAreaView style={styles.container}>
      <SafeDrawing 
        source={require('../assets/drawing1.png')}
        style={styles.subtleBackground}
      />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Name with Logo */}
        <View style={styles.nameSection}>
          <View style={styles.nameContainer}>
            <View style={styles.nameContent}>
              <Text style={styles.nameText}>{userInfo.name}</Text>
            </View>
            <Image 
              source={require('../assets/studentenhapp-logo.png')}
              style={styles.profileLogo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Request Title */}
        <View style={styles.requestSection}>
          <Text style={styles.requestTitle}>Request a Dinner</Text>
          <Text style={styles.requestSubtitle}>Choose your group, date, and time</Text>
        </View>

        {/* Selection Buttons */}
        <View style={styles.selectionContainer}>
          {/* Group Selection */}
          <TouchableOpacity 
            style={[styles.selectionButton, selectedGroup && styles.selectionButtonSelected]}
            onPress={() => openModal('group')}
          >
            <Text style={styles.selectionLabel}>Group</Text>
            <Text style={[styles.selectionValue, !selectedGroup && styles.selectionValueEmpty]}>
              {selectedGroup ? (selectedGroup.group_name || selectedGroup.name) : 'Select a group'}
            </Text>
          </TouchableOpacity>

          {/* Date Selection */}
          <TouchableOpacity 
            style={[styles.selectionButton, selectedDate && styles.selectionButtonSelected]}
            onPress={() => openModal('date')}
          >
            <Text style={styles.selectionLabel}>Date</Text>
            <Text style={[styles.selectionValue, !selectedDate && styles.selectionValueEmpty]}>
              {selectedDate ? selectedDate.label : 'Select a date'}
            </Text>
          </TouchableOpacity>

          {/* Time Selection */}
          <TouchableOpacity 
            style={[styles.selectionButton, selectedTime.hour !== null && styles.selectionButtonSelected]}
            onPress={() => openModal('time')}
          >
            <Text style={styles.selectionLabel}>Time</Text>
            <Text style={[styles.selectionValue, selectedTime.hour === null && styles.selectionValueEmpty]}>
              {selectedTime.hour !== null ? formatTime(selectedTime.hour, selectedTime.minutes) : 'Select a time'}
            </Text>
          </TouchableOpacity>
                </View>

        {/* Send Request Button */}
        <TouchableOpacity 
          style={[styles.sendButton, canSendRequest() && styles.sendButtonEnabled]}
          onPress={handleSendRequest}
          disabled={!canSendRequest()}
        >
          <Text style={[styles.sendButtonText, canSendRequest() && styles.sendButtonTextEnabled]}>
            Send Request
          </Text>
        </TouchableOpacity>

        {/* Test Button for Request Notification */}
        <TouchableOpacity 
          style={styles.testButton}
          onPress={async () => {
            const loadedRequests = await loadDinnerRequests();
            if (loadedRequests.length > 0) {
              openModal('notification');
            } else {
              Alert.alert('No Requests', 'No pending dinner requests found in your groups.');
            }
          }}
        >
          <Text style={styles.testButtonText}>
            Test Request Notification
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Group Selection Modal */}
      <Modal visible={showGroupModal} transparent={true} animationType="none">
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [
                  {
                    scale: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: modalAnimation,
              },
            ]}
          >
            <Text style={styles.modalTitle}>Select Group</Text>
            <ScrollView style={styles.modalScrollView}>
              {(userGroups || []).length > 0 ? (
                                  userGroups.map((group) => (
                    <TouchableOpacity
                      key={group.group_id || group.id}
                      style={[
                        styles.modalOption,
                        selectedGroup?.group_id === group.group_id && styles.modalOptionSelected
                      ]}
                      onPress={() => {
                        setSelectedGroup(group);
                        closeModal();
                      }}
                    >
                      <Text style={styles.modalOptionText}>{group.group_name || group.name}</Text>
                      <Text style={styles.modalOptionSubtext}>{group.member_count} members</Text>
                    </TouchableOpacity>
                  ))
              ) : (
                <View style={styles.modalOption}>
                  <Text style={styles.modalOptionText}>No groups found</Text>
                  <Text style={styles.modalOptionSubtext}>Join or create a group first</Text>
            </View>
          )}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Date Selection Modal */}
      <Modal visible={showDateModal} transparent={true} animationType="none">
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [
                  {
                    scale: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: modalAnimation,
              },
            ]}
          >
            <Text style={styles.modalTitle}>Select Date</Text>
            <ScrollView style={styles.modalScrollView}>
              {availableDates.map((dateOption, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.modalOption,
                    selectedDate?.date.toDateString() === dateOption.date.toDateString() && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedDate(dateOption);
                    closeModal();
                  }}
                >
                  <Text style={styles.modalOptionText}>{dateOption.label}</Text>
                  <Text style={styles.modalOptionSubtext}>{dateOption.fullLabel}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Time Selection Modal */}
      <Modal visible={showTimeModal} transparent={true} animationType="none">
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [
                  {
                    scale: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: modalAnimation,
              },
            ]}
          >
            <Text style={styles.modalTitle}>Select Time</Text>
            
            <View style={styles.timePickerContainer}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnTitle}>Hour</Text>
                <ScrollView style={styles.timeScrollView}>
                  {hours.map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.timeOption,
                        selectedTime.hour === hour && styles.timeOptionSelected
                      ]}
                      onPress={() => setSelectedTime(prev => ({ ...prev, hour }))}
                    >
                      <Text style={styles.timeOptionText}>
                        {hour > 12 ? hour - 12 : hour === 0 ? 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                    </View>

              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnTitle}>Minutes</Text>
                <ScrollView style={styles.timeScrollView}>
                  {minutes.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.timeOption,
                        selectedTime.minutes === minute && styles.timeOptionSelected
                      ]}
                      onPress={() => setSelectedTime(prev => ({ ...prev, minutes: minute }))}
                    >
                      <Text style={styles.timeOptionText}>:{minute.toString().padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                </View>
              </View>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={[
                  styles.modalConfirmButton,
                  selectedTime.hour !== null && selectedTime.minutes !== null && styles.modalConfirmButtonEnabled
                ]}
                onPress={() => {
                  if (selectedTime.hour !== null && selectedTime.minutes !== null) {
                    closeModal();
                  }
                }}
                disabled={selectedTime.hour === null || selectedTime.minutes === null}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent={true} animationType="none">
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [
                  {
                    scale: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: modalAnimation,
              },
            ]}
          >
            <Text style={styles.modalTitle}>Confirm Request</Text>
            
            <View style={styles.confirmationDetails}>
              <View style={styles.confirmationRow}>
                <Text style={styles.confirmationLabel}>Group:</Text>
                <Text style={styles.confirmationValue}>{selectedGroup?.group_name || selectedGroup?.name}</Text>
              </View>
              <View style={styles.confirmationRow}>
                <Text style={styles.confirmationLabel}>Date:</Text>
                <Text style={styles.confirmationValue}>{selectedDate?.fullLabel}</Text>
              </View>
              <View style={styles.confirmationRow}>
                <Text style={styles.confirmationLabel}>Time:</Text>
                <Text style={styles.confirmationValue}>
                  {formatTime(selectedTime.hour, selectedTime.minutes)}
            </Text>
              </View>
              <View style={styles.confirmationRowWithSelector}>
                <Text style={styles.confirmationLabel}>Recipe:</Text>
                <View style={styles.recipeSelector}>
              <TouchableOpacity 
                    style={[
                      styles.recipeSelectorOption,
                      selectedRecipe === 'random' && styles.recipeSelectorOptionSelected
                    ]}
                    onPress={() => setSelectedRecipe('random')}
                  >
                    <Text style={[
                      styles.recipeSelectorText,
                      selectedRecipe === 'random' && styles.recipeSelectorTextSelected
                    ]}>Random</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                    style={[
                      styles.recipeSelectorOption,
                      selectedRecipe === 'wishlist' && styles.recipeSelectorOptionSelected
                    ]}
                    onPress={() => setSelectedRecipe('wishlist')}
                  >
                    <Text style={[
                      styles.recipeSelectorText,
                      selectedRecipe === 'wishlist' && styles.recipeSelectorTextSelected
                    ]}>Wishlist</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.recipeSelectorOption,
                      selectedRecipe === 'swipe' && styles.recipeSelectorOptionSelected
                    ]}
                    onPress={() => setSelectedRecipe('swipe')}
                  >
                    <Text style={[
                      styles.recipeSelectorText,
                      selectedRecipe === 'swipe' && styles.recipeSelectorTextSelected
                    ]}>Swipe</Text>
              </TouchableOpacity>
            </View>
          </View>
            </View>

            <View style={styles.modalButtonContainer}>
            <TouchableOpacity 
                style={[styles.modalConfirmButton, styles.modalConfirmButtonEnabled]}
                onPress={confirmSendRequest}
            >
                <Text style={styles.modalConfirmText}>Send Request</Text>
            </TouchableOpacity>
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Dinner Request Notification Modal */}
      <Modal visible={showRequestNotification} transparent={true} animationType="none">
        <View style={styles.notificationOverlay}>
          <Animated.View 
            style={[
              styles.notificationContainer,
              {
                transform: [
                  {
                    scale: notificationAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: notificationAnimation,
              },
            ]}
          >
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.notificationCloseButton}
              onPress={closeNotification}
            >
              <Text style={styles.notificationCloseText}>X</Text>
            </TouchableOpacity>

            {/* Request Counter */}
            {currentRequests.length > 1 && (
              <View style={styles.requestCounter}>
                <Text style={styles.requestCounterText}>
                  {currentRequestIndex + 1} of {currentRequests.length}
                </Text>
          </View>
        )}

            {/* Navigation Arrows */}
            {currentRequests.length > 1 && (
              <>
                <TouchableOpacity 
                  style={[styles.navArrow, styles.leftArrow]}
                  onPress={() => setCurrentRequestIndex(Math.max(0, currentRequestIndex - 1))}
                  disabled={currentRequestIndex === 0}
                >
                  <Text style={[styles.navArrowText, currentRequestIndex === 0 && styles.disabledArrow]}>&lt;</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.navArrow, styles.rightArrow]}
                  onPress={() => setCurrentRequestIndex(Math.min(currentRequests.length - 1, currentRequestIndex + 1))}
                  disabled={currentRequestIndex === currentRequests.length - 1}
                >
                  <Text style={[styles.navArrowText, currentRequestIndex === currentRequests.length - 1 && styles.disabledArrow]}>&gt;</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Request Content */}
                         <View style={styles.notificationContent}>
               <Text style={styles.notificationTitle}>Dinner Request</Text>
               
               <Text style={styles.notificationMessage}>
                 Hi {userInfo.name}! Here is a request for {getCurrentRequestData().date} to eat with {getCurrentRequestData().groupName}
               </Text>

              {/* Response Buttons */}
              <View style={styles.responseButtonContainer}>
                <TouchableOpacity 
                  style={[styles.responseButton, styles.acceptButton]}
                  onPress={() => handleRequestResponse(true)}
                >
                  <Text style={styles.acceptButtonText}>Yes</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.responseButton, styles.declineButton]}
                  onPress={() => handleRequestResponse(false)}
                >
                  <Text style={styles.declineButtonText}>No</Text>
                </TouchableOpacity>
              </View>

                             {/* Deadline Timer */}
               <Animated.View style={{ transform: [{ scale: timerAnimation }] }}>
                 <Text style={[styles.deadlineText, { color: getTimerColor(timeRemaining) }]}>
                   {timeRemaining}
                 </Text>
               </Animated.View>
            </View>
          </Animated.View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#6B6B6B',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  nameSection: {
    marginBottom: 32,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F6F3',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#2D2D2D',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  nameContent: {
    flex: 1,
  },
  nameText: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    lineHeight: 36,
    color: '#2D2D2D',
    letterSpacing: 0.5,
  },
  profileLogo: {
    width: 60,
    height: 60,
    marginLeft: 16,
  },
  requestSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  requestTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    lineHeight: 40,
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  requestSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#6B6B6B',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  selectionContainer: {
    marginBottom: 32,
  },
  selectionButton: {
    backgroundColor: '#F8F6F3',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectionButtonSelected: {
    borderColor: '#8B7355',
    backgroundColor: 'rgba(139, 115, 85, 0.1)',
  },
  selectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#2D2D2D',
    marginBottom: 4,
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  selectionValue: {
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    lineHeight: 24,
    color: '#2D2D2D',
    letterSpacing: 0.1,
  },
  selectionValueEmpty: {
    color: '#A0A0A0',
    fontStyle: 'italic',
  },
  sendButton: {
    backgroundColor: '#D0D0D0',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 16,
  },
  sendButtonEnabled: {
    backgroundColor: '#8B7355',
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  sendButtonTextEnabled: {
    color: '#FEFEFE',
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
  signInButton: {
    backgroundColor: '#8B7355',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    shadowColor: '#8B7355',
    shadowOffset: {
      width: 0,
      height: 3,
    },
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
  subtleBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: '#FEFEFE',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#2D2D2D',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    lineHeight: 30,
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  modalScrollView: {
    maxHeight: 300,
  },
  modalOption: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8F6F3',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modalOptionSelected: {
    borderColor: '#8B7355',
    backgroundColor: 'rgba(139, 115, 85, 0.1)',
  },
  modalOptionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#2D2D2D',
    letterSpacing: 0.1,
  },
  modalOptionSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    letterSpacing: 0.1,
    marginTop: 2,
  },
  modalCloseButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8B7355',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#8B7355',
    letterSpacing: 0.2,
  },
  // Time picker styles
  timePickerContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  timeColumn: {
    flex: 1,
  },
  timeColumnTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  timeScrollView: {
    maxHeight: 200,
    backgroundColor: '#F8F6F3',
    borderRadius: 8,
  },
  timeOption: {
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E6E3',
  },
  timeOptionSelected: {
    backgroundColor: 'rgba(139, 115, 85, 0.1)',
  },
  timeOptionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#2D2D2D',
    letterSpacing: 0.1,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalConfirmButton: {
    backgroundColor: '#D0D0D0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    flex: 1,
  },
  modalConfirmButtonEnabled: {
    backgroundColor: '#8B7355',
  },
  modalConfirmText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  // Confirmation modal styles
  confirmationDetails: {
    marginBottom: 24,
  },
  confirmationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E6E3',
  },
  confirmationLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  confirmationValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#2D2D2D',
    letterSpacing: 0.1,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  confirmationRowWithSelector: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E6E3',
  },
  recipeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  recipeSelectorOption: {
    flex: 1,
    backgroundColor: '#F8F6F3',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  recipeSelectorOptionSelected: {
    backgroundColor: 'rgba(139, 115, 85, 0.1)',
    borderColor: '#8B7355',
  },
  recipeSelectorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  recipeSelectorTextSelected: {
    color: '#8B7355',
    fontWeight: '600',
  },

  // Test button styles
  testButton: {
    backgroundColor: '#6B6B6B',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
  testButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#FEFEFE',
    letterSpacing: 0.1,
  },

  // Notification modal styles
  notificationOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  notificationContainer: {
    backgroundColor: '#FEFEFE',
    borderRadius: 20,
    padding: 0,
    width: '90%',
    maxWidth: 400,
    position: 'relative',
    shadowColor: '#2D2D2D',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  notificationCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  notificationCloseText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  notificationContent: {
    padding: 32,
    paddingTop: 48,
    alignItems: 'center',
  },
  notificationTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    lineHeight: 36,
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  notificationMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    lineHeight: 26,
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 0.1,
  },
  responseButtonContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    width: '100%',
  },
  responseButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 20,
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
    fontSize: 18,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  declineButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  deadlineText: {
    fontFamily: 'Courier New',
    fontSize: 16,
    lineHeight: 22,
    color: '#6B6B6B',
    textAlign: 'center',
    letterSpacing: 0,
  },
  requestCounter: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 1,
  },
  requestCounterText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#6B6B6B',
    lineHeight: 16,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  leftArrow: {
    left: 16,
  },
  rightArrow: {
    right: 16,
  },
  navArrowText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: '#2D2D2D',
    lineHeight: 28,
  },
  disabledArrow: {
    color: '#CCCCCC',
  },
}); 