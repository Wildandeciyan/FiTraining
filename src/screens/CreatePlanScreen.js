import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ScrollView, Modal, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAllExercises, createWorkoutPlan, addSectionToPlan, addExerciseToSection, getPlanDetails, deleteWorkoutPlan } from '../database/db';

export default function CreatePlanScreen({ route, navigation }) {
  const { planId, planName: initialName } = route.params || {};
  const isEditMode = !!planId;

  const [planName, setPlanName] = useState(initialName || '');
  const [sections, setSections] = useState([{ id: Date.now(), title: '', exercises: [] }]); 
  
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [libraryExercises, setLibraryExercises] = useState([]);

  useEffect(() => {
    if (isEditMode) {
      loadPlanData();
    }
  }, []);

  const loadPlanData = () => {
    const details = getPlanDetails(planId);
    if (details && details.length > 0) {
      // Map DB structure to State structure
      const formattedSections = details.map(sec => ({
        id: sec.id, // Keep ID, though we might recreate
        title: sec.title,
        exercises: sec.data.map(ex => ({ ...ex, id: ex.id })) // Ensure ex has id
      }));
      setSections(formattedSections);
    }
  };

  const loadLibrary = () => {
    const data = getAllExercises();
    setLibraryExercises(data);
  };

  const handleAddSection = () => {
    setSections([...sections, { id: Date.now(), title: '', exercises: [] }]);
  };

  const handleDeleteSection = (id) => {
    Alert.alert("Hapus Bagian", "Hapus bagian ini beserta isinya?", [
      { text: "Batal" },
      { text: "Hapus", style: 'destructive', onPress: () => {
          setSections(prev => prev.filter(s => s.id !== id));
      }}
    ]);
  };

  const handleRemoveExercise = (sectionId, exerciseIndex) => {
    setSections(prev => prev.map(sec => {
      if (sec.id === sectionId) {
        const newEx = [...sec.exercises];
        newEx.splice(exerciseIndex, 1);
        return { ...sec, exercises: newEx };
      }
      return sec;
    }));
  };

  const handleOpenExerciseSelector = (sectionId) => {
    setActiveSectionId(sectionId);
    loadLibrary();
    setShowExerciseModal(true);
  };

  const handleSelectExercise = (exercise) => {
    setSections(prev => prev.map(sec => {
      if (sec.id === activeSectionId) {
        return { ...sec, exercises: [...sec.exercises, exercise] };
      }
      return sec;
    }));
    setShowExerciseModal(false);
  };

  const updateSectionTitle = (id, text) => {
    setSections(prev => prev.map(sec => sec.id === id ? { ...sec, title: text } : sec));
  };

  const handleSavePlan = () => {
    if (!planName.trim()) {
      Alert.alert("Validasi", "Mohon isi nama plan.");
      return;
    }
    if (sections.length === 0) {
      Alert.alert("Validasi", "Tambahkan minimal satu bagian.");
      return;
    }

    // UPDATE STRATEGY: Delete Old -> Create New
    // This is cleaner than handling complex diffs for Sections/Exercises
    if (isEditMode) {
      deleteWorkoutPlan(planId);
    }

    // 1. Create Plan
    const newPlanId = createWorkoutPlan(planName);
    if (!newPlanId) return;

    // 2. Loop Sections
    sections.forEach((sec, sIndex) => {
      const title = sec.title || `Bagian ${sIndex + 1}`;
      const sectionId = addSectionToPlan(newPlanId, title, sIndex);

      // 3. Loop Exercises
      if (sectionId) {
        sec.exercises.forEach((ex, eIndex) => {
          addExerciseToSection(sectionId, ex.id, eIndex);
        });
      }
    });

    Alert.alert("Berhasil", isEditMode ? "Plan Diperbarui!" : "Plan Dibuat!");
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeText}>Batal</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditMode ? 'Ubah Plan' : 'Workout Plan Baru'}</Text>
        <TouchableOpacity onPress={handleSavePlan}>
          <Text style={styles.saveText}>Simpan</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.label}>NAMA PLAN</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Contoh: Push Day A" 
          value={planName}
          onChangeText={setPlanName}
        />

        <Text style={[styles.label, { marginTop: 20 }]}>BAGIAN</Text>
        
        {sections.map((section, index) => (
          <View key={section.id} style={styles.sectionCard}>
            
            {/* Section Header Row */}
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderColor: '#EEE', paddingBottom: 5}}>
              <TextInput
                style={styles.sectionTitleInput}
                placeholder={`Judul Bagian (Contoh: ${index === 0 ? 'Pemanasan' : 'Latihan Utama'})`}
                value={section.title}
                onChangeText={(text) => updateSectionTitle(section.id, text)}
              />
              <TouchableOpacity onPress={() => handleDeleteSection(section.id)} style={{padding: 5}}>
                 <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
            
            {section.exercises.map((ex, i) => (
              <View key={i} style={styles.exerciseRow}>
                 <View style={{flex: 1}}>
                   <Text style={styles.exerciseText}>{ex.name}</Text>
                   <Text style={styles.exerciseSub}>{ex.muscle_group}</Text>
                 </View>
                 <TouchableOpacity onPress={() => handleRemoveExercise(section.id, i)} style={{padding: 5}}>
                    <Ionicons name="close-circle" size={20} color="#CCC" />
                 </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity 
              style={styles.addExBtn} 
              onPress={() => handleOpenExerciseSelector(section.id)}
            >
              <Text style={styles.addExText}>+ Tambah Exercise</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addSecBtn} onPress={handleAddSection}>
           <Text style={styles.addSecText}>+ Tambah Bagian Baru</Text>
        </TouchableOpacity>
        
        <View style={{height: 100}} /> 
      </ScrollView>

      {/* Exercise Selector Modal */}
      <Modal visible={showExerciseModal} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalContainer}>
           <View style={styles.modalHeader}>
             <Text style={styles.modalTitle}>Pilih Exercise</Text>
             <TouchableOpacity onPress={() => setShowExerciseModal(false)}>
               <Text style={styles.closeText}>Tutup</Text>
             </TouchableOpacity>
           </View>
           <FlatList
             data={libraryExercises}
             keyExtractor={item => item.id.toString()}
             renderItem={({item}) => (
               <TouchableOpacity style={styles.libItem} onPress={() => handleSelectExercise(item)}>
                 <Text style={styles.libName}>{item.name}</Text>
                 <Text style={styles.libSub}>{item.muscle_group}</Text>
               </TouchableOpacity>
             )}
           />
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, paddingTop: 50, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderColor: '#DDD' },
  title: { fontSize: 18, fontWeight: '700' },
  closeText: { color: '#FF3B30', fontSize: 16 },
  saveText: { color: '#007AFF', fontSize: 16, fontWeight: '700' },

  content: { padding: 20 },
  label: { fontSize: 12, color: '#888', fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, fontSize: 16 },

  sectionCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 15 },
  sectionTitleInput: { flex: 1, fontSize: 18, fontWeight: '700' },
  
  exerciseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F5F5F5' },
  exerciseText: { fontSize: 16, fontWeight: '500' },
  exerciseSub: { fontSize: 12, color: '#888' },

  addExBtn: { marginTop: 15, alignSelf: 'center' },
  addExText: { color: '#007AFF', fontWeight: '600' },

  addSecBtn: { padding: 15, alignItems: 'center', backgroundColor: '#E3F2FD', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#2196F3' },
  addSecText: { color: '#2196F3', fontWeight: '700' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#FFF', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  libItem: { paddingVertical: 15, borderBottomWidth: 1, borderColor: '#EEE' },
  libName: { fontSize: 16, fontWeight: '600' },
  libSub: { color: '#888' }
});