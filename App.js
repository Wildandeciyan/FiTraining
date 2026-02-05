import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { initDB } from './src/database/db';
import { useEffect, useState } from 'react';
import { DateProvider } from './src/context/DateContext';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    const prepare = async () => {
      try {
        await initDB();
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
        <Text>Memuat Database...</Text>
      </View>
    );
  }

  return (
    <DateProvider>
      <View style={styles.container}>
        <AppNavigator />
        <StatusBar style="auto" />
      </View>
    </DateProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});