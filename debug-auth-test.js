// Debug Authentication Test Script
// Run this in your browser console to test auth and check user status

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rqfgphfseinepfgiwnvh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZmdwaGZzZWluZXBmZ2l3bnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NjAzMTIsImV4cCI6MjA2NDUzNjMxMn0.QCt8I1xyRTN4v1bayn75Q0OfK5sNfNi-tAfqhvviZfI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Function to check user confirmation status
async function checkUserStatus(email) {
  console.log(`🔍 Checking status for: ${email}`)
  
  try {
    // Try to get user by email (admin function - won't work with anon key)
    // This is just for debugging - you'd need service role key for this
    
    // Instead, try signing in to see the error
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: 'test123' // This will fail but show us the error
    })
    
    if (error) {
      console.log('❌ Error details:', error)
      console.log('❌ Error code:', error.message)
      
      if (error.message.includes('Email not confirmed')) {
        console.log('📧 User exists but email is not confirmed')
      } else if (error.message.includes('Invalid login credentials')) {
        console.log('🔑 Either user does not exist or wrong password (could also be unconfirmed)')
      }
    } else {
      console.log('✅ Sign in successful (shouldn\'t happen with test password)')
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err)
  }
}

// Function to test signup
async function testSignup(email, password) {
  console.log(`📝 Testing signup for: ${email}`)
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: 'Test User',
        }
      }
    })
    
    if (error) {
      console.log('❌ Signup error:', error.message)
    } else {
      console.log('✅ Signup successful:', data)
      console.log('📧 User confirmed?:', data.user?.email_confirmed_at ? 'YES' : 'NO')
      console.log('📧 User ID:', data.user?.id)
    }
    
  } catch (err) {
    console.error('❌ Unexpected signup error:', err)
  }
}

// Function to test signin 
async function testSignin(email, password) {
  console.log(`🔐 Testing signin for: ${email}`)
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })
    
    if (error) {
      console.log('❌ Signin error:', error.message)
    } else {
      console.log('✅ Signin successful:', data)
      console.log('📧 User confirmed?:', data.user?.email_confirmed_at ? 'YES' : 'NO')
    }
    
  } catch (err) {
    console.error('❌ Unexpected signin error:', err)
  }
}

// Export functions for use
window.authDebug = {
  checkUserStatus,
  testSignup,
  testSignin,
  supabase
}

console.log('🛠️ Auth Debug Tools loaded!')
console.log('Use: authDebug.testSignup("email@test.com", "password123")')
console.log('Use: authDebug.testSignin("email@test.com", "password123")')
console.log('Use: authDebug.checkUserStatus("email@test.com")') 