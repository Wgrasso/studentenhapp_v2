import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ScrollView, Image } from 'react-native';
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

export default function SignInScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    console.log('🔐 User attempting to sign in...');
    
    if (!email || !password) {
      console.log('❌ Sign in failed: Missing email or password');
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.log('❌ Sign in failed:', error.message);
        
        // Provide specific error messages for common issues
        let errorMessage = error.message;
        
        if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
          errorMessage = 'Please confirm your email address before signing in. Check your inbox for a confirmation email and click the link.';
        } else if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again. If you just signed up, make sure to confirm your email first.';
        }
        
        Alert.alert('Sign In Error', errorMessage);
      } else {
        console.log('✅ Sign in successful! User:', data.user.email);
        
        console.log('✅ User signed in successfully');
        const user = data.user;
        
        // Navigate directly to main profile page after login
        navigation.navigate('MainTabs', { 
          screen: 'profile',
          params: { isGuest: false }
        });
      }
    } catch (error) {
      console.error('❌ Unexpected sign in error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueWithoutSignIn = () => {
    navigation.navigate('MainTabs', { 
      screen: 'profile',
      params: { isGuest: true }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Drawing Background */}
      <SafeDrawing 
        source={require('../assets/drawing1.png')}
        style={styles.backgroundDrawing}
      />
      
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
            <Image 
              source={require('../assets/studentenhapp-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.subtitle}>Welcome back to your student journey</Text>
          </View>

          {/* Form Section */}
          <View style={styles.form}>
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
                placeholder="Enter your password"
                placeholderTextColor="#A0A0A0"
                secureTextEntry
                editable={!loading}
              />
            </View>

            <TouchableOpacity 
              style={[styles.signInButton, loading && styles.buttonDisabled]} 
              onPress={handleSignIn}
              disabled={loading}
            >
              <Text style={styles.signInButtonText}>
                {loading ? 'Signing In...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity 
              style={styles.continueButton} 
              onPress={handleContinueWithoutSignIn}
            >
              <Text style={styles.continueButtonText}>Continue without signing in</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Section */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.signUpText}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: 1,
    paddingBottom: 0,
    //het logo van de login
  },
  header: {
    alignItems: 'center',
    marginBottom: 10,
    paddingTop: 2,
    //onder welcome back in login 
  },
  logo: {
    width: 320,
    height: 320,
    marginBottom: -12,
    marginTop: -20,
    //onder het logo 
  },
  subtitle: {
    fontFamily: 'PlayfairDisplay_400Regular', // Changed to serif for elegance
    fontSize: 18,
    lineHeight: 26,
    color: '#6B6B6B', // Soft brown/gray
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 24,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 24, // Consistent spacing
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
  signInButton: {
    backgroundColor: '#8B7355', // Soft brown
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FEFEFE',
    letterSpacing: 0.2,
  },
  forgotPassword: {
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#8B7355',
    letterSpacing: 0.1,
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
  signUpText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#8B7355',
    letterSpacing: 0.1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E6E3',
  },
  dividerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B6B6B',
    letterSpacing: 0.1,
    marginHorizontal: 12,
  },
  continueButton: {
    backgroundColor: '#F8F6F3',
    borderWidth: 2,
    borderColor: '#8B7355',
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  continueButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#8B7355',
    letterSpacing: 0.2,
  },
  backgroundDrawing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
    transform: [{ rotate: '5deg' }],
  },
}); 