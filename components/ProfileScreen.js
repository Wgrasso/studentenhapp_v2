import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Alert, Image, Modal, Animated } from 'react-native';
import { supabase } from '../lib/supabase';
import { createOrUpdateProfile, getCurrentUserProfile } from '../lib/profileService';

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

export default function ProfileScreen({ route, navigation }) {
  const { isGuest } = route.params || { isGuest: true };
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Custom Alert Modal states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertAnimation] = useState(new Animated.Value(0));
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtonText, setAlertButtonText] = useState('OK');
  const [alertOnPress, setAlertOnPress] = useState(() => () => {});

  const handleBackPress = () => {
    navigation.navigate('MainTabs', { 
      screen: 'profile',
      params: { isGuest: isGuest }
    });
  };

  const showCustomAlert = (title, message, buttonText = 'OK', onPress = () => {}) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertButtonText(buttonText);
    setAlertOnPress(() => onPress);
    setAlertVisible(true);
    
    Animated.spring(alertAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const closeCustomAlert = () => {
    Animated.spring(alertAnimation, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      setAlertVisible(false);
      alertOnPress();
    });
  };

  useEffect(() => {
    if (!isGuest) {
      loadProfile();
    }
  }, [isGuest]);

  const loadProfile = async () => {
    try {
      const result = await getCurrentUserProfile();
      
      if (result.success) {
        const profileName = result.profile.full_name || result.profile.display_name || '';
        setName(profileName);
        setOriginalName(profileName);
      } else {
        // Fallback to auth metadata if profile doesn't exist
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const userName = user.user_metadata?.full_name || '';
          setName(userName);
          setOriginalName(userName);
        }
      }
    } catch (error) {
      console.error('❌ Error loading profile:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (isGuest) {
      Alert.alert('Sign In Required', 'Please sign in to save your profile information.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      // Update profile using the new profile service
      const result = await createOrUpdateProfile(name.trim());

      if (result.success) {
        // Also update auth metadata for consistency
        await supabase.auth.updateUser({
          data: { full_name: name.trim() }
        });

        setOriginalName(name.trim());

        showCustomAlert(
          'Profile Updated!', 
          'Your name has been updated successfully.',
          'OK',
          () => {
            navigation.navigate('MainTabs', { 
              screen: 'profile',
              params: { isGuest: false }
            });
          }
        );
      } else {
        console.log('❌ Failed to update profile:', result.error);
        Alert.alert('Error', `Failed to update profile: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Unexpected error during profile save:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = name.trim() !== originalName.trim();

  return (
    <SafeAreaView style={styles.container}>
      {/* Floating Decorative Elements */}
      <SafeDrawing 
        source={require('../assets/drawing3.png')}
        style={styles.floatingDrawingTopRight}
      />
      <SafeDrawing 
        source={require('../assets/drawing1.png')}
        style={styles.floatingDrawingTopLeft}
      />
      <SafeDrawing 
        source={require('../assets/drawing2.png')}
        style={styles.floatingDrawingBottomRight}
      />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackPress}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Profile</Text>
          <Text style={styles.subtitle}>
            {isGuest 
              ? 'Customize your experience (sign in to save)' 
              : 'Update your profile information'
            }
          </Text>
        </View>

        {/* Profile Form */}
        <View style={styles.form}>
          {/* Name Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={[styles.input, isGuest && styles.inputDisabled]}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor="#A0A0A0"
                editable={!isGuest}
              />
              {isGuest && (
                <Text style={styles.disabledText}>Sign in to save this information</Text>
              )}
            </View>
          </View>

          {/* Save Button */}
          {!isGuest && (
            <TouchableOpacity 
              style={[
                styles.saveButton, 
                loading && styles.buttonDisabled,
                !hasChanges && styles.buttonDisabled
              ]} 
              onPress={handleSaveProfile}
              disabled={loading || !hasChanges}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : 'Save Profile'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Sign In Prompt for Guests */}
          {isGuest && (
            <View style={styles.signInPrompt}>
              <Text style={styles.promptText}>Want to save your preferences?</Text>
              <TouchableOpacity 
                style={styles.signInPromptButton}
                onPress={() => navigation.navigate('SignIn')}
              >
                <Text style={styles.signInPromptButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Custom Alert Modal */}
      <Modal
        visible={alertVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeCustomAlert}
      >
        <View style={styles.alertOverlay}>
          <TouchableOpacity 
            style={styles.alertBackground}
            activeOpacity={1}
            onPress={closeCustomAlert}
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
              
              <TouchableOpacity 
                style={styles.alertButton}
                onPress={closeCustomAlert}
              >
                <Text style={styles.alertButtonText}>{alertButtonText}</Text>
              </TouchableOpacity>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 90,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  backButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#8B7355',
    letterSpacing: 0.2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
    paddingTop: 0,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    lineHeight: 40,
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
    marginTop: 0,
  },
  subtitle: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#6B6B6B',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    lineHeight: 30,
    color: '#2D2D2D',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  inputContainer: {
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
    backgroundColor: 'rgba(248, 246, 243, 0.88)',
    borderWidth: 1,
    borderColor: '#E8E6E3',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    letterSpacing: 0.1,
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#D0D0D0',
    color: '#A0A0A0',
  },
  disabledText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#A0A0A0',
    marginTop: 4,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#8B7355',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: {
    backgroundColor: '#D0D0D0',
  },
  saveButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  signInPrompt: {
    alignItems: 'center',
    marginTop: 32,
    padding: 24,
    backgroundColor: '#F8F6F3',
    borderRadius: 12,
  },
  promptText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#6B6B6B',
    marginBottom: 16,
    textAlign: 'center',
  },
  signInPromptButton: {
    backgroundColor: '#8B7355',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  signInPromptButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  floatingDrawingTopRight: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    opacity: 0.1,
  },
  floatingDrawingTopLeft: {
    position: 'absolute',
    top: 120,
    left: 20,
    width: 35,
    height: 35,
    opacity: 0.1,
  },
  floatingDrawingBottomRight: {
    position: 'absolute',
    bottom: 100,
    right: 30,
    width: 45,
    height: 45,
    opacity: 0.1,
  },
  alertOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  alertBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  alertContainer: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  alertContent: {
    alignItems: 'center',
  },
  alertTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    lineHeight: 28,
    color: '#2D2D2D',
    marginBottom: 16,
    textAlign: 'center',
  },
  alertMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 24,
  },
  alertButton: {
    backgroundColor: '#8B7355',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  alertButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
}); 