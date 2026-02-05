import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  TextInput, 
  useColorScheme, 
  Share 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { 
  getWorkoutHistory, 
  getWorkoutHistoryCount, 
  deleteHistoryByDate, 
  getSessionDetails 
} from '../database/db';

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // State
  const [historyData, setHistoryData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tempRows, setTempRows] = useState('10');
  const [loading, setLoading] = useState(false);

  // Expanded Accordion State
  const [expandedDate, setExpandedDate] = useState(null);
  const [sessionDetails, setSessionDetails] = useState({});

  useFocusEffect(
    useCallback(() => {
      fetchHistory(1);
    }, [])
  );

  const fetchHistory = (page = 1, customLimit = null) => {
    try {
      setLoading(true);
      const effectiveLimit = customLimit || rowsPerPage;

      // 1. Get Total Items
      const total = getWorkoutHistoryCount();
      setTotalItems(total);

      // 2. Calc Total Pages
      const pages = Math.ceil(total / effectiveLimit);
      setTotalPages(pages);

      // 3. Calc Offset
      const targetPage = page > pages && pages > 0 ? pages : page;
      setCurrentPage(targetPage);
      const offset = (targetPage - 1) * effectiveLimit;

      // 4. Fetch Data
      const newData = getWorkoutHistory(effectiveLimit, offset);
      setHistoryData(newData);

    } catch (e) {
      console.error("Error fetching history:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSetRows = () => {
    const num = parseInt(tempRows);
    if (!isNaN(num) && num > 0) {
       setRowsPerPage(num);
       fetchHistory(1, num);
    }
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      fetchHistory(page);
    }
  };

  const handleDeleteHistory = (date) => {
    Alert.alert(
      "Hapus Riwayat",
      "Apakah Anda yakin ingin menghapus catatan latihan pada tanggal ini? Data tidak bisa dikembalikan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus", 
          style: "destructive",
          onPress: () => {
             const success = deleteHistoryByDate(date);
             if (success) {
               fetchHistory(currentPage); 
             } else {
               Alert.alert("Error", "Gagal menghapus riwayat.");
             }
          }
        }
      ]
    );
  };

  const toggleSession = (date) => {
    if (expandedDate === date) {
      setExpandedDate(null);
    } else {
      const rawDetails = getSessionDetails(date);
      const grouped = {};
      rawDetails.forEach(item => {
        if (!grouped[item.name]) grouped[item.name] = [];
        grouped[item.name].push(item);
      });
      setSessionDetails(grouped);
      setExpandedDate(date);
    }
  };

  const copyToClipboard = async (date) => {
    try {
      const rawDetails = getSessionDetails(date);
      const grouped = {};
      rawDetails.forEach(item => {
        if (!grouped[item.name]) grouped[item.name] = [];
        grouped[item.name].push(item);
      });

      const dateStr = new Date(date).toLocaleDateString('id-ID', { weekday: 'long', month: 'short', day: 'numeric' });
      let copyText = `📅 ${dateStr}\n\n`;

      Object.keys(grouped).forEach(exName => {
        const sets = grouped[exName];
        const note = sets[0]?.notes;
        
        copyText += `${exName}\n`;
        if (note) copyText += `📝 ${note}\n`;
        copyText += `${sets[0].reps} x ${sets.length} | ${sets[0].weight} kg\n\n`;
      });

      await Share.share({ message: copyText.trim() });
    } catch (error) {
      Alert.alert("Gagal", "Gagal membagikan.");
    }
  };

  const renderPaginationControls = () => {
    if (totalItems === 0) return null;

    return (
      <View style={styles.paginationHeader}>
        {/* Left: Page Numbers */}
        <View style={styles.pageNavContainer}>
          <TouchableOpacity 
            disabled={currentPage === 1}
            onPress={() => handlePageChange(currentPage - 1)}
            style={[styles.navArrow, currentPage === 1 && styles.navArrowDisabled]}
          >
            <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? "#CCC" : "#007AFF"} />
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{maxHeight: 40}}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
               const isActive = page === currentPage;
               return (
                 <TouchableOpacity 
                   key={page} 
                   style={[styles.pageNumberBtn, isActive && styles.pageNumberBtnActive]} 
                   onPress={() => handlePageChange(page)}
                 >
                   <Text style={[ 
                     styles.pageNumberText, 
                     isActive && styles.pageNumberTextActive,
                     !isActive && isDark && { color: '#FFF' }
                   ]}>{page}</Text>
                 </TouchableOpacity>
               );
            })}
          </ScrollView>

          <TouchableOpacity 
            disabled={currentPage === totalPages}
            onPress={() => handlePageChange(currentPage + 1)}
            style={[styles.navArrow, currentPage === totalPages && styles.navArrowDisabled]}
          >
            <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? "#CCC" : "#007AFF"} />
          </TouchableOpacity>
        </View>

        {/* Right: Rows Per Page */}
        <View style={[styles.rowsBadge, isDark && { borderColor: '#333', backgroundColor: '#1C1C1E' }]}>
           <TextInput 
             style={[styles.rowsInput, isDark && { color: '#FFF' }]} 
             value={tempRows}
             onChangeText={setTempRows}
             keyboardType="numeric"
             onSubmitEditing={handleSetRows}
             returnKeyType="done"
             selectTextOnFocus
           />
           <Text style={styles.rowsLabel}>/ page</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isDark && { color: '#FFF' }]}>Riwayat Latihan</Text>
      </View>

      {/* Pagination Bar */}
      <View style={styles.paginationWrapper}>
        {renderPaginationControls()}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {historyData.map((session, index) => {
          const isExpanded = expandedDate === session.date;
          return (
            <TouchableOpacity 
              key={index} 
              style={[ 
                styles.historyCard, 
                isDark && { backgroundColor: '#1C1C1E' },
                isExpanded && styles.historyCardExpanded,
                isExpanded && isDark && { borderColor: '#0A84FF' }
              ]}
              onPress={() => toggleSession(session.date)}
              activeOpacity={0.7}
            >
              <View style={styles.historyHeader}>
                 <Text style={[styles.historyDate, isDark && { color: '#FFF' }]}>
                   {new Date(session.date).toLocaleDateString('id-ID', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                 </Text>
                 
                 <View style={{flexDirection: 'row', gap: 10}}>
                   <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: isDark ? '#3D1A1A' : '#FFF0F0' }]} 
                      onPress={() => handleDeleteHistory(session.date)}
                   >
                     <Ionicons name="trash-outline" size={18} color="#FF453A" />
                   </TouchableOpacity>

                   <TouchableOpacity 
                      style={[styles.actionBtn, isDark && { backgroundColor: '#1A2B3D' }]} 
                      onPress={() => copyToClipboard(session.date)}
                   >
                     <Ionicons name="copy-outline" size={18} color="#0A84FF" />
                   </TouchableOpacity>
                 </View>
              </View>
              
              {!isExpanded && (
                <Text style={[styles.historyExercises, isDark && { color: '#AAA' }]} numberOfLines={1} ellipsizeMode="tail">
                  {session.exercises || "Tidak ada exercise tercatat"}
                </Text>
              )}

              <Text style={styles.historyVolume}>
                 {session.exerciseCount} Exercises • {session.totalSets} Sets Total
              </Text>

              {/* Detailed Expanded View */}
              {isExpanded && (
                <View style={[styles.detailsContainer, isDark && { borderTopColor: '#333' }]}>
                  {Object.keys(sessionDetails).map((exName, idx) => {
                    const exerciseData = sessionDetails[exName][0];
                    const note = exerciseData?.notes;

                    return (
                      <View key={idx} style={styles.detailRow}>
                        <Text style={[styles.detailExerciseName, isDark && { color: '#FFF' }]}>{exName}</Text>
                        
                        {note ? (
                          <Text style={styles.detailNoteText}>📝 {note}</Text>
                        ) : null} 
                        
                        <View style={[styles.summaryCard, isDark && { backgroundColor: '#2C2C2E', borderColor: '#3A3A3C' }]}>
                          <Text style={[styles.summaryText, isDark && { color: '#FFF' }]}>
                            {exerciseData?.reps} x {exerciseData?.sets}  <Text style={{color:'#666'}}>|</Text>  {exerciseData?.weight} kg
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {(!historyData || historyData.length === 0) && (
          <Text style={[styles.emptyText, isDark && { color: '#8E8E93' }]}>Belum ada riwayat latihan.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1C1C1E' },
  
  paginationWrapper: { paddingHorizontal: 20, marginBottom: 10 },
  paginationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageNavContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  navArrow: { padding: 5 },
  navArrowDisabled: { opacity: 0.3 },
  pageNumberBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginHorizontal: 2 },
  pageNumberBtnActive: { backgroundColor: '#007AFF' },
  pageNumberText: { fontSize: 14, color: '#333', fontWeight: '600' },
  pageNumberTextActive: { color: '#FFF' },
  
  rowsBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FFF' },
  rowsInput: { fontSize: 14, fontWeight: '600', color: '#007AFF', width: 24, textAlign: 'center', marginRight: 2, padding: 0 },
  rowsLabel: { fontSize: 12, color: '#8E8E93' },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 50 },
  
  historyCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 10 },
  historyCardExpanded: { borderColor: '#007AFF', borderWidth: 1, backgroundColor: '#FAFBFF' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  historyDate: { fontWeight: '700', fontSize: 16, color: '#1C1C1E' },
  
  actionBtn: { padding: 6, backgroundColor: '#F0F7FF', borderRadius: 8 },
  
  historyExercises: { color: '#666', fontSize: 14, marginBottom: 8, lineHeight: 20 },
  historyVolume: { color: '#8E8E93', fontSize: 12, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#999', marginVertical: 40 },

  detailsContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  detailRow: { marginBottom: 12 },
  detailExerciseName: { fontWeight: '700', color: '#333', marginBottom: 4, fontSize: 15 },
  detailNoteText: { fontSize: 13, color: '#FF9500', marginBottom: 8, fontStyle: 'italic', paddingLeft: 2 },
  summaryCard: { backgroundColor: '#F8F9FA', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 15, alignSelf: 'flex-start', marginTop: 2 },
  summaryText: { fontSize: 16, fontWeight: '700', color: '#333', letterSpacing: 0.5 },
});
