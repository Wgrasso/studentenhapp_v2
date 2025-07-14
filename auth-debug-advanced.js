// Advanced Authentication Debugging Tool
// Copy and paste this into your browser console when your app is running

console.log('🔧 Advanced Auth Debug Tool Loading...');

// Import Supabase (assumes it's available globally or you can import it)
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://rqfgphfseinepfgiwnvh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZmdwaGZzZWluZXBmZ2l3bnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NjAzMTIsImV4cCI6MjA2NDUzNjMxMn0.QCt8I1xyRTN4v1bayn75Q0OfK5sNfNi-tAfqhvviZfI';

const debugSupabase = createClient(supabaseUrl, supabaseAnonKey);

// Enhanced debugging functions
const authDebugAdvanced = {
  // Test full signup flow with detailed logging
  async testSignupFlow(email, password, name = 'Test User') {
    console.log('\n🧪 === FULL SIGNUP FLOW TEST ===');
    console.log(`📧 Email: ${email}`);
    console.log(`🔒 Password: ${password}`);
    
    try {
      console.log('\n📝 Step 1: Attempting signup...');
      const { data, error } = await debugSupabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: name,
          }
        }
      });

      if (error) {
        console.error('❌ Signup failed:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        return { success: false, error: error };
      }

      console.log('✅ Signup successful!');
      console.log('👤 User ID:', data.user?.id);
      console.log('📧 Email confirmed at signup?:', data.user?.email_confirmed_at ? 'YES' : 'NO');
      console.log('📅 Created at:', data.user?.created_at);
      console.log('📊 User metadata:', data.user?.user_metadata);
      
      return { success: true, data: data };
      
    } catch (err) {
      console.error('❌ Unexpected signup error:', err);
      return { success: false, error: err };
    }
  },

  // Test signin with detailed error analysis
  async testSigninFlow(email, password) {
    console.log('\n🔐 === FULL SIGNIN FLOW TEST ===');
    console.log(`📧 Email: ${email}`);
    
    try {
      console.log('\n🔍 Step 1: Attempting signin...');
      const { data, error } = await debugSupabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        console.error('❌ Signin failed:', error.message);
        console.error('❌ Error code:', error.code || 'No code');
        console.error('❌ Error status:', error.status || 'No status');
        console.error('❌ Full error details:', JSON.stringify(error, null, 2));
        
        // Analyze specific error types
        if (error.message.includes('Email not confirmed')) {
          console.log('📧 DIAGNOSIS: Email confirmation required but not completed');
        } else if (error.message.includes('Invalid login credentials')) {
          console.log('🔑 DIAGNOSIS: Either wrong password OR unconfirmed email OR user doesn\'t exist');
        } else if (error.message.includes('Too many requests')) {
          console.log('⏱️ DIAGNOSIS: Rate limited - wait before trying again');
        } else if (error.code === 500 || error.status === 500) {
          console.log('🚨 DIAGNOSIS: Server error - likely database trigger issue');
        }
        
        return { success: false, error: error };
      }

      console.log('✅ Signin successful!');
      console.log('👤 User ID:', data.user?.id);
      console.log('📧 Email confirmed?:', data.user?.email_confirmed_at ? 'YES' : 'NO');
      console.log('🔑 Session:', data.session ? 'Active' : 'None');
      
      return { success: true, data: data };
      
    } catch (err) {
      console.error('❌ Unexpected signin error:', err);
      return { success: false, error: err };
    }
  },

  // Check if user profile was created properly
  async checkUserProfile(userId) {
    console.log('\n👤 === USER PROFILE CHECK ===');
    console.log(`🆔 User ID: ${userId}`);
    
    try {
      // Check if profile exists
      const { data: profile, error: profileError } = await debugSupabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('❌ Profile check error:', profileError);
        if (profileError.code === 'PGRST116') {
          console.log('📝 DIAGNOSIS: User profile not created (trigger might have failed)');
        }
        return { exists: false, error: profileError };
      }

      console.log('✅ User profile found:', profile);
      return { exists: true, profile: profile };
      
    } catch (err) {
      console.error('❌ Unexpected profile check error:', err);
      return { exists: false, error: err };
    }
  },

  // Check auth settings
  async checkAuthSettings() {
    console.log('\n⚙️ === AUTH SETTINGS CHECK ===');
    
    try {
      // Try to get auth settings (this might not work with anon key)
      const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const settings = await response.json();
        console.log('⚙️ Auth settings:', settings);
        return settings;
      } else {
        console.log('ℹ️ Cannot access auth settings with anon key (expected)');
        return null;
      }
    } catch (err) {
      console.log('ℹ️ Auth settings check failed (expected with anon key)');
      return null;
    }
  },

  // Complete flow test
  async runFullTest(testEmail = 'debug@test.com', testPassword = 'debug123456') {
    console.log('\n🚀 === RUNNING COMPLETE AUTHENTICATION TEST ===');
    
    // Step 1: Check auth settings
    await this.checkAuthSettings();
    
    // Step 2: Test signup
    const signupResult = await this.testSignupFlow(testEmail, testPassword);
    
    if (!signupResult.success) {
      console.log('\n❌ Signup failed, cannot continue with signin test');
      return;
    }
    
    // Step 3: Check if profile was created
    if (signupResult.data?.user?.id) {
      await this.checkUserProfile(signupResult.data.user.id);
    }
    
    // Step 4: Wait a moment then test signin
    console.log('\n⏳ Waiting 2 seconds before signin test...');
    setTimeout(async () => {
      await this.testSigninFlow(testEmail, testPassword);
      
      console.log('\n📋 === TEST SUMMARY ===');
      console.log('1. Check the errors above');
      console.log('2. Look for "DIAGNOSIS" messages');
      console.log('3. If you see 500 errors, the database trigger is likely the issue');
      console.log('4. If you see "Email not confirmed", email confirmation is enabled');
      console.log('5. If signin works immediately, email confirmation is disabled');
    }, 2000);
  }
};

// Make it globally available
window.authDebugAdvanced = authDebugAdvanced;

console.log('✅ Advanced Auth Debug Tool loaded!');
console.log('\n🔧 Available commands:');
console.log('• authDebugAdvanced.runFullTest() - Run complete test');
console.log('• authDebugAdvanced.testSignupFlow("email@test.com", "password123")');
console.log('• authDebugAdvanced.testSigninFlow("email@test.com", "password123")');
console.log('• authDebugAdvanced.checkUserProfile("user-uuid")');
console.log('\n▶️ To start, run: authDebugAdvanced.runFullTest()'); 