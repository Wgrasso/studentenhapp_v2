import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, TouchableOpacity, Text, Image } from 'react-native';
import { Asset } from 'expo-asset';
import { supabase } from '../lib/supabase';
import IdeasScreen from './IdeasScreen';
import MainProfileScreen from './MainProfileScreen';
import ProfileScreen from './ProfileScreen';
import GroupsScreen from './GroupsScreen';
import SignInScreen from './SignInScreen';
import SignUpScreen from './SignUpScreen';
import BottomTabNavigation from './BottomTabNavigation';

export default function MainTabNavigator({ navigation, route }) {
  const [currentTab, setCurrentTab] = useState('profile');
  const [isGuest, setIsGuest] = useState(true);
  const [loadedTabs, setLoadedTabs] = useState({
    inspiration: false,
    profile: false,
    groups: false,
    signin: false,
    signup: false
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [imagesPreloaded, setImagesPreloaded] = useState(false);

  useEffect(() => {
    // Start preloading images immediately
    preloadImages();
    initializeApp();
  }, []);

  useEffect(() => {
    // Handle navigation params to set current tab and guest status
    if (route?.params?.screen) {
      setCurrentTab(route.params.screen);
    }
    if (route?.params?.params?.isGuest !== undefined) {
      const guestStatus = route.params.params.isGuest;
      setIsGuest(guestStatus);
    }
    
    // Handle switching to groups tab and reopening group modal
    if (route?.params?.switchToGroupsTab) {
      console.log('🔄 Switching to groups tab and reopening modal');
      setCurrentTab('groups');
      
      // Ensure groups tab is loaded
      if (!loadedTabs.groups) {
        setLoadedTabs(prev => ({ ...prev, groups: true }));
      }
    }
  }, [route?.params]);

  const preloadImages = async () => {
    try {
      // Preload core images and icons (always available)
      const coreImageAssets = [
        require('../assets/studentenhapp-logo.png'),
        require('../assets/profile.png'),
        require('../assets/inspiration.png'),
        require('../assets/groups.png'),
      ];

      // Preload core images
      await Asset.loadAsync(coreImageAssets);
      
      // Try to preload custom drawings (may not exist yet)
      try {
        const customDrawings = [
          require('../assets/drawing1.png'),
          require('../assets/drawing2.png'),
          require('../assets/drawing3.png'),
          require('../assets/drawing4.png'),
        ];
        await Asset.loadAsync(customDrawings);
      } catch (drawingError) {
        // Custom drawings not available yet, continue without them
        console.log('ℹ️ Custom drawings not found, continuing without them');
      }
      
      // Preload some common fallback images
      const fallbackImages = [
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1621996346565-e3dbc353d2c5?w=400&h=300&fit=crop'
      ];

      // Preload remote images in background
      fallbackImages.forEach(url => {
        Image.prefetch(url).catch(() => {
          // Ignore errors for fallback images
        });
      });

      setImagesPreloaded(true);
    } catch (error) {
      console.error('❌ Error preloading images:', error);
      setImagesPreloaded(true); // Continue even if preloading fails
    }
  };

  const initializeApp = async () => {
    // 1. Check auth status first
    await checkAuthStatus();
    
    // 2. Load profile page first (now default)
    setLoadedTabs(prev => ({ ...prev, profile: true }));
    
    // 3. Preload other pages in background after a short delay
    setTimeout(() => {
      setLoadedTabs(prev => ({ 
        ...prev, 
        inspiration: true,
        groups: true,
        signin: true,
        signup: true 
      }));
      setIsInitialLoading(false);
    }, 1000);
  };

  const checkAuthStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isUserGuest = !user;
      
      // If transitioning from guest to authenticated
      if (isGuest && !isUserGuest) {
        console.log('🔄 User just signed in, preloading meals...');
        const { preloadAllMeals } = require('../lib/mealPreloadService');
        const { getUserGroups } = require('../lib/groupsService');
        
        // Start preloading immediately
        const preloadPromise = getUserGroups().then(groupsResult => {
          if (groupsResult.success) {
            console.log('✅ Got groups, preloading meals for each...');
            return preloadAllMeals(groupsResult.groups);
          }
        }).catch(error => {
          console.error('❌ Error during meal preloading:', error);
        });
        
        // Don't wait for preload to finish
        setIsGuest(false);
        
        // Continue preloading in background
        preloadPromise.then(() => {
          console.log('✅ All meals preloaded successfully');
        });
      } else {
        setIsGuest(isUserGuest);
      }
    } catch (error) {
      console.error('❌ Error checking auth status:', error);
      setIsGuest(true);
    }
  };

  const handleReloadAll = () => {
    // Reset all loaded states to force fresh data
    setLoadedTabs({
      inspiration: false,
      profile: false,
      groups: false,
      signin: false,
      signup: false
    });
    setProfileRefreshKey(prev => prev + 1);
    
    // Reload pages in sequence
    setTimeout(() => {
      setLoadedTabs(prev => ({ 
        ...prev, 
        inspiration: true,
        groups: true,
        signin: true,
        signup: true
      }));
      setTimeout(() => {
        if (!isGuest) {
          setLoadedTabs(prev => ({ ...prev, profile: true }));
        }
      }, 500);
    }, 100);
  };

  const handleTabPress = (screen) => {
    if (screen === 'profile') {
      setCurrentTab('profile');
      // Refresh auth state when accessing profile to get latest user data
      if (!isGuest) {
        checkAuthStatus();
      }
    } else if (screen === 'inspiration') {
      setCurrentTab('inspiration');
    } else if (screen === 'groups') {
      setCurrentTab('groups');
    }
  };

  // Create enhanced navigation object once
  const enhancedNavigation = {
    ...navigation,
    navigate: (routeName, params) => {
      if (routeName === 'Profile') {
        // Set current tab to profile and pass through parameters
        setCurrentTab('profile');
        navigation.navigate('Profile', params);
      } else if (routeName === 'SignIn') {
        // Use cached SignIn screen for instant loading
        setCurrentTab('signin');
      } else if (routeName === 'SignUp') {
        // Use cached SignUp screen for instant loading
        setCurrentTab('signup');
      } else if (routeName === 'MainTabs') {
        // Handle navigation back to tabs by refreshing auth state and reloading profile
        checkAuthStatus();
        setCurrentTab('profile'); // Default to profile tab
        
        // Refresh profile data if user just signed in
        setProfileRefreshKey(prev => prev + 1);
        
        setTimeout(() => {
          setLoadedTabs(prev => ({ ...prev, profile: false }));
          setTimeout(() => {
            setLoadedTabs(prev => ({ ...prev, profile: true }));
          }, 100);
        }, 500);
      } else {
        navigation.navigate(routeName, params);
      }
    }
  };

  if (isInitialLoading || !imagesPreloaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Image 
            source={require('../assets/studentenhapp-logo.png')}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
          <Text style={styles.loadingText}>
            {!imagesPreloaded ? 'Loading images...' : 'Preparing your student experience...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Reload Button */}
      <TouchableOpacity 
        style={styles.reloadButton}
        onPress={handleReloadAll}
      >
        <Text style={styles.reloadIcon}>⟲</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Ideas Screen - Always render once loaded */}
        <View style={[
          styles.screenContainer, 
          currentTab === 'inspiration' ? styles.activeScreen : styles.hiddenScreen
        ]}>
          {loadedTabs.inspiration && (
            <IdeasScreen 
              key={`ideas-${isGuest}`}
              route={{ params: { isGuest } }} 
              navigation={enhancedNavigation}
              hideBottomNav={true}
            />
          )}
        </View>

        {/* Profile Screen - Always render once loaded */}
        <View style={[
          styles.screenContainer, 
          currentTab === 'profile' ? styles.activeScreen : styles.hiddenScreen
        ]}>
          {loadedTabs.profile && (
            isGuest ? (
              <MainProfileScreen 
                key={`guest-profile-${profileRefreshKey}`}
                route={{ params: { isGuest: true } }} 
                navigation={enhancedNavigation}
                hideBottomNav={true}
              />
            ) : (
              <MainProfileScreen 
                key={`profile-${profileRefreshKey}`}
                route={{ params: { isGuest: false } }} 
                navigation={enhancedNavigation}
                hideBottomNav={true}
              />
            )
          )}
        </View>

        {/* Groups Screen - Always render once loaded */}
        <View style={[
          styles.screenContainer, 
          currentTab === 'groups' ? styles.activeScreen : styles.hiddenScreen
        ]}>
          {loadedTabs.groups && (
            <GroupsScreen 
              key={`groups-${isGuest}`}
              route={{ 
                params: { 
                  isGuest,
                  reopenGroupModal: route?.params?.reopenGroupModal,
                  groupId: route?.params?.groupId
                } 
              }} 
              navigation={enhancedNavigation}
              hideBottomNav={true}
            />
          )}
        </View>

        {/* SignIn Screen - Preloaded for faster access */}
        <View style={[
          styles.screenContainer, 
          currentTab === 'signin' ? styles.activeScreen : styles.hiddenScreen
        ]}>
          {loadedTabs.signin && (
            <SignInScreen 
              key={`signin-${profileRefreshKey}`}
              navigation={enhancedNavigation}
            />
          )}
        </View>

        {/* SignUp Screen - Preloaded for faster access */}
        <View style={[
          styles.screenContainer, 
          currentTab === 'signup' ? styles.activeScreen : styles.hiddenScreen
        ]}>
          {loadedTabs.signup && (
            <SignUpScreen 
              key={`signup-${profileRefreshKey}`}
              navigation={enhancedNavigation}
            />
          )}
        </View>
      </View>
      
      <BottomTabNavigation 
        currentScreen={currentTab}
        onTabPress={handleTabPress}
        isGuest={isGuest}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEFEFE',
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  screenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 70,
  },
  activeScreen: {
    zIndex: 1,
    opacity: 1,
  },
  hiddenScreen: {
    zIndex: 0,
    opacity: 0,
    pointerEvents: 'none',
  },
  reloadButton: {
    position: 'absolute',
    top: 50,
    right: 24,
    width: 40,
    height: 40,
    backgroundColor: '#8B7355',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  reloadIcon: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FEFEFE',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B7355',
  },
}); 