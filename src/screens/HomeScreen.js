import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  useColorScheme
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getNextWorkout, addMeasurement, getVolumeLast7Days, getBodyStatsHistory, getLastMeasurementDate, getLocalDate, getLatestBodyStats, getWorkoutDates, exportDatabaseToJson, importJsonToDatabase, getMeasurementHistoryGrouped, deleteMeasurementsByDate } from '../database/db';
import db from '../database/db';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useDate } from '../context/DateContext';

// Setup Calendar Locale (Optional, but good for ID)
LocaleConfig.locales['id'] = {
  monthNames: ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],
  monthNamesShort: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
  dayNames: ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
  dayNamesShort: ['Min','Sen','Sel','Rab','Kam','Jum','Sab'],
  today: 'Hari Ini'
};
LocaleConfig.defaultLocale = 'id';

export default function HomeScreen({ navigation }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // GLOBAL DATE CONTEXT
  const { selectedDate, setSelectedDate } = useDate();

  const [nextWorkout, setNextWorkout] = useState(null);
  
  // DATE TRAVEL STATE (Only UI related left here)
  const [markedDates, setMarkedDates] = useState({});
  const [calendarVisible, setCalendarVisible] = useState(false);
  
  // SETTINGS STATE
  const [settingsVisible, setSettingsVisible] = useState(false);

  const [volumeChartData, setVolumeChartData] = useState({
    labels: [],
    datasets: [{ data: [] }]
  });

  const [bodyModalVisible, setBodyModalVisible] = useState(false);
  const [bodyStats, setBodyStats] = useState({ labels: [], datasets: [] });
  const [selectedBodyFilter, setSelectedBodyFilter] = useState('weight'); 
  const [lastDateInfo, setLastDateInfo] = useState(null);
  const [latestStats, setLatestStats] = useState({ weight: null, arm: null, forearm: null, chest: null });
  
  const [manualDate, setManualDate] = useState(getLocalDate()); 
  const [datePickerValue, setDatePickerValue] = useState(new Date()); 
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [inputWeight, setInputWeight] = useState('');
  const [inputArm, setInputArm] = useState('');
  const [inputForearm, setInputForearm] = useState('');
  const [inputChest, setInputChest] = useState('');

  const [chartTooltip, setChartTooltip] = useState({ visible: false, x: 0, y: 0, value: 0, unit: '' });

  // HISTORY STATE
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [measurementHistory, setMeasurementHistory] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      
      const today = new Date();
      setDatePickerValue(today);
      setManualDate(formatDate(today));
      setChartTooltip({ visible: false, x: 0, y: 0, value: 0, unit: '' });
    }, [])
  );

  const formatDate = (date) => {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  };

  const loadData = () => {
    const workout = getNextWorkout();
    setNextWorkout(workout);

    const volData = getVolumeLast7Days();
    if (volData && volData.labels && volData.labels.length > 0) {
      setVolumeChartData({
        labels: volData.labels,
        datasets: [{ data: volData.data }]
      });
    } else {
      setVolumeChartData({
        labels: ["-"], 
        datasets: [{ data: [0] }]
      });
    }

    const statsData = getBodyStatsHistory();
    setBodyStats(statsData);

    const lastDate = getLastMeasurementDate();
    setLastDateInfo(lastDate);

    const latest = getLatestBodyStats();
    setLatestStats(latest);

    const dates = getWorkoutDates();
    const newMarked = {};
    dates.forEach(d => {
      newMarked[d] = { marked: true, dotColor: '#007AFF' };
    });

    const hasHistory = newMarked[selectedDate]?.marked;
    newMarked[selectedDate] = { 
      ...(newMarked[selectedDate] || {}), 
      selected: true, 
      selectedColor: '#007AFF',
      disableTouchEvent: true,
      dotColor: hasHistory ? '#FFF' : undefined,
      marked: hasHistory 
    };

    setMarkedDates(newMarked);
  };

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
    setCalendarVisible(false);
    setMarkedDates(prev => {
       const next = { ...prev };
       return next;
    });
    setTimeout(loadData, 100); 
  };

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || datePickerValue;
    setShowDatePicker(Platform.OS === 'ios'); 
    if (event.type === 'set' || Platform.OS === 'ios') {
        setShowDatePicker(false);
        setDatePickerValue(currentDate);
        setManualDate(formatDate(currentDate));
    } else {
        setShowDatePicker(false);
    }
  };

  const handleSaveBodyStats = () => {
    let savedCount = 0;
    if (inputWeight) { addMeasurement('weight', parseFloat(inputWeight), 'kg', manualDate); savedCount++; }
    if (inputArm) { addMeasurement('arm', parseFloat(inputArm), 'cm', manualDate); savedCount++; }
    if (inputForearm) { addMeasurement('forearm', parseFloat(inputForearm), 'cm', manualDate); savedCount++; }
    if (inputChest) { addMeasurement('chest', parseFloat(inputChest), 'cm', manualDate); savedCount++; }

    if (savedCount > 0) {
      Alert.alert("Berhasil", "Data tubuh tercatat!");
      setInputWeight(''); setInputArm(''); setInputForearm(''); setInputChest('');
      const today = new Date();
      setDatePickerValue(today);
      setManualDate(formatDate(today));
      setBodyModalVisible(false);
      loadData();
    } else {
      Alert.alert("Info", "Tidak ada data yang diisi.");
    }
  };

  // --- HISTORY LOGIC ---
  const openHistoryModal = () => {
    const data = getMeasurementHistoryGrouped();
    setMeasurementHistory(data);
    setHistoryModalVisible(true);
  };

  const handleDeleteMeasurement = (date) => {
    Alert.alert(
      "Hapus Data",
      "Apakah Anda yakin ingin menghapus SEMUA data pengukuran pada tanggal ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus", 
          style: "destructive",
          onPress: () => {
            const success = deleteMeasurementsByDate(date);
            if (success) {
              loadData();
              const updatedData = getMeasurementHistoryGrouped();
              setMeasurementHistory(updatedData);
            } else {
              Alert.alert("Error", "Gagal menghapus data.");
            }
          }
        }
      ]
    );
  };

  const handleBackup = async () => {
    try {
      const json = exportDatabaseToJson();
      if (!json) {
        Alert.alert("Gagal", "Terjadi kesalahan saat mengekspor data.");
        return;
      }
      const filePath = FileSystem.documentDirectory + 'backup_fit_training.json';
      await FileSystem.writeAsStringAsync(filePath, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath);
      } else {
        Alert.alert("Disimpan", `Backup tersimpan di: ${filePath}`);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

        const handleRestore = () => {
          Alert.alert(
            "Restore Data",
            "PERINGATAN: Semua data saat ini akan DITIMPA dengan data dari file backup. Lanjutkan?",
            [
              { text: "Batal", style: "cancel" },
              {
                text: "Lanjut (Timpa Data)", 
                style: "destructive",
                onPress: async () => {
                  try {
                    const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
                    if (!res.canceled && res.assets && res.assets.length > 0) {
                      const fileUri = res.assets[0].uri;
                      const fileContent = await FileSystem.readAsStringAsync(fileUri);
                      const success = await importJsonToDatabase(fileContent);
                      if (success) {
                        Alert.alert("Sukses", "Data berhasil dipulihkan!");
                        setSettingsVisible(false);
                        loadData();
                      }
                    }
                  } catch (error) {
                    Alert.Alert("Gagal Restore", error.message);
                  }
                }
              }
            ]
          );
        };
  
        const handleResetToDefault = () => {        Alert.alert(
          "Reset Database (Kosongkan)?",
          "PERINGATAN KERAS:\n\nIni akan MENGHAPUS SELURUH DATA termasuk:\n- Semua Exercise & Plan\n- Semua Riwayat Latihan (History)\n- Semua Statistik Tubuh\n\nAplikasi akan menjadi KOSONG (0 data).",
          [
            { text: "Batal", style: "cancel" },
            { 
              text: "Ya, HAPUS SEMUA", 
              style: "destructive",
              onPress: () => {
                 try {
                   db.withTransactionSync(() => {
                     db.runSync('DELETE FROM exercises');
                     db.runSync('DELETE FROM workout_plans');
                     db.runSync('DELETE FROM plan_sections');
                     db.runSync('DELETE FROM plan_exercises');
                     db.runSync('DELETE FROM workout_exercises'); 
                     db.runSync('DELETE FROM measurements'); // Hapus Body Stats
                     db.runSync('DELETE FROM history'); // Hapus Riwayat Latihan
                     // Pastikan ID auto-increment di-reset (opsional tapi bersih)
                     db.runSync('DELETE FROM sqlite_sequence WHERE name="exercises"');
                     db.runSync('DELETE FROM sqlite_sequence WHERE name="workout_plans"');
                     db.runSync('DELETE FROM sqlite_sequence WHERE name="history"');
                   });
                   
                   // TIDAK ADA SEEDING LAGI (Biarkan Kosong)
                   // const success = seedFullbodyPlan();
                   
                   Alert.alert("Selesai", "Database telah dikosongkan.");
                   setSettingsVisible(false);
                   loadData();
                 } catch (e) {
                   Alert.alert("Error", e.message);
                 }
              }
            }
          ]
        );
      };  const screenWidth = Dimensions.get("window").width;

  const getFilteredBodyData = () => {
    if (!bodyStats?.labels || bodyStats.labels.length === 0) return null;
    let datasets = [];
    const colors = { weight: '#0A84FF', arm: '#FF3B30', forearm: '#34C759', chest: '#FF9500' };
    const target = bodyStats.datasets.find(ds => ds.type === selectedBodyFilter);
    if (target) {
      datasets = [{
        data: target.data,
        type: target.type,
        color: (opacity = 1) => colors[target.type],
        strokeWidth: 2
      }];
    }
    return { labels: bodyStats.labels, datasets };
  };

  const bodyChartData = getFilteredBodyData();

  const renderStatCard = (title, data, unit, icon, color) => {
    const hasData = data && data.value != null;
    return (
      <View style={styles.statGridItem}>
        <View style={[styles.statIconBox, { backgroundColor: color + '20' }]}>
           <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.statGridTitle}>{title}</Text>
        <Text style={styles.statGridValue}>
          {hasData ? data.value : '-'} <Text style={styles.statGridUnit}>{unit}</Text>
        </Text>
        <Text style={styles.statGridDate}>
          {hasData ? new Date(data.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : 'Belum ada'}
        </Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 50}}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
           <View>
              <Text style={styles.greeting}>Selamat Datang!</Text>
              <TouchableOpacity onPress={() => setCalendarVisible(true)} style={styles.dateSelector}>
                 <Text style={styles.date}>
                   {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                 </Text>
                 <Ionicons name="chevron-down" size={16} color="#666" style={{marginLeft: 5, marginTop: 4}} />
              </TouchableOpacity>
           </View>
           
           <TouchableOpacity 
             style={[styles.settingsBtn, isDark && { backgroundColor: '#2C2C2E' }]} 
             onPress={() => setSettingsVisible(true)}
           >
              <Ionicons name="settings-outline" size={24} color={isDark ? "#FFF" : "#333"} />
           </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardContainer}>
        <Text style={[styles.sectionTitle, isDark && { color: '#8E8E93' }]}>MULAI WORKOUT SEKARANG!</Text>
        <View style={[styles.card, isDark && { backgroundColor: '#1C1C1E' }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.workoutName, isDark && { color: '#FFF' }]}>Latihan Harian</Text>
              {selectedDate !== getLocalDate() && (
                 <Text style={styles.dateWarning}>Mode Tanggal: {selectedDate}</Text>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.startButton}
              onPress={() => navigation.navigate('ActiveWorkout', { workoutId: nextWorkout?.id, date: selectedDate })}
            >
              <Text style={styles.startButtonText}>MULAI WORKOUT</Text>
            </TouchableOpacity>
        </View>
      </View>

      <View style={styles.actionContainer}>
        <Text style={[styles.sectionTitle, isDark && { color: '#8E8E93' }]}>PERFORMA (VOLUME)</Text>
        <View style={[styles.chartCard, isDark && { backgroundColor: '#1C1C1E' }]}> 
          {volumeChartData?.labels?.length > 0 ? (
            <LineChart
              data={volumeChartData}
              width={screenWidth - 40}
              height={220}
              chartConfig={{
                backgroundColor: isDark ? "#1C1C1E" : "#FFF",
                backgroundGradientFrom: isDark ? "#1C1C1E" : "#FFF",
                backgroundGradientTo: isDark ? "#1C1C1E" : "#FFF",
                backgroundGradientFromOpacity: isDark ? 1 : 0,
                backgroundGradientToOpacity: isDark ? 1 : 0,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(10, 132, 255, ${opacity})`,
                labelColor: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: { r: "5", strokeWidth: "2", stroke: "#0A84FF" }
              }}
              bezier
              style={{ marginVertical: 8, borderRadius: 16, overflow: 'hidden' }}
              formatYLabel={(y) => (parseFloat(y) >= 1000 ? (parseFloat(y)/1000).toFixed(1)+'k' : y)}
            />
          ) : (
            <View style={styles.emptyChart}><Text style={{color: '#8E8E93'}}>Belum ada data latihan.</Text></View>
          )}
        </View>
      </View>

      <View style={styles.actionContainer}>
        <View style={styles.sectionHeaderRow}>
           <Text style={[styles.sectionTitle, isDark && { color: '#8E8E93' }]}>STATISTIK TUBUH</Text>
           <TouchableOpacity onPress={() => setBodyModalVisible(true)}>
             <Text style={styles.actionLink}>+ Catat Ukuran</Text>
           </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
           {renderStatCard("Berat Badan", latestStats.weight, "kg", "scale", "#007AFF")}
           {renderStatCard("Lingkar Dada", latestStats.chest, "cm", "body", "#FF9500")}
           {renderStatCard("Lengan", latestStats.arm, "cm", "barbell", "#FF3B30")}
           {renderStatCard("Lengan Bawah", latestStats.forearm, "cm", "hammer", "#34C759")}
        </View>

        <View style={styles.filterRow}>
           <ScrollView horizontal showsHorizontalScrollIndicator={false}>
             {['weight', 'arm', 'forearm', 'chest'].map(f => (
               <TouchableOpacity 
                 key={f} 
                 style={[
                   styles.filterChip, 
                   isDark && { backgroundColor: '#3A3A3C' },
                   selectedBodyFilter === f && styles.filterChipActive
                 ]}
                 onPress={() => setSelectedBodyFilter(f)}
               >
                 <Text style={[styles.filterText, selectedBodyFilter === f && styles.filterTextActive]}>
                   {f === 'weight' ? 'BB' : f === 'arm' ? 'Lengan' : f === 'forearm' ? 'L.Bawah' : 'Dada'}
                 </Text>
               </TouchableOpacity>
             ))}
           </ScrollView>
        </View>

        <View style={[styles.chartCard, isDark && { backgroundColor: '#1C1C1E' }]}> 
          {bodyChartData && bodyChartData.datasets.length > 0 ? (
            <LineChart
              data={bodyChartData}
              width={screenWidth - 40}
              height={220}
              chartConfig={{
                backgroundColor: isDark ? "#1C1C1E" : "#FFF",
                backgroundGradientFrom: isDark ? "#1C1C1E" : "#FFF",
                backgroundGradientTo: isDark ? "#1C1C1E" : "#FFF",
                backgroundGradientFromOpacity: isDark ? 1 : 0,
                backgroundGradientToOpacity: isDark ? 1 : 0,
                decimalPlaces: 1,
                color: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
                style: { borderRadius: 16 }
              }}
              bezier
              style={{ marginVertical: 8, borderRadius: 16, overflow: 'hidden' }}
            />
          ) : (
            <View style={styles.emptyChart}><Text style={{color: '#8E8E93'}}>Belum ada data pengukuran.</Text></View>
          )}
        </View>

        <TouchableOpacity 
          style={[styles.historyBtnOutline, isDark && { borderColor: '#3A3A3C' }]} 
          onPress={openHistoryModal}
        >
           <Ionicons name="list-outline" size={18} color="#007AFF" />
           <Text style={styles.historyBtnText}>Lihat Riwayat Pengukuran</Text>
        </TouchableOpacity>
      </View>

      <Modal animationType="slide" transparent={true} visible={bodyModalVisible} onRequestClose={() => setBodyModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDark && { backgroundColor: '#1C1C1E' }]}>
            <View style={styles.modalHeaderRow}>
               <Text style={[styles.modalTitle, isDark && { color: '#FFF' }]}>Catat Ukuran</Text>
               <TouchableOpacity onPress={() => setBodyModalVisible(false)} style={styles.closeIconBtn}>
                 <Ionicons name="close-outline" size={24} color={isDark ? "#AAA" : "#666"} />
               </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TANGGAL</Text>
              <TouchableOpacity style={[styles.datePickerBtn, isDark && { backgroundColor: '#2C2C2E', borderColor: '#3A3A3C' }]} onPress={() => setShowDatePicker(true)}>
                 <Text style={[styles.datePickerText, isDark && { color: '#FFF' }]}>{manualDate}</Text>
                 <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker value={datePickerValue} mode="date" display="default" onChange={handleDateChange} maximumDate={new Date()} />
              )}
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>BERAT BADAN (KG)</Text>
              <TextInput 
                style={[styles.input, isDark && { backgroundColor: '#2C2C2E', color: '#FFF', borderColor: '#3A3A3C' }]} 
                keyboardType="numeric" 
                placeholder="0" 
                placeholderTextColor="#666"
                value={inputWeight} 
                onChangeText={setInputWeight} 
              />
            </View>

            <View style={styles.rowInputs}>
               <View style={styles.halfInput}>
                 <Text style={styles.inputLabel}>LENGAN (CM)</Text>
                 <TextInput 
                  style={[styles.input, isDark && { backgroundColor: '#2C2C2E', color: '#FFF', borderColor: '#3A3A3C' }]} 
                  keyboardType="numeric" 
                  placeholder="0" 
                  placeholderTextColor="#666"
                  value={inputArm} 
                  onChangeText={setInputArm} 
                 />
               </View>
               <View style={styles.halfInput}>
                 <Text style={styles.inputLabel}>L. BAWAH (CM)</Text>
                 <TextInput 
                  style={[styles.input, isDark && { backgroundColor: '#2C2C2E', color: '#FFF', borderColor: '#3A3A3C' }]} 
                  keyboardType="numeric" 
                  placeholder="0" 
                  placeholderTextColor="#666"
                  value={inputForearm} 
                  onChangeText={setInputForearm} 
                 />
               </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DADA (CM)</Text>
              <TextInput 
                style={[styles.input, isDark && { backgroundColor: '#2C2C2E', color: '#FFF', borderColor: '#3A3A3C' }]} 
                keyboardType="numeric" 
                placeholder="0" 
                placeholderTextColor="#666"
                value={inputChest} 
                onChangeText={setInputChest} 
              />
            </View>

            <TouchableOpacity style={[styles.saveBtn, { marginTop: 10 }]} onPress={handleSaveBodyStats}>
              <Text style={styles.saveText}>Simpan Pengukuran</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={historyModalVisible} onRequestClose={() => setHistoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {maxHeight: '80%'}]}>
            <View style={styles.modalHeaderRow}>
               <Text style={styles.modalTitle}>Riwayat Pengukuran</Text>
               <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.closeIconBtn}>
                 <Ionicons name="close-outline" size={24} color="#666" />
               </TouchableOpacity>
            </View>
            
            {measurementHistory.length > 0 ? (
              <FlatList
                data={measurementHistory}
                keyExtractor={item => item.date}
                renderItem={({item}) => (
                  <View style={styles.historyItem}>
                    <View style={{flex: 1}}>
                      <Text style={styles.historyDateText}>{new Date(item.date).toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'})}</Text>
                      <View style={styles.historyGrid}>
                         <Text style={styles.historySubText}>BB: <Text style={styles.bold}>{item.data.weight}</Text></Text>
                         <Text style={styles.historySubText}>Lengan: <Text style={styles.bold}>{item.data.arm}</Text></Text>
                         <Text style={styles.historySubText}>L.Bawah: <Text style={styles.bold}>{item.data.forearm}</Text></Text>
                         <Text style={styles.historySubText}>Dada: <Text style={styles.bold}>{item.data.chest}</Text></Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteMeasurement(item.date)} style={styles.deleteIconBtn}>
                      <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            ) : (
              <Text style={{textAlign: 'center', color: '#999', marginVertical: 20}}>Belum ada data.</Text>
            )}
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={settingsVisible} onRequestClose={() => setSettingsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
               <Text style={styles.modalTitle}>Pengaturan Data</Text>
               <TouchableOpacity onPress={() => setSettingsVisible(false)} style={styles.closeIconBtn}>
                 <Ionicons name="close-outline" size={24} color="#666" />
               </TouchableOpacity>
            </View>
            <Text style={{textAlign: 'center', marginBottom: 20, color: '#666'}}>Amankan data latihan Anda atau pulihkan dari file backup.</Text>
            
            <TouchableOpacity style={[styles.settingsOption, {backgroundColor: '#E8F5E9'}]} onPress={handleBackup}>
               <Ionicons name="cloud-upload-outline" size={24} color="#2E7D32" />
               <View style={{marginLeft: 15}}>
                 <Text style={[styles.settingsOptionTitle, {color: '#2E7D32'}]}>Backup Data</Text>
                 <Text style={styles.settingsOptionSub}>Simpan database ke file JSON</Text>
               </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.settingsOption, {backgroundColor: '#FFEBEE'}]} onPress={handleRestore}>
               <Ionicons name="refresh-circle-outline" size={24} color="#C62828" />
               <View style={{marginLeft: 15}}>
                 <Text style={[styles.settingsOptionTitle, {color: '#C62828'}]}>Restore Data</Text>
                 <Text style={styles.settingsOptionSub}>Timpa data saat ini dari backup</Text>
               </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.settingsOption, {backgroundColor: '#FFF8E1'}]} onPress={handleResetToDefault}>
               <Ionicons name="trash-bin-outline" size={24} color="#F57C00" />
               <View style={{marginLeft: 15}}>
                 <Text style={[styles.settingsOptionTitle, {color: '#F57C00'}]}>Reset Database (Kosongkan)</Text>
                 <Text style={styles.settingsOptionSub}>Hapus semua data & mulai dari 0</Text>
               </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={calendarVisible} onRequestClose={() => setCalendarVisible(false)}>
        <View style={styles.modalOverlay}>
           <View style={styles.calendarModalContent}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Pilih Tanggal Latihan</Text>
                <TouchableOpacity onPress={() => setCalendarVisible(false)} style={styles.closeIconBtn}>
                   <Ionicons name="close-outline" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <Calendar
                current={selectedDate}
                maxDate={getLocalDate()}
                onDayPress={handleDayPress}
                markedDates={markedDates}
                theme={{
                   selectedDayBackgroundColor: '#007AFF',
                   todayTextColor: '#007AFF',
                   arrowColor: '#007AFF',
                }}
              />

              {selectedDate !== getLocalDate() && (
                <TouchableOpacity 
                  style={styles.todayResetBtn} 
                  onPress={() => {
                    const today = getLocalDate();
                    setSelectedDate(today);
                    setDatePickerValue(new Date());
                    setCalendarVisible(false);
                    setTimeout(loadData, 100);
                  }}
                >
                  <Ionicons name="refresh-circle" size={20} color="#007AFF" />
                  <Text style={styles.todayResetText}>Kembali ke Hari Ini</Text>
                </TouchableOpacity>
              )}
           </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', padding: 20 },
  header: { marginBottom: 30, marginTop: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  
  greeting: { fontSize: 28, fontWeight: '800', color: '#1A1A1A' },
  
  dateSelector: { flexDirection: 'row', alignItems: 'center' },
  date: { fontSize: 16, color: '#007AFF', marginTop: 4, fontWeight: '600' },
  dateWarning: { fontSize: 12, color: '#FF3B30', marginTop: 5, fontWeight: '600' },
  
  settingsBtn: {
    padding: 10,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },

  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10
  },
  settingsOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  settingsOptionSub: {
    fontSize: 12,
    color: '#666'
  },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 10, letterSpacing: 1 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  actionLink: { color: '#007AFF', fontWeight: '700', fontSize: 14 },
  cardContainer: { marginBottom: 30 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  cardHeader: { marginBottom: 20 },
  workoutName: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  startButton: { backgroundColor: '#2196F3', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  startButtonText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  actionContainer: { marginBottom: 30 },
  chartCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 10, alignItems: 'center', marginBottom: 10 },
  emptyChart: { height: 200, justifyContent: 'center', alignItems: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  statGridItem: { width: '48%', backgroundColor: '#FFF', borderRadius: 16, padding: 15, marginBottom: 15 },
  statIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statGridTitle: { fontSize: 12, fontWeight: '600', color: '#8E8E93', marginBottom: 4 },
  statGridValue: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  statGridUnit: { fontSize: 14, color: '#AEAEB2' },
  statGridDate: { fontSize: 10, color: '#C7C7CC' },
  filterRow: { flexDirection: 'row', marginBottom: 10 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#E5E5EA', marginRight: 8 },
  filterChipActive: { backgroundColor: '#007AFF' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#555' },
  filterTextActive: { color: '#FFF' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', width: '85%', padding: 25, borderRadius: 20 },
  calendarModalContent: { backgroundColor: '#FFF', width: '90%', padding: 20, borderRadius: 20 },

  todayResetBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    marginTop: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 12
  },
  todayResetText: { 
    color: '#007AFF', 
    fontWeight: '700', 
    marginLeft: 8,
    fontSize: 14
  },
  historyBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    width: '100%',
    zIndex: 10
  },
  historyBtnText: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8
  },
  
  // History Styles
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  historyDateText: { color: '#1C1C1E', fontSize: 14, fontWeight: '700', marginBottom: 5 },
  historyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  historySubText: { fontSize: 12, color: '#666', width: '45%' },
  bold: { fontWeight: '700', color: '#333' },
  deleteIconBtn: { padding: 10, backgroundColor: '#FFF5F5', borderRadius: 8 },

  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', flex: 1 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  closeIconBtn: { padding: 5, marginTop: -20 },
  inputGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: '#FAFAFA' },
  datePickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 12 },
  datePickerText: { fontSize: 16, color: '#333' },
  rowInputs: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  halfInput: { flex: 1 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalBtn: { padding: 12, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F5F5F5' },
  saveBtn: { backgroundColor: '#2196F3', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  cancelText: { color: '#666', fontWeight: '600' },
  saveText: { color: '#FFF', fontWeight: '600' }
});
