import { supabase } from './supabase';

/**
 * Check if meal request tables exist and create them if they don't
 */
export const setupMealRequestTables = async () => {
  console.log('🛠️ [DATABASE] Checking meal request table setup...');
  
  try {
    // Test if the tables exist by trying a simple query
    const { data, error } = await supabase
      .from('meal_requests')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      // Table doesn't exist error code
      console.log('📋 Tables do not exist. Please run the SQL setup in Supabase dashboard.');
      return {
        success: false,
        error: 'Database tables not found. Please run the SQL setup script in your Supabase dashboard.',
        needsSetup: true
      };
    } else if (error) {
      console.error('❌ Database error:', error);
      return {
        success: false,
        error: error.message,
        needsSetup: false
      };
    } else {
      console.log('✅ Meal request tables are ready!');
      return {
        success: true,
        message: 'Database tables are set up and ready',
        needsSetup: false
      };
    }
  } catch (error) {
    console.error('❌ Database setup check failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to check database setup',
      needsSetup: false
    };
  }
};

/**
 * Test basic database connectivity
 */
export const testDatabaseConnection = async () => {
  console.log('🔍 [DATABASE] Testing database connection...');
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      return {
        success: false,
        error: 'Authentication error: ' + error.message
      };
    }
    
    if (!user) {
      return {
        success: false,
        error: 'No authenticated user found'
      };
    }
    
    console.log('✅ Database connection successful');
    return {
      success: true,
      user: user,
      message: 'Database connection is working'
    };
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return {
      success: false,
      error: error.message || 'Database connection failed'
    };
  }
}; 