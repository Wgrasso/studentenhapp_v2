import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, Animated, Alert } from 'react-native';
import { useDinnerRequests } from '../../lib/hooks';
import { recordUserResponse } from '../../lib/dinnerRequestService';

export default function DinnerRequestNotification({ visible, onClose, userName }) {
  const { requests, addLocalResponse } = useDinnerRequests();
  const [currentRequestIndex, setCurrentRequestIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [timerAnimation] = useState(new Animated.Value(1));
  const [notificationAnimation] = useState(new Animated.Value(0));

  // Show/hide animation
  useEffect(() => {
    if (visible) {
      Animated.spring(notificationAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(notificationAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [visible]);

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
    
    if (visible && requests.length > 0 && currentRequestIndex < requests.length) {
      const currentRequest = requests[currentRequestIndex];
      
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
  }, [visible, requests, currentRequestIndex]);

  const handleRequestResponse = async (accepted) => {
    if (requests.length === 0 || currentRequestIndex >= requests.length) {
      console.error('❌ No current request to respond to');
      return;
    }

    const currentRequest = requests[currentRequestIndex];
    const response = accepted ? 'accepted' : 'declined';
    console.log(`📝 User ${response} the dinner request:`, currentRequest.id);

    // IMMEDIATE UI UPDATE: Store response locally and close notification
    addLocalResponse(currentRequest.id, response);
    
    // Navigate to next request or close
    if (requests.length > 1) {
      const nextIndex = currentRequestIndex < requests.length - 1 ? currentRequestIndex + 1 : 0;
      setCurrentRequestIndex(nextIndex);
    } else {
      onClose();
    }

    try {
      const result = await recordUserResponse(currentRequest.id, response);
      
      if (result.success) {
        console.log('✅ Request response saved successfully');
        
        let alertMessage = result.message;
        
        // Show response status
        if (result.readiness) {
          alertMessage += `\n\nResponses: ${result.readiness.responses_count}/${result.readiness.total_members} members (${result.readiness.accepted_count} accepted)`;
          if (result.readiness.is_ready) {
            alertMessage += `\n\nGreat! Everyone has responded. You can now vote on meals!`;
          }
        }
        
        Alert.alert('Response Sent', alertMessage);
        
      } else {
        console.error('❌ Failed to save response:', result.error);
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred while saving your response.');
    }
  };

  const getCurrentRequestData = () => {
    if (requests.length > 0 && currentRequestIndex < requests.length) {
      const currentRequest = requests[currentRequestIndex];
      
      const requestDate = new Date(currentRequest.date);
      const formattedDate = requestDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      return {
        requesterName: currentRequest.requesterName,
        date: formattedDate,
        groupName: currentRequest.groupName,
        requestId: currentRequest.id
      };
    }

    return null;
  };

  const currentRequestData = getCurrentRequestData();

  if (!visible || !currentRequestData) {
    return null;
  }

  return (
    <Modal visible={visible} transparent={true} animationType="none">
      <View style={styles.notificationOverlay}>
        <Animated.View 
          style={[
            styles.notificationContainer,
            {
              transform: [{ scale: notificationAnimation }],
              opacity: notificationAnimation,
            },
          ]}
        >
          {/* Close Button */}
          <TouchableOpacity 
            style={styles.notificationCloseButton}
            onPress={onClose}
          >
            <Text style={styles.notificationCloseText}>X</Text>
          </TouchableOpacity>

          {/* Request Counter */}
          {requests.length > 1 && (
            <View style={styles.requestCounter}>
              <Text style={styles.requestCounterText}>
                {currentRequestIndex + 1} of {requests.length}
              </Text>
            </View>
          )}

          {/* Navigation Arrows */}
          {requests.length > 1 && (
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
                onPress={() => setCurrentRequestIndex(Math.min(requests.length - 1, currentRequestIndex + 1))}
                disabled={currentRequestIndex === requests.length - 1}
              >
                <Text style={[styles.navArrowText, currentRequestIndex === requests.length - 1 && styles.disabledArrow]}>&gt;</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Request Content */}
          <View style={styles.notificationContent}>
            <Text style={styles.notificationTitle}>Dinner Request</Text>
            
            <Text style={styles.notificationMessage}>
              Hi {userName}! Here is a request for {currentRequestData.date} to eat with {currentRequestData.groupName}
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
  );
}

const styles = StyleSheet.create({
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