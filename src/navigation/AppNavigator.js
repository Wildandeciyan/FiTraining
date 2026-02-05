import React from 'react';
import { Image, View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons'; // Import Icons

import HomeScreen from '../screens/HomeScreen';
import ExerciseLibraryScreen from '../screens/ExerciseLibraryScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProgressScreen from '../screens/ProgressScreen';
import ActiveWorkoutScreen from '../screens/ActiveWorkoutScreen';
import CreatePlanScreen from '../screens/CreatePlanScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HeaderBrand() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Image 
        source={require('../../assets/app-logo/AppLogo-Blue.png')} 
        style={{ width: 30, height: 30, resizeMode: 'contain' }} 
      />
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginLeft: 8 }}>
        FiTraining
      </Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarStyle: { paddingBottom: 5, height: 60 },
        tabBarLabelStyle: { fontSize: 12 },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: 'gray',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Library') {
            iconName = focused ? 'barbell' : 'barbell-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Progress') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ 
          headerTitle: () => <HeaderBrand />,
          title: 'Beranda' 
        }} 
      />
      <Tab.Screen name="Library" component={ExerciseLibraryScreen} options={{ title: 'Exercise' }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ title: 'Progres' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Riwayat' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {/* Main Tab Navigator */}
        <Stack.Screen 
          name="Main" 
          component={MainTabs} 
          options={{ headerShown: false }} 
        />
        
        {/* Full Screen / Modal flows */}
        <Stack.Screen 
          name="ActiveWorkout" 
          component={ActiveWorkoutScreen} 
          options={{ 
            headerShown: false,
            presentation: 'fullScreenModal', 
          }} 
        />
        
        <Stack.Screen 
          name="CreatePlan" 
          component={CreatePlanScreen} 
          options={{ 
            presentation: 'modal',
            headerShown: false 
          }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
