import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ScrollView, Image, Modal, Animated } from 'react-native';
import { supabase } from '../lib/supabase';

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

export default function SignUpScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Custom Alert Modal states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertAnimation] = useState(new Animated.Value(0));
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtonText, setAlertButtonText] = useState('OK');
  const [alertOnPress, setAlertOnPress] = useState(() => () => {});

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

  const handleSignUp = async () => {
    console.log('📝 User attempting to sign up...');
    
    if (!name || !email || !password || !confirmPassword) {
      console.log('❌ Sign up failed: Missing required fields');
      showCustomAlert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      console.log('❌ Sign up failed: Passwords do not match');
      showCustomAlert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      console.log('❌ Sign up failed: Password too short');
      showCustomAlert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      });

      if (error) {
        console.log('❌ Sign up failed:', error.message);
        showCustomAlert('Sign Up Error', error.message);
      } else {
        console.log('🎉 Account created successfully for:', email);
        
        showCustomAlert(
          'Account Created!', 
          'Your account has been created successfully! Please check your email and click the confirmation link. After confirming, you can sign in with your credentials.',
          'OK',
          () => {
            navigation.navigate('SignIn');
          }
        );
      }
    } catch (error) {
      console.error('❌ Unexpected sign up error:', error);
      showCustomAlert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Section with Logo */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Image 
                source={require('../assets/studentenhapp-logo.png')}
                style={styles.smallLogo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Join studentenhapp</Text>
            </View>
            <Text style={styles.subtitle}>Begin your exciting student adventure</Text>
          </View>

          {/* Form Section */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                placeholderTextColor="#A0A0A0"
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#A0A0A0"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                placeholderTextColor="#A0A0A0"
                secureTextEntry
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                placeholderTextColor="#A0A0A0"
                secureTextEntry
                editable={!loading}
              />
            </View>

            <TouchableOpacity 
              style={[styles.signUpButton, loading && styles.buttonDisabled]} 
              onPress={handleSignUp}
              disabled={loading}
            >
              <Text style={styles.signUpButtonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By creating an account, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>

          {/* Footer Section */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.signInText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
    backgroundColor: '#FEFEFE', // Off-white background
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24, // 24px outer margins as per style guide
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 0,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  smallLogo: {
    width: 180,
    height: 180,
    marginRight: -30,
    marginLeft: -30,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold', // Serif font for headlines
    fontSize: 28,
    lineHeight: 36,
    color: '#2D2D2D', // Charcoal black
    letterSpacing: 0.5, // Open letter spacing
    flex: 1,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular', // Sans-serif for body text
    fontSize: 16,
    lineHeight: 24,
    color: '#6B6B6B', // Soft brown/gray
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 40,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20, // Slightly tighter spacing for more fields
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
    backgroundColor: '#F8F6F3', // Light beige
    borderWidth: 1,
    borderColor: '#E8E6E3',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    letterSpacing: 0.1,
    minHeight: 56, // Ensure consistent height
  },
  signUpButton: {
    backgroundColor: '#8B7355', // Soft brown
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signUpButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  termsText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#A0A0A0',
    textAlign: 'center',
    letterSpacing: 0.1,
    marginBottom: 20,
    paddingHorizontal: 10, // Add padding to prevent text cutoff
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
    flexWrap: 'wrap', // Allow text to wrap if needed
  },
  footerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    letterSpacing: 0.1,
  },
  signInText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#8B7355',
    letterSpacing: 0.1,
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
    shadowOffset: {
      width: 0,
      height: 12,
    },
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
    shadowOffset: {
      width: 0,
      height: 3,
    },
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
}); 