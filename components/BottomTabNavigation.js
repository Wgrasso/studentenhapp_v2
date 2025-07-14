import React from 'react';
import { StyleSheet, View, TouchableOpacity, Image } from 'react-native';

export default function BottomTabNavigation({ currentScreen, onTabPress, isGuest }) {
  const handleTabPress = (screen) => {
    if (onTabPress) {
      onTabPress(screen);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, currentScreen === 'groups' && styles.activeTab]}
          onPress={() => handleTabPress('groups')}
        >
          <Image 
            source={require('../assets/groups.png')}
            style={[styles.tabIcon, currentScreen === 'groups' && styles.activeIcon]}
            resizeMode="contain"
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, currentScreen === 'inspiration' && styles.activeTab]}
          onPress={() => handleTabPress('inspiration')}
        >
          <Image 
            source={require('../assets/inspiration.png')}
            style={[styles.tabIcon, currentScreen === 'inspiration' && styles.activeInspirationIcon]}
            resizeMode="contain"
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, currentScreen === 'profile' && styles.activeTab]}
          onPress={() => handleTabPress('profile')}
        >
          <Image 
            source={require('../assets/profile.png')}
            style={[
              styles.tabIcon, 
              currentScreen === 'profile' && (isGuest ? styles.activeGuestIcon : styles.activeIcon)
            ]}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEFEFE',
    borderTopWidth: 1,
    borderTopColor: '#E8E6E3',
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 70,
    paddingTop: 20,
    paddingBottom: 15,
    paddingHorizontal: 24,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#F8F6F3',
  },
  tabIcon: {
    width: 46,
    height: 46,
    opacity: 0.6,
  },
  activeIcon: {
    opacity: 1,
    height: 55, 
  },
  activeInspirationIcon: {
    opacity: 1,
    height: 55,
  },
  activeGuestIcon: {
    opacity: 1,
    height: 55,
    tintColor: '#4A90E2',
  },
}); 