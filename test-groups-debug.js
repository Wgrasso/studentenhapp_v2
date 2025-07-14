// Group Join Debug Utility
// Copy and paste this in your browser console when your app is running

console.log('🔧 Group Debug Tool Loading...');

// Test functions for debugging group join issues
const groupDebug = {
  // Test finding a group by join code
  async testFindGroup(joinCode) {
    console.log(`\n🔍 === TESTING GROUP SEARCH ===`);
    console.log(`Join Code: ${joinCode}`);
    
    try {
      // Test direct database query
      const { data: groups, error } = await supabase
        .from('groups')
        .select('*')
        .eq('join_code', joinCode.toUpperCase())
        .eq('is_active', true);
      
      if (error) {
        console.error('❌ Database error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        
        if (error.message.includes('RLS')) {
          console.log('🚨 DIAGNOSIS: Row Level Security is blocking the query');
          console.log('💡 SOLUTION: Run the fix-groups-rls.sql script in Supabase SQL Editor');
        }
      } else if (groups && groups.length > 0) {
        console.log('✅ Group found:', groups[0]);
        return groups[0];
      } else {
        console.log('❌ No groups found with that join code');
        return null;
      }
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      return null;
    }
  },

  // Test the complete join flow
  async testJoinFlow(joinCode) {
    console.log(`\n🚪 === TESTING COMPLETE JOIN FLOW ===`);
    console.log(`Join Code: ${joinCode}`);
    
    try {
      // Check authentication first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log('❌ Not authenticated');
        return;
      }
      
      console.log('✅ User authenticated:', user.id);
      
      // Step 1: Find group
      const group = await this.testFindGroup(joinCode);
      if (!group) {
        console.log('❌ Cannot proceed - group not found');
        return;
      }
      
      // Step 2: Check existing membership
      console.log('\n👥 Checking existing membership...');
      const { data: membership, error: memberError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .single();
      
      if (memberError && memberError.code !== 'PGRST116') {
        console.error('❌ Error checking membership:', memberError);
        return;
      }
      
      if (membership) {
        console.log('⚠️ User is already a member');
        return;
      }
      
      console.log('✅ User is not yet a member, can join');
      
      // Step 3: Test join
      console.log('\n➕ Testing join...');
      const { data: newMember, error: joinError } = await supabase
        .from('group_members')
        .insert([{
          group_id: group.id,
          user_id: user.id,
          role: 'member'
        }])
        .select('*')
        .single();
      
      if (joinError) {
        console.error('❌ Join failed:', joinError);
        console.error('❌ Join error details:', JSON.stringify(joinError, null, 2));
        
        if (joinError.message.includes('RLS')) {
          console.log('🚨 DIAGNOSIS: Row Level Security is blocking the join');
          console.log('💡 SOLUTION: Check group_members RLS policies');
        }
      } else {
        console.log('✅ Successfully joined group!');
        console.log('👤 New membership:', newMember);
        
        // Clean up - remove the test membership
        console.log('\n🧹 Cleaning up test membership...');
        await supabase
          .from('group_members')
          .delete()
          .eq('group_id', group.id)
          .eq('user_id', user.id);
        console.log('✅ Test membership removed');
      }
      
    } catch (err) {
      console.error('❌ Unexpected error in test flow:', err);
    }
  },

  // List all available groups (for testing)
  async listAllGroups() {
    console.log(`\n📋 === LISTING ALL GROUPS ===`);
    
    try {
      const { data: groups, error } = await supabase
        .from('groups')
        .select('id, name, join_code, created_at, is_active')
        .eq('is_active', true)
        .limit(10);
      
      if (error) {
        console.error('❌ Error listing groups:', error);
      } else {
        console.log(`✅ Found ${groups.length} active groups:`);
        groups.forEach(group => {
          console.log(`• ${group.name} (${group.join_code}) - Created: ${group.created_at}`);
        });
        return groups;
      }
    } catch (err) {
      console.error('❌ Unexpected error listing groups:', err);
    }
  },

  // Check current user's auth status
  async checkAuth() {
    console.log(`\n👤 === CHECKING AUTHENTICATION ===`);
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('❌ Auth error:', error);
      } else if (user) {
        console.log('✅ User authenticated:');
        console.log(`• ID: ${user.id}`);
        console.log(`• Email: ${user.email}`);
        console.log(`• Created: ${user.created_at}`);
      } else {
        console.log('❌ No user found');
      }
      
      return user;
    } catch (err) {
      console.error('❌ Unexpected auth error:', err);
    }
  }
};

// Make it globally available
window.groupDebug = groupDebug;

console.log('✅ Group Debug Tool loaded!');
console.log('\n🔧 Available commands:');
console.log('• groupDebug.checkAuth() - Check authentication status');
console.log('• groupDebug.listAllGroups() - List all active groups');
console.log('• groupDebug.testFindGroup("JOIN_CODE") - Test finding a group');
console.log('• groupDebug.testJoinFlow("JOIN_CODE") - Test complete join process');
console.log('\n💡 Example usage:');
console.log('groupDebug.listAllGroups().then(() => groupDebug.testJoinFlow("ABC12345"))'); 