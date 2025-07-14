// Simple Authentication Test
// You can run this in your app's console to test auth

const testEmail = 'test@example.com';
const testPassword = 'test123456';

console.log('🧪 Testing Authentication...');

// Test 1: Try signing up
console.log('📝 Step 1: Testing signup...');
supabase.auth.signUp({
  email: testEmail,
  password: testPassword,
  options: {
    data: {
      full_name: 'Test User',
    }
  }
}).then(({ data, error }) => {
  if (error) {
    console.log('❌ Signup failed:', error.message);
  } else {
    console.log('✅ Signup successful!');
    console.log('📧 Email confirmed at signup?:', data.user?.email_confirmed_at ? 'YES' : 'NO');
    
    // Test 2: Try signing in immediately (should work if email confirmation is disabled)
    console.log('🔐 Step 2: Testing immediate signin...');
    setTimeout(() => {
      supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      }).then(({ data, error }) => {
        if (error) {
          console.log('❌ Signin failed:', error.message);
          if (error.message.includes('Email not confirmed')) {
            console.log('💡 Email confirmation is ENABLED - you need to check your email or disable it in Supabase dashboard');
          }
        } else {
          console.log('✅ Signin successful! Authentication is working correctly.');
        }
      });
    }, 1000);
  }
});

console.log('⏳ Check the console output above for test results...'); 