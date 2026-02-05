import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Modal, 
  TextInput,
  Alert,
  useColorScheme,
  Platform,
  ScrollView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAllExercises, addExercise, deleteExercise } from '../database/db';

export default function ExerciseLibraryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [exercises, setExercises] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState('Chest');
  const [newNotes, setNewNotes] = useState('');

  // Custom Picker State
  const [muscleModalVisible, setMuscleModalVisible] = useState(false);
  const muscleGroups = ['Chest', 'Core', 'Arm', 'Back', 'Leg', 'Shoulders'];

  useFocusEffect(
    useCallback(() => {
      loadExercises();
    }, [])
  );

  const loadExercises = () => {
    const data = getAllExercises();
    setExercises(data);
  };

  const handleAdd = () => {
    if (!newName) {
      Alert.alert("Validasi", "Nama exercise wajib diisi.");
      return;
    }
    const success = addExercise(newName, newMuscle, newNotes, null, null);
    if (success) {
      setModalVisible(false);
      setNewName('');
      setNewMuscle('Chest');
      setNewNotes('');
      loadExercises();
    } else {
      Alert.alert("Gagal", "Tidak bisa menambah exercise.");
    }
  };

  const handleDelete = (id, name) => {
    Alert.alert(
      "Hapus Exercise",
      `Yakin ingin menghapus "${name}"?`,
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Hapus", 
          style: "destructive", 
          onPress: () => {
            deleteExercise(id);
            loadExercises();
          } 
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={[styles.card, isDark && { backgroundColor: '#1C1C1E' }]}>
      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          <Text style={[styles.name, isDark && { color: '#FFF' }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
        </View>
        
        <View style={styles.row}>
          <View style={[styles.badge, isDark && { backgroundColor: '#2C2C2E' }]}>
            <Text style={[styles.badgeText, isDark && { color: '#0A84FF' }]}>{item.muscle_group || 'General'}</Text>
          </View>
        </View>
        {item.notes ? (
          <Text style={[styles.notes, isDark && { color: '#AAA' }]} numberOfLines={1} ellipsizeMode="tail">"{item.notes}"</Text>
        ) : null}
      </View>
      
      <TouchableOpacity 
        onPress={() => handleDelete(item.id, item.name)} 
        style={[styles.deleteBtn, { backgroundColor: isDark ? '#3D1A1A' : '#FFF0F0' }]}
      >
        <Ionicons name="trash-outline" size={20} color="#FF453A" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#F8F9FA' }]}>
      <FlatList
        data={exercises}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={[styles.empty, isDark && { color: '#8E8E93' }]}>Tidak ada exercise. Tambahkan baru!</Text>}
      />

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Main Add Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDark && { backgroundColor: '#1C1C1E' }]}>
            <View style={styles.modalHeaderRow}>
               <Text style={[styles.modalTitle, isDark && { color: '#FFF' }]}>Exercise Baru</Text>
               <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeIconBtn}>
                 <Ionicons name="close-outline" size={24} color={isDark ? "#AAA" : "#666"} />
               </TouchableOpacity>
            </View>
            
            <TextInput
              style={[styles.input, isDark && { backgroundColor: '#2C2C2E', color: '#FFF', borderColor: '#3A3A3C' }]}
              placeholder="Nama (Contoh: Squat)"
              placeholderTextColor="#888"
              value={newName}
              onChangeText={setNewName}
            />

            {/* Custom Muscle Picker Trigger */}
            <TouchableOpacity 
              style={[styles.pickerTrigger, isDark && { backgroundColor: '#2C2C2E', borderColor: '#3A3A3C' }]} 
              onPress={() => setMuscleModalVisible(true)}
            >
              <Text style={[styles.pickerValueText, isDark && { color: '#FFF' }]}>{newMuscle}</Text>
              <Ionicons name="chevron-down" size={20} color={isDark ? "#0A84FF" : "#007AFF"} />
            </TouchableOpacity>
            
            <TextInput
              style={[styles.input, isDark && { backgroundColor: '#2C2C2E', color: '#FFF', borderColor: '#3A3A3C' }]}
              placeholder="Catatan Default (Opsional)"
              placeholderTextColor="#888"
              value={newNotes}
              onChangeText={setNewNotes}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={handleAdd} style={[styles.saveBtn, { width: '100%', alignItems: 'center' }]}>
                <Text style={styles.btnTextWhite}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Muscle Selection Modal (The "Real" Picker) */}
      <Modal
        visible={muscleModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMuscleModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.pickerOverlay} 
          activeOpacity={1} 
          onPress={() => setMuscleModalVisible(false)}
        >
          <View style={[styles.pickerContent, isDark && { backgroundColor: '#2C2C2E' }]}>
            <Text style={[styles.pickerTitle, isDark && { color: '#FFF' }]}>Pilih Kelompok Otot</Text>
            {muscleGroups.map((muscle) => (
              <TouchableOpacity 
                key={muscle} 
                style={styles.pickerItem}
                onPress={() => {
                  setNewMuscle(muscle);
                  setMuscleModalVisible(false);
                }}
              >
                <Text style={[styles.pickerItemText, isDark && { color: '#EEE' }, newMuscle === muscle && { color: '#0A84FF', fontWeight: 'bold' }]}>
                  {muscle}
                </Text>
                {newMuscle === muscle && <Ionicons name="checkmark" size={20} color="#0A84FF" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  list: { padding: 20, paddingBottom: 100 },
  empty: { textAlign: 'center', marginTop: 50, color: '#888' },
  
  card: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cardContent: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginRight: 10 },
  name: { fontSize: 18, fontWeight: '600', color: '#333' },
  
  row: { flexDirection: 'row', marginTop: 5 },
  badge: { backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 12, color: '#1976D2', fontWeight: '500' },
  notes: { fontSize: 12, color: '#666', marginTop: 5, fontStyle: 'italic' },
  
  deleteBtn: { 
    padding: 8, 
    borderRadius: 8,
    marginLeft: 10
  },

  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#2196F3',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fabText: { color: '#FFF', fontSize: 30, fontWeight: 'bold', marginTop: -2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', width: '85%', padding: 25, borderRadius: 15 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', flex: 1 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  closeIconBtn: { padding: 5, marginRight: -10 },
  input: { borderWidth: 1, borderColor: '#DDD', padding: 12, borderRadius: 8, marginBottom: 15, fontSize: 16 },
  
  // Custom Picker Styles
  pickerTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#FAFAFA'
  },
  pickerValueText: { fontSize: 16, color: '#333' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerContent: { backgroundColor: '#FFF', width: '80%', borderRadius: 12, padding: 20 },
  pickerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 15, textAlign: 'center' },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#EEE' },
  pickerItemText: { fontSize: 16, color: '#333' },

  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15, marginTop: 10 },
  saveBtn: { backgroundColor: '#2196F3', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  btnTextWhite: { color: '#FFF', fontWeight: '600' }
});
