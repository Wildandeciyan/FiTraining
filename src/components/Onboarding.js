import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  Dimensions, 
  Animated, 
  TouchableOpacity, 
  useColorScheme,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Welcome to FiTraining',
    description: 'Aplikasi tracker gym modern untuk mencatat latihan, memantau progres, dan mencapai target kebugaranmu.',
    icon: 'fitness-outline',
  },
  {
    id: '2',
    title: 'Muscle Heatmap',
    description: 'Visualisasikan otot yang telah dilatih dengan fitur Heatmap interaktif. Ketahui bagian tubuh mana yang perlu fokus lebih.',
    icon: 'body-outline',
  },
  {
    id: '3',
    title: 'Progress Charts',
    description: 'Pantau peningkatan beban, set, dan repetisi dari waktu ke waktu. Grafik data membantu Anda melihat hasil nyata.',
    icon: 'trending-up-outline',
  },
  {
    id: '4',
    title: 'Offline & Privacy',
    description: 'Data latihan Anda tersimpan aman di perangkat (Local Database). Tidak perlu koneksi internet, privasi 100% terjaga.',
    icon: 'shield-checkmark-outline',
  },
];

const OnboardingItem = ({ item, isDark }) => {
  return (
    <View style={[styles.itemContainer, { backgroundColor: isDark ? '#1C1C1E' : '#F8F9FA' }]}>
      <View style={[styles.imageContainer, isDark && { backgroundColor: '#2C2C2E' }]}>
        <Ionicons name={item.icon} size={100} color="#007AFF" />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, isDark && { color: '#FFF' }]}>{item.title}</Text>
        <Text style={[styles.description, isDark && { color: '#CCC' }]}>{item.description}</Text>
      </View>
    </View>
  );
};

export default function Onboarding({ onDone }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef(null);

  const viewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const scrollTo = async () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current.scrollToIndex({ index: currentIndex + 1 });
    } else {
      // Finish Onboarding
      try {
        await AsyncStorage.setItem('@viewedOnboarding', 'true');
        if (onDone) onDone();
      } catch (err) {
        console.log('Error @setItem: ', err);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1C1C1E' : '#FFF' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 3 }}>
        <FlatList
          data={SLIDES}
          renderItem={({ item }) => <OnboardingItem item={item} isDark={isDark} />}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={32}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          ref={slidesRef}
        />
      </View>

      <View style={styles.paginatorContainer}>
        <View style={{ flexDirection: 'row', height: 64 }}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [10, 20, 10],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={i.toString()}
                style={[
                  styles.dot,
                  { width: dotWidth, opacity },
                  { backgroundColor: '#007AFF' }
                ]}
              />
            );
          })}
        </View>

        <TouchableOpacity 
            style={[styles.button, isDark && { backgroundColor: '#0A84FF' }]} 
            onPress={scrollTo}
            activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {currentIndex === SLIDES.length - 1 ? 'Mulai Sekarang' : 'Lanjut'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContainer: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imageContainer: {
    flex: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#E3F2FD',
  },
  textContainer: {
    flex: 0.3,
    alignItems: 'center',
  },
  title: {
    fontWeight: '800',
    fontSize: 28,
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  description: {
    fontWeight: '400',
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24
  },
  paginatorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    marginTop: 20,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  }
});
