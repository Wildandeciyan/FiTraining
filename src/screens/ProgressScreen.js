import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, FlatList, Dimensions, useColorScheme } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { 
  getAllExercises, 
  getExerciseHistoryData, 
  getStartOfWeekDate, 
  getStartOfMonthDate, 
  getWeeklyWorkoutCount, 
  getMonthlyWorkoutCount, 
  getPersonalRecords, 
  getLatestWeight,
  getPrCount,
  getPaginatedPersonalRecords,
  getMusclesTrainedOnDate
} from '../database/db';
import MuscleHeatmap from '../components/MuscleHeatmap';
import { useDate } from '../context/DateContext';

export default function ProgressScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // GLOBAL DATE CONTEXT
  const { selectedDate } = useDate();

  // BASIC STATS
  const [stats, setStats] = useState({
    weekCount: 0,
    monthCount: 0,
    currentMonthName: '',
    prs: [],
    latestWeight: 0
  });
  
  const [refreshing, setRefreshing] = useState(false);
  const [trainedMuscles, setTrainedMuscles] = useState([]);

  // PR PAGINATION STATE
  const [prData, setPrData] = useState([]);
  const [prPage, setPrPage] = useState(1);
  const [prTotalItems, setPrTotalItems] = useState(0);
  const [prTotalPages, setPrTotalPages] = useState(1);
  const prLimit = 5;

  // CHART & EXERCISE COMPARISON STATE
  const [exerciseList, setExerciseList] = useState([]);
  const [selectedExId, setSelectedExId] = useState(null);
  const [showExModal, setShowExModal] = useState(false);

  // CHART STATE
  const [chartData, setChartData] = useState([]); // Raw from DB
  const [chartMetric, setChartMetric] = useState('weight'); // 'weight' | 'reps' | 'sets'

  const loadPrs = (page = 1) => {
    try {
      const total = getPrCount();
      setPrTotalItems(total);
      const pages = Math.ceil(total / prLimit);
      setPrTotalPages(pages);
      const targetPage = page > pages && pages > 0 ? pages : page;
      setPrPage(targetPage);
      const offset = (targetPage - 1) * prLimit;
      const data = getPaginatedPersonalRecords(prLimit, offset);
      setPrData(data);
    } catch (e) {
      console.error("Error loading PRs:", e);
    }
  };

  const handlePrPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= prTotalPages) {
      loadPrs(newPage);
    }
  };

  const loadStats = () => {
    try {
      const today = new Date();
      const monthName = today.toLocaleDateString('id-ID', { month: 'long' });
      const startOfWeek = getStartOfWeekDate();
      const weekCount = getWeeklyWorkoutCount(startOfWeek);
      const startOfMonth = getStartOfMonthDate();
      const monthCount = getMonthlyWorkoutCount(startOfMonth);
      const latestWeight = getLatestWeight();
      const trained = getMusclesTrainedOnDate(selectedDate);
      
      setTrainedMuscles(trained);
      setStats({
        weekCount,
        monthCount,
        currentMonthName: monthName,
        prs: [], 
        latestWeight
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
    setRefreshing(false);
  };

  const loadExercisesForComp = () => {
    try {
      const list = getAllExercises();
      setExerciseList(list);
      if (list?.length > 0 && !selectedExId) {
        setSelectedExId(list[0].id);
      }
    } catch (e) {
      console.error("Error loading exercises for comparison", e);
    }
  };

  // Effect for Chart Data
  useEffect(() => {
    if (selectedExId) {
      try {
        const raw = getExerciseHistoryData(selectedExId);
        setChartData(raw);
      } catch (e) {
        console.error("Chart load error", e);
      }
    }
  }, [selectedExId, refreshing]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
      loadPrs(1);
      loadExercisesForComp();
    }, [selectedDate])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
    loadPrs(1);
    loadExercisesForComp();
  };

  const getSelectedExName = () => {
    if (!exerciseList) return "Pilih Exercise";
    const ex = exerciseList.find(e => e.id === selectedExId);
    return ex ? ex.name : "Pilih Exercise";
  };

  const processChartData = () => {
    if (!chartData || chartData.length === 0) return null;
    const labels = chartData.map(d => {
       const date = new Date(d.workout_date);
       return `${date.getDate()}/${date.getMonth() + 1}`;
    });
        const data = chartData.map(d => {
           if (chartMetric === 'weight') return d.weight;
           if (chartMetric === 'reps') return d.reps;
           if (chartMetric === 'sets') return d.sets;
           return 0;
        });
    
        return {
          labels,
          datasets: [{ 
            data,
            color: (opacity = 1) => `rgba(10, 132, 255, ${opacity})`, // Force Data Line to be BLUE
            strokeWidth: 2
          }]
        };
      };
    
      const finalChartData = processChartData();
      const screenWidth = Dimensions.get("window").width;
    
      const renderMetricChip = (metric, label) => {
         const isActive = chartMetric === metric;
         return (
           <TouchableOpacity 
             style={[
               styles.metricChip, 
               isDark && { backgroundColor: '#3A3A3C' }, 
               isActive && styles.metricChipActive
             ]} 
             onPress={() => setChartMetric(metric)}
           >
              <Text style={[
                styles.metricText, 
                isActive && styles.metricTextActive
              ]}>{label}</Text>
           </TouchableOpacity>
         );
      };
    
      return (
        <ScrollView 
          style={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={[styles.headerTitle, isDark && { color: '#FFF' }]}>Progres Anda</Text>
          
          {/* HEATMAP */}
          <View style={[styles.card, isDark && { backgroundColor: '#1C1C1E' }, { paddingBottom: 10 }]}>
            <Text style={[styles.sectionTitle, { marginBottom: 15 }]}>FOKUS HARI INI</Text>
            <MuscleHeatmap trainedMuscles={trainedMuscles} />
            {trainedMuscles.length === 0 && (
              <Text style={{ textAlign: 'center', color: '#8E8E93', fontSize: 12, marginTop: -10 }}>Belum ada otot yang dilatih pada tanggal ini.</Text>
            )}
          </View>
    
          <View style={styles.row}>
            <View style={[styles.card, styles.halfCard, isDark && { backgroundColor: '#1C1C1E' }]}>
              <Text style={styles.cardLabel}>MINGGU INI</Text>
              <Text style={[styles.cardValue, isDark && { color: '#0A84FF' }]}>{stats.weekCount}</Text>
              <Text style={styles.cardSub}>Sesi Selesai</Text>
            </View>
            <View style={[styles.card, styles.halfCard, isDark && { backgroundColor: '#1C1C1E' }]}>
              <Text style={styles.cardLabel}>{stats.currentMonthName.toUpperCase()}</Text>
              <Text style={[styles.cardValue, isDark && { color: '#0A84FF' }]}>{stats.monthCount}</Text>
              <Text style={styles.cardSub}>Total Bulanan</Text>
            </View>
          </View>
    
          <View style={[styles.card, isDark && { backgroundColor: '#1C1C1E' }]}>
            <Text style={[styles.cardTitle, isDark && { color: '#FFF' }]}>PROGRESS LATIHAN</Text>
            <TouchableOpacity style={[styles.pickerBtn, isDark && { backgroundColor: '#2C2C2E' }]} onPress={() => setShowExModal(true)}>
               <Text style={styles.pickerText}>{getSelectedExName()}</Text>
               <Ionicons name="chevron-down" size={16} color="#007AFF" />
            </TouchableOpacity>
            <View style={styles.metricRow}>
               {renderMetricChip('weight', 'Beban')}
               {renderMetricChip('reps', 'Reps')}
               {renderMetricChip('sets', 'Sets')}
            </View>
            {finalChartData && finalChartData.datasets[0].data.length > 0 ? (
               <LineChart
                key={`${chartMetric}-${isDark ? 'dark' : 'light'}-${selectedExId}`}
                data={finalChartData}
                width={screenWidth - 70}
                height={220}
                            chartConfig={{
                              backgroundColor: isDark ? "#1C1C1E" : "#FFF",
                              backgroundGradientFrom: isDark ? "#1C1C1E" : "#FFF",
                              backgroundGradientTo: isDark ? "#1C1C1E" : "#FFF",
                              backgroundGradientFromOpacity: 0,
                              backgroundGradientToOpacity: 0,
                              decimalPlaces: chartMetric === 'weight' ? 1 : 0,
                                                          color: (opacity = 1) => `rgba(10, 132, 255, ${opacity})`,
                                                          labelColor: (opacity = 1) => isDark ? `rgba(255, 255, 255, 1)` : `rgba(0, 0, 0, 1)`,
                                                          style: { borderRadius: 16 },                              propsForDots: { r: "4", strokeWidth: "2", stroke: "#007AFF" }
                            }}            bezier
            style={{ 
              marginVertical: 8, 
              borderRadius: 16,
              overflow: 'hidden' 
            }}
            formatYLabel={(y) => {
               if (parseFloat(y) >= 1000) return (parseFloat(y)/1000).toFixed(1) + 'k';
               return y;
            }}
          />
        ) : (
           <View style={styles.emptyChart}><Text style={[styles.emptyText, isDark && { color: '#8E8E93' }]}>Belum ada data untuk grafik.</Text></View>
        )}
      </View>

      <View style={[styles.card, isDark && { backgroundColor: '#1C1C1E' }]}>
        <View style={styles.cardHeaderRow}>
           <Text style={[styles.cardTitle, isDark && { color: '#FFF' }, {marginBottom: 0}]}>Rekor Pribadi (PR)</Text>
           {prTotalPages > 1 && (
             <View style={styles.miniPagination}>
               <TouchableOpacity disabled={prPage === 1} onPress={() => handlePrPageChange(prPage - 1)}>
                 <Ionicons name="chevron-back" size={18} color={prPage === 1 ? '#CCC' : '#007AFF'} />
               </TouchableOpacity>
               <Text style={[styles.miniPageText, isDark && { color: '#8E8E93' }]}>{prPage} / {prTotalPages}</Text>
               <TouchableOpacity disabled={prPage === prTotalPages} onPress={() => handlePrPageChange(prPage + 1)}>
                 <Ionicons name="chevron-forward" size={18} color={prPage === prTotalPages ? '#CCC' : '#007AFF'} />
               </TouchableOpacity>
             </View>
           )}
        </View>
        {prData.length > 0 ? (
          prData.map((pr, idx) => (
            <View key={idx} style={[styles.prItem, idx === prData.length - 1 && {borderBottomWidth: 0}, isDark && { borderBottomColor: '#333' }]}>
              <Text style={[styles.prName, isDark && { color: '#EEE' }]}>{pr.name}</Text>
              <Text style={styles.prValue}>{pr.max_weight} kg</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, isDark && { color: '#8E8E93' }]}>Belum ada rekor.</Text>
        )}
      </View>

      <Modal visible={showExModal} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalContainer}>
           <View style={styles.modalHeader}>
             <Text style={styles.modalTitle}>Pilih Exercise</Text>
             <TouchableOpacity onPress={() => setShowExModal(false)}>
               <Text style={styles.closeText}>Tutup</Text>
             </TouchableOpacity>
           </View>
           <FlatList
             data={exerciseList}
             keyExtractor={item => item.id.toString()}
             renderItem={({item}) => (
               <TouchableOpacity 
                 style={[styles.libItem, item.id === selectedExId && styles.libItemActive]} 
                 onPress={() => {
                   setSelectedExId(item.id);
                   setShowExModal(false);
                 }}
               >
                 <Text style={[styles.libName, item.id === selectedExId && styles.libNameActive]}>{item.name}</Text>
               </TouchableOpacity>
             )}
           />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', padding: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', marginBottom: 20, color: '#1C1C1E' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  halfCard: { width: '48%', marginBottom: 0 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 15, overflow: 'hidden' },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.5, marginBottom: 5 },
  cardValue: { fontSize: 28, fontWeight: '700', color: '#007AFF' },
  cardSub: { fontSize: 12, color: '#AEAEB2', marginTop: 2 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  miniPagination: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniPageText: { fontSize: 12, color: '#666', fontWeight: '600' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginBottom: 15 },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F2F2F7', padding: 12, borderRadius: 8, marginBottom: 15 },
  pickerText: { fontSize: 16, fontWeight: '600', color: '#007AFF' },
  metricRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, marginTop: 5 },
  metricChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F2F2F7' },
  metricChipActive: { backgroundColor: '#007AFF' },
  metricText: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  metricTextActive: { color: '#FFF' },
  emptyChart: { height: 200, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#999', marginVertical: 20 },
  prItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  prName: { fontSize: 16, fontWeight: '500', color: '#333' },
  prValue: { fontSize: 16, fontWeight: '700', color: '#34C759' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#8E8E93', marginBottom: 10, letterSpacing: 1 },
  modalContainer: { flex: 1, backgroundColor: '#FFF', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  closeText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  libItem: { paddingVertical: 15, borderBottomWidth: 1, borderColor: '#EEE' },
  libItemActive: { backgroundColor: '#F0F7FF' },
  libName: { fontSize: 16, fontWeight: '600', color: '#333' },
  libNameActive: { color: '#007AFF' }
});