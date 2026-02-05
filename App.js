import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { initDB } from './src/database/db';
import { useEffect, useState } from 'react';
import { DateProvider } from './src/context/DateContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        // 1. Init Database
        await initDB();
        
        // 2. Check Onboarding Status
        const value = await AsyncStorage.getItem('@viewedOnboarding');
        if (value !== null) {
          setShowOnboarding(false);
        } else {
          setShowOnboarding(true);
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    };
    
    prepare();
  }, []);

  if (!isReady) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{marginTop: 20, color: '#666'}}>Memuat Data...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <DateProvider>
        <View style={styles.container}>
          {/* Main App (Always Rendered underneath) */}
          <AppNavigator />

          {/* Onboarding Overlay */}
          {showOnboarding && (
            <View style={styles.overlay}>
              <OnboardingScreen onDone={() => setShowOnboarding(false)} />
            </View>
          )}
          <StatusBar style="auto" />
        </View>
      </DateProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    backgroundColor: '#fff',
  },
});
