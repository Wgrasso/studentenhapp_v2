import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useFonts, PlayfairDisplay_400Regular, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';

import { AppStateProvider } from './lib/AppStateContext';
import SignInScreen from './components/SignInScreen';
import SignUpScreen from './components/SignUpScreen';
import ProfileScreen from './components/ProfileScreen';
import MainTabNavigator from './components/MainTabNavigator';
import VotingScreen from './components/VotingScreen';
import ResultsScreen from './components/ResultsScreen';

const Stack = createStackNavigator();

export default function App() {
  let [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppStateProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator
          initialRouteName="SignIn"
          screenOptions={{
            headerShown: false, // Hide headers for clean aesthetic
            cardStyle: { backgroundColor: '#FEFEFE' }, // Consistent background
          }}
        >
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="VotingScreen" component={VotingScreen} />
          <Stack.Screen name="ResultsScreen" component={ResultsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppStateProvider>
  );
}
