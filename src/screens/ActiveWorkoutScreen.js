import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  SectionList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { 
  getLastSessionStats, 
  getAllExercises, 
  updateExerciseNotes, 
  getWorkoutPlans, 
  getPlanDetails,
  deleteWorkoutPlan,
  getTodayLogs,
  updateExerciseDefaults,
  saveExerciseSession,
  ensureWorkoutSession,
  getWorkoutSessionDetails,
  getLocalDate 
} from '../database/db';

export default function ActiveWorkoutScreen({ route, navigation }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const workoutId = route.params?.workoutId;
  const targetDate = route.params?.date || getLocalDate();
  const isTimeTravel = targetDate !== getLocalDate();
  
  // Plans & Exercises
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [exercisesData, setExercisesData] = useState([]);

  // Focus Mode (Modal)
  const [activeExercise, setActiveExercise] = useState(null); 
  const [notes, setNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Timer
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [totalRestForExercise, setTotalRestForExercise] = useState(0);

  // --- LOGIC FUNCTIONS ---

  const loadContent = () => {
    setLoading(true);
    // PASS TARGET DATE to fetch logs for that specific day
    const todayLogs = getTodayLogs(targetDate);
    
    const enrichData = (ex) => {
      const log = todayLogs[ex.id];
      const defSets = ex.default_sets ? ex.default_sets.toString() : '1';
      const defReps = ex.default_reps ? ex.default_reps.toString() : '';
      
      // Fetch Ghost Set (History)
      const lastStats = getLastSessionStats(ex.id);
      const ghostWeight = lastStats && lastStats.weight != null ? lastStats.weight.toString() : '';
      const ghostReps = lastStats && lastStats.reps != null ? lastStats.reps.toString() : defReps;
      const ghostSets = lastStats && lastStats.sets != null ? lastStats.sets.toString() : defSets;
      const ghostNotes = lastStats && lastStats.notes ? lastStats.notes : ex.notes;

      if (log) {
        // INTELLIGENT FILL: Use Log if present/modified, else use Ghost Set
        const displayWeight = (log.lastWeight > 0) ? log.lastWeight.toString() : ghostWeight;
        const displayReps = (log.lastReps > 0) ? log.lastReps.toString() : ghostReps;
        const displaySets = (log.setsLogged > 0) ? log.setsLogged.toString() : ghostSets;

        return {
          ...ex,
          setsLogged: log.setsLogged, 
          isCompleted: log.isCompleted,
          restCount: 0, 
          notes: log.notes || ghostNotes, // Prefer Session Note -> History Note -> Default Note
          draft: {
            weight: displayWeight,
            reps: displayReps,
            sets: displaySets
          },
          workout_exercise_id: log.workout_exercise_id
        };
      }
      return { 
        ...ex, 
        setsLogged: 0, 
        restCount: 0,
        isCompleted: false,
        workout_exercise_id: null,
        notes: ghostNotes, // Pre-fill with history note
        // Even for new items, pre-fill draft with Ghost Set
        draft: {
             weight: ghostWeight,
             reps: ghostReps,
             sets: ghostSets
        }
      };
    };      
    
    if (selectedPlanId === null) {
      // ALL EXERCISES MODE
      const data = getAllExercises();
      const flatData = data.map(enrichData);
      setExercisesData(flatData);
    } else {
      // PLAN MODE
      const planDetails = getPlanDetails(selectedPlanId);
      
      if (!planDetails || !Array.isArray(planDetails)) {
        setExercisesData([]);
      } else {
        const processedSections = planDetails.map(sec => {
          const rawData = Array.isArray(sec.data) ? sec.data : [];
          return {
            ...sec,
            data: rawData.map(enrichData)
          };
        });
        setExercisesData(processedSections);
      }
    }
    setLoading(false);
  };

  const getSelectedPlanName = () => {
    const plan = plans.find(p => p.id === selectedPlanId);
    return plan ? plan.name : '';
  };

  const handleDeletePlan = () => {
    Alert.alert(
      "Hapus Plan",
      `Hapus "${getSelectedPlanName()}"?`,
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Hapus", 
          style: "destructive",
          onPress: () => {
            deleteWorkoutPlan(selectedPlanId);
            setExercisesData([]);
            setSelectedPlanId(null);
            const loadedPlans = getWorkoutPlans();
            setPlans(loadedPlans);
          }
        }
      ]
    );
  };

  const handleEditPlan = () => {
    navigation.navigate('CreatePlan', { 
      planId: selectedPlanId,
      planName: getSelectedPlanName()
    });
  };

  // --- EFFECTS ---

  useFocusEffect(
    useCallback(() => {
      const loadedPlans = getWorkoutPlans();
      setPlans(loadedPlans);
    }, [selectedPlanId])
  );

  useEffect(() => {
    loadContent();
  }, [selectedPlanId]); 
  
  useFocusEffect(
    useCallback(() => {
      if (selectedPlanId !== null) {
        loadContent();
      }
    }, [selectedPlanId])
  );

  useEffect(() => {
    let interval;
    if (timerActive) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
        setTotalRestForExercise(prev => prev + 1); 
      }, 1000);
    } else if (!timerActive && timer !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  // --- MEMOIZED DATA (FIXED KEY LOGIC) ---

  const sections = useMemo(() => {
    if (!exercisesData || !Array.isArray(exercisesData)) {
      return [];
    }

    const isFinished = (ex) => {
      return ex.isCompleted === true;
    };

    const finishedItems = [];
    let activeSections = [];

    // *** FITUR ANTI-CRASH: UI_ID GENERATOR ***
    const addUiId = (item, secIdx, itemIdx, status) => ({
      ...item,
      // Membuat ID yang mustahil kembar: GROUP_SECTION_INDEX_DBID
      ui_id: `${status}_${secIdx}_${itemIdx}_${item.id || 'x'}` 
    });

    if (selectedPlanId !== null) {
      // PLAN MODE
      activeSections = exercisesData.map((section, secIdx) => {
        const activeData = [];
        (section.data || []).forEach((ex, itemIdx) => {
          if (isFinished(ex)) {
            finishedItems.push(addUiId(ex, secIdx, itemIdx, 'FIN'));
          } else {
            activeData.push(addUiId(ex, secIdx, itemIdx, 'ACT'));
          }
        });
        return { ...section, data: activeData };
      }).filter(sec => sec?.data?.length > 0);
    } else {
      // ALL EXERCISES MODE
      const activeItems = [];
      exercisesData.forEach((ex, idx) => {
        if (isFinished(ex)) {
          finishedItems.push(addUiId(ex, 0, idx, 'FIN'));
        } else {
          activeItems.push(addUiId(ex, 0, idx, 'ACT'));
        }
      });

      const groups = {};
      activeItems.forEach(ex => {
        const key = ex.muscle_group ? ex.muscle_group.toUpperCase() : 'OTHER';
        if (!groups[key]) groups[key] = [];
        groups[key].push(ex);
      });
      
      activeSections = Object.keys(groups).sort().map((key, secIdx) => ({
        title: key,
        data: groups[key]
      }));
    }

    if (finishedItems?.length > 0) {
      activeSections.push({
        title: "FINISHED",
        data: finishedItems
      });
    }

    return activeSections;
  }, [exercisesData, selectedPlanId]);

  // --- DRAFT & INPUT HANDLERS ---

  const updateMainListState = (id, updates) => {
    if (selectedPlanId === null) {
      setExercisesData(prev => prev.map(ex => ex.id === id ? { ...ex, ...updates } : ex));
    } else {
      setExercisesData(prev => prev.map(sec => ({
        ...sec,
        data: sec.data.map(ex => ex.id === id ? { ...ex, ...updates } : ex)
      })));
    }
  };

  // --- AUTO SAVE HANDLERS ---

  const handleBlurSave = () => {
    performAutoSave();
  };

  const updateDraft = (key, value) => {
    if (!activeExercise) return;
    const newDraft = { ...activeExercise.draft, [key]: value };
    setActiveExercise({ ...activeExercise, draft: newDraft });
    updateMainListState(activeExercise.id, { draft: newDraft });
    
    // AGGRESSIVE SAVE: Save on every keystroke
    performAutoSave(newDraft);
  };

  const adjustDraftValue = (key, currentVal, delta) => {
    const val = parseInt(currentVal);
    let newVal;
    if (isNaN(val)) {
       newVal = delta > 0 ? "1" : "0";
    } else {
       newVal = (val + delta).toString();
       if (parseInt(newVal) < 0) newVal = "0";
    }
    
    // Update State
    const newDraft = { ...activeExercise.draft, [key]: newVal };
    setActiveExercise({ ...activeExercise, draft: newDraft });
    updateMainListState(activeExercise.id, { draft: newDraft });

    // DIRECT AUTO SAVE for Steppers
    performAutoSave(newDraft);
  };

  const performAutoSave = (overrideDraft = null) => {
    if (!activeExercise || !activeExercise.workout_exercise_id) return;

    const d = overrideDraft || activeExercise.draft;
    const w = parseFloat(d.weight || '0');
    const r = parseInt(d.reps || '0');
    const s = parseInt(d.sets || '0');

    // Save to DB (Live Update)
    const success = saveExerciseSession(
      activeExercise.workout_exercise_id,
      w,
      r,
      s,
      notes, // Current notes state
      activeExercise.isCompleted // Preserve completion status
    );
    
    // Debug: Alert if save fails
    if (!success) {
      // console.warn("Auto-save failed"); 
      // Alert.alert("Error", "Gagal menyimpan data otomatis."); 
    }
  };

  // --- MODAL ACTIONS ---

  const openExercise = (exercise) => {
    setTimer(0);
    setTimerActive(false);
    setTotalRestForExercise(0);

    // 1. Ensure DB Row Exists Immediately (WITH TARGET DATE)
    const weId = ensureWorkoutSession(exercise.id, targetDate);
    if (!weId) {
       Alert.alert("Error", "Database Error");
       return;
    }

    // 2. FETCH THE TRUTH from the DB Row
    const realData = getWorkoutSessionDetails(weId);
    
    // 3. Prepare Draft based on REAL DB DATA
    // If DB has data (>0), use it. Else, fallbacks.
    let weightVal = '';
    let repsVal = '';
    let setsVal = '';

    if (realData) {
       weightVal = (realData.weight > 0) ? realData.weight.toString() : '';
       repsVal = (realData.reps > 0) ? realData.reps.toString() : '';
       setsVal = (realData.set_count > 0) ? realData.set_count.toString() : '';
    }

    // Fallbacks (Ghost Set / Defaults) only if DB is empty
    if (weightVal === '' && repsVal === '' && setsVal === '') {
       const lastStats = getLastSessionStats(exercise.id);
       const defSets = exercise.default_sets ? exercise.default_sets.toString() : '1';
       const defReps = exercise.default_reps ? exercise.default_reps.toString() : '';
       
       weightVal = lastStats && lastStats.weight != null ? lastStats.weight.toString() : '';
       repsVal = lastStats && lastStats.reps != null ? lastStats.reps.toString() : defReps;
       setsVal = lastStats && lastStats.sets != null ? lastStats.sets.toString() : defSets;
    }

    const draft = {
      weight: weightVal,
      reps: repsVal,
      sets: setsVal
    };

    const updatedExercise = { 
      ...exercise, 
      workout_exercise_id: weId, 
      draft,
      isCompleted: realData ? (realData.is_completed === 1) : false
    };
    
    // Also sync Notes from DB
    if (realData && realData.notes) {
       setNotes(realData.notes);
    } else {
       setNotes(exercise.notes || '');
    }

    setActiveExercise(updatedExercise);
    updateMainListState(exercise.id, updatedExercise);
  };

  const closeExercise = (skipSave = false) => {
    // FORCE SAVE everything before closing (unless skipped)
    if (activeExercise && !skipSave) {
       performAutoSave(); 
       if (isEditingNotes) handleSaveNotes(); // This relies on activeExercise too
    }
    
    setActiveExercise(null);
    setIsEditingNotes(false);
    setTimerActive(false);
  };

  // NEW FUNCTION: Handles the "SELESAI" button
  const handleFinishExercise = async () => {
    const draft = activeExercise.draft || {};
    const { weight, reps, sets } = draft;

    if (!weight || !reps || !sets) {
      Alert.alert("Input Kurang", "Masukkan weight, reps, dan sets.");
      return;
    }

    const setsCount = parseInt(sets);
    const repsCount = parseInt(reps); 
    const weightVal = parseFloat(weight);

    if (isNaN(setsCount) || setsCount < 1) {
       Alert.alert("Sets Tidak Valid", "Minimal 1 set.");
       return;
    }

    // 1. Ensure Session Exists (Create if needed) WITH TARGET DATE
    const workoutExerciseId = ensureWorkoutSession(activeExercise.id, targetDate);
    
    if (!workoutExerciseId) {
       Alert.alert("Error", "Gagal membuat sesi latihan. Coba lagi.");
       return;
    }

    // 2. Save Data
    const success = saveExerciseSession(
      workoutExerciseId,
      weightVal,
      repsCount,
      setsCount,
      notes,
      true // IS COMPLETED = TRUE
    );
    
    if (success) {
      updateExerciseDefaults(activeExercise.id, sets, reps);
      updateMainListState(activeExercise.id, { 
        isCompleted: true, 
        setsLogged: setsCount
      });
      closeExercise(true); // Skip auto-save to prevent overwriting 'isCompleted=true' with old state
    } else {
      Alert.alert("Gagal", "Gagal menyimpan.");
    }
  };

  const handleNoteChange = (text) => {
    setNotes(text);
    
    // 1. Auto save SESSION note (for today's history)
    if (activeExercise && activeExercise.workout_exercise_id) {
       saveExerciseSession(
        activeExercise.workout_exercise_id,
        parseFloat(activeExercise.draft?.weight || '0'),
        parseInt(activeExercise.draft?.reps || '0'),
        parseInt(activeExercise.draft?.sets || '0'),
        text, 
        activeExercise.isCompleted
      );
    }

    // 2. Auto save MASTER note (for future reference/library)
    if (activeExercise) {
       updateExerciseNotes(activeExercise.id, text);
    }

    // 3. Update UI State
    updateMainListState(activeExercise.id, { notes: text });
  };

  // handleSaveNotes is no longer needed since handleNoteChange does it all
  // const handleSaveNotes ... (Removed)

  const handleStartTimer = () => {
    setTimer(0);
    setTimerActive(true);
    // Timer only logic
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // --- RENDER ---

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={[styles.sectionHeader, isDark && { backgroundColor: 'transparent' }]}>
      <Text style={[styles.sectionTitle, isDark && { color: '#8E8E93' }]}>{title}</Text>
    </View>
  );

  const renderExerciseItem = ({ item }) => {
    // Simplified Status Logic (Binary: Finished or Not)
    const isCompleted = item.isCompleted;
    
    let status = "Mulai";
    let statusStyle = styles.statusText;
    let containerStyle = [styles.listItem, isDark && { backgroundColor: '#1C1C1E' }];

    if (isCompleted) {
      status = "Selesai";
      statusStyle = [styles.statusText, styles.statusTextActive];
      containerStyle = [styles.listItem, styles.listItemActive, isDark && { backgroundColor: '#1A2B3D' }];
    } 

    return (
      <TouchableOpacity 
        style={containerStyle} 
        onPress={() => openExercise(item)}
      >
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[styles.listTitle, isDark && { color: '#FFF' }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
          <Text style={[styles.listSubtitle, isDark && { color: '#AAA' }]} numberOfLines={1} ellipsizeMode="tail">
            {item.notes || "No notes"}
          </Text>
        </View>
        <View style={[styles.statusBadge, isDark && { backgroundColor: '#2C2C2E' }, { flexShrink: 0 }]}>
           <Text style={statusStyle}>{status}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, isTimeTravel && styles.headerTimeTravel]}>
        <Text style={[styles.headerTitle, isTimeTravel && styles.headerTitleWhite]}>
          {isTimeTravel ? `Latihan: ${new Date(targetDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : 'Sesi Workout'}
        </Text>
        {isTimeTravel && (
           <View style={styles.backDateBadge}>
             <Text style={styles.backDateText}>BACKDATE</Text>
           </View>
        )}
      </View>

      {/* PLAN SELECTOR TABS (FIXED KEYS) */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planScroll}>
          <TouchableOpacity 
            key="tab-all-exercises" // HARDCODED UNIQUE KEY
            style={[styles.planTab, selectedPlanId === null && styles.planTabActive]}
            onPress={() => {
              if (selectedPlanId !== null) {
                setExercisesData([]); 
                setSelectedPlanId(null);
              }
            }}
          >
            <Text style={[styles.planText, selectedPlanId === null && styles.planTextActive]}>Semua Exercise</Text>
          </TouchableOpacity>

          {plans.map((plan, index) => (
            <TouchableOpacity 
              // *** PERBAIKAN DISINI: Gunakan ID + Index agar 100% Unik ***
              key={`plan-${plan.id ? plan.id : 'unknown'}-${index}`} 
              style={[styles.planTab, selectedPlanId === plan.id && styles.planTabActive]}
              onPress={() => {
                if (selectedPlanId !== plan.id) {
                  setExercisesData([]); 
                  setSelectedPlanId(plan.id);
                }
              }}
            >
              <Text style={[styles.planText, selectedPlanId === plan.id && styles.planTextActive]}>{plan.name}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity 
            key="tab-add-btn" // HARDCODED UNIQUE KEY
            style={styles.addPlanBtn} 
            onPress={() => navigation.navigate('CreatePlan')}
          >
             <Ionicons name="add" size={24} color="#007AFF" />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {selectedPlanId !== null && (
        <View style={styles.planControls}>
          <TouchableOpacity style={styles.controlBtn} onPress={handleEditPlan}>
            <Ionicons name="create-outline" size={16} color="#007AFF" />
            <Text style={styles.controlText}>Ubah</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.controlBtn} onPress={handleDeletePlan}>
            <Ionicons name="trash-outline" size={16} color="#FF3B30" />
            <Text style={[styles.controlText, { color: '#FF3B30' }]}>Hapus</Text>
          </TouchableOpacity>
        </View>
      )}

      <SectionList
        sections={sections}
        // *** PERBAIKAN DISINI: Gunakan UI_ID yang digenerate useMemo ***
        keyExtractor={(item) => item.ui_id} 
        renderItem={renderExerciseItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {selectedPlanId === null ? "Tidak ada exercise di menu Exercise." : "Plan ini belum memiliki exercise."}
            </Text>
          </View>
        }
      />

      <Modal
        visible={!!activeExercise}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeExercise}
      >
        {activeExercise && (
          <KeyboardAvoidingView 
             behavior={Platform.OS === "ios" ? "padding" : undefined}
             style={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeExercise.name}</Text>
              <TouchableOpacity onPress={closeExercise} style={styles.closeBtn}>
                <Text style={styles.saveBtnTextHeader}>Tutup</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.notesCard} 
              onPress={() => setIsEditingNotes(true)}
              activeOpacity={0.9}
            >
               {isEditingNotes ? (
                 <TextInput 
                   style={styles.notesInput}
                   value={notes}
                   onChangeText={handleNoteChange}
                   // onBlur handled by live update
                   autoFocus
                   multiline
                 />
               ) : (
                 <View>
                    <Text style={styles.notesLabel}>NOTES / TARGET (Tap to edit)</Text>
                    <Text style={styles.notesText}>{notes || "No notes set. Tap to add."}</Text>
                 </View>
               )}
            </TouchableOpacity>

            <View style={styles.formContainer}>
               <View style={styles.weightRow}>
                  <View style={styles.weightInputWrapper}>
                    <Text style={styles.inputLabel}>WEIGHT</Text>
                    <TextInput
                      style={styles.weightInput}
                      keyboardType="numeric"
                      value={activeExercise.draft?.weight || ''}
                      onChangeText={(val) => updateDraft('weight', val)}
                      onEndEditing={handleBlurSave} // Live Save
                      selectTextOnFocus
                      placeholder="0"
                    />
                  </View>
                  <View style={styles.unitBox}>
                      <Text style={styles.unitText}>KG</Text>
                  </View>
               </View>

               <View style={styles.repsSetsRow}>
                  <View style={styles.stepperGroup}>
                      <Text style={styles.inputLabel}>REPS</Text>
                      <View style={styles.stepperContainer}>
                         <TextInput
                            style={styles.stepperInput}
                            keyboardType="numeric"
                            value={activeExercise.draft?.reps || ''}
                            onChangeText={(val) => updateDraft('reps', val)}
                            onEndEditing={handleBlurSave} // Live Save
                            selectTextOnFocus
                         />
                         <View style={styles.stepperControls}>
                            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustDraftValue('reps', activeExercise.draft?.reps, 1)}>
                               <Ionicons name="caret-up" size={16} color="#555" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustDraftValue('reps', activeExercise.draft?.reps, -1)}>
                               <Ionicons name="caret-down" size={16} color="#555" />
                            </TouchableOpacity>
                         </View>
                      </View>
                  </View>

                  <Text style={styles.xIcon}>X</Text>

                  <View style={styles.stepperGroup}>
                      <Text style={styles.inputLabel}>SETS</Text>
                      <View style={styles.stepperContainer}>
                         <TextInput
                            style={styles.stepperInput}
                            keyboardType="numeric"
                            value={activeExercise.draft?.sets || ''}
                            onChangeText={(val) => updateDraft('sets', val)}
                            onEndEditing={handleBlurSave} // Live Save
                            selectTextOnFocus
                         />
                         <View style={styles.stepperControls}>
                            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustDraftValue('sets', activeExercise.draft?.sets, 1)}>
                               <Ionicons name="caret-up" size={16} color="#555" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustDraftValue('sets', activeExercise.draft?.sets, -1)}>
                               <Ionicons name="caret-down" size={16} color="#555" />
                            </TouchableOpacity>
                         </View>
                      </View>
                  </View>
               </View>
            </View>

            {/* TIMER SECTION */}
            <View style={{alignItems: 'center', marginBottom: 20}}>
               {!timerActive ? (
                  <TouchableOpacity style={styles.timerStartBtn} onPress={handleStartTimer}>
                     <Ionicons name="timer-outline" size={24} color="#007AFF" />
                     <Text style={styles.timerStartText}>Mulai Timer</Text>
                  </TouchableOpacity>
               ) : (
                  <View style={styles.timerWrapper}>
                    <Text style={styles.timerText}>{formatTime(timer)}</Text>
                    <TouchableOpacity style={styles.stopBtnCard} onPress={() => setTimerActive(false)}>
                       <Text style={styles.stopBtnText}>STOP</Text>
                    </TouchableOpacity>
                  </View>
               )}
            </View>

            <View style={{flex: 1}} />

            {/* FINISH BUTTON AT BOTTOM */}
            <TouchableOpacity style={styles.finishButton} onPress={handleFinishExercise}>
              <Text style={styles.finishButtonText}>SELESAI</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  
  header: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20, 
    paddingTop: 60, 
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA'
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },

  // Tabs
  planScroll: { paddingHorizontal: 15, paddingVertical: 15 },
  planTab: { marginRight: 10, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDD' },
  planTabActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  planText: { color: '#555', fontWeight: '600' },
  planTextActive: { color: '#FFF' },
  addPlanBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center', marginRight: 20 },

  planControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  controlBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  controlText: { fontWeight: '600', color: '#007AFF', marginLeft: 5, fontSize: 12 },
  divider: { width: 1, height: 15, backgroundColor: '#CCC' },

  // List
  listContent: { paddingHorizontal: 15, paddingBottom: 100 },
  sectionHeader: { backgroundColor: '#F8F9FA', paddingVertical: 10, marginTop: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#8E8E93', letterSpacing: 1 },
  
  listItem: {
    backgroundColor: '#FFF', padding: 20, borderRadius: 14, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  listItemActive: { borderLeftWidth: 6, borderLeftColor: '#007AFF', backgroundColor: '#F0F7FF' },
  listItemProgress: { borderLeftWidth: 6, borderLeftColor: '#FF9500', backgroundColor: '#FFF8E1' },
  listTitle: { fontSize: 18, fontWeight: '600', color: '#000' },
  listSubtitle: { fontSize: 14, color: '#8E8E93', marginTop: 2 },
  statusBadge: { backgroundColor: '#F2F2F7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusText: { color: '#8E8E93', fontWeight: '600', fontSize: 12 },
  statusTextActive: { color: '#007AFF', fontWeight: '800' },
  statusTextProgress: { color: '#FF9500', fontWeight: '800' },

  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#8E8E93', marginBottom: 20 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#FFF', padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 20 },
  modalTitle: { fontSize: 28, fontWeight: '800', flex: 1 },
  closeBtn: { padding: 10 },
  saveBtnTextHeader: { fontSize: 18, color: '#007AFF', fontWeight: '800' },

  notesCard: { backgroundColor: '#FFF9C4', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#FFF59D' },
  notesLabel: { fontSize: 10, color: '#FBC02D', fontWeight: '700', letterSpacing: 1, marginBottom: 5 },
  notesText: { fontSize: 16, color: '#555', fontStyle: 'italic' },
  notesInput: { fontSize: 16, color: '#333', minHeight: 40 },

  formContainer: { marginBottom: 30 },
  weightRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 25 },
  weightInputWrapper: { flex: 1 },
  weightInput: { backgroundColor: '#F2F2F7', height: 60, borderRadius: 12, fontSize: 32, fontWeight: '700', textAlign: 'center', color: '#1C1C1E' },
  unitBox: { height: 60, width: 70, marginLeft: 15, backgroundColor: '#E5E5EA', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  unitText: { fontSize: 18, fontWeight: '700', color: '#555' },

  repsSetsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperGroup: { flex: 1 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#8E8E93', marginBottom: 8, textAlign: 'center' },
  stepperContainer: { flexDirection: 'row', backgroundColor: '#F2F2F7', borderRadius: 12, overflow: 'hidden', height: 60 },
  stepperInput: { flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
  stepperControls: { width: 30, backgroundColor: '#E5E5EA', borderLeftWidth: 1, borderColor: '#D1D1D6' },
  stepBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 0.5, borderColor: '#D1D1D6' },
  xIcon: { fontSize: 24, fontWeight: 'bold', color: '#C7C7CC', marginHorizontal: 10, paddingTop: 20 },

  restButton: { backgroundColor: '#007AFF', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginBottom: 40 },
  restButtonText: { color: '#FFF', fontSize: 20, fontWeight: '800', letterSpacing: 2 },

  finishButton: { backgroundColor: '#34C759', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginBottom: 20 },
  finishButtonText: { color: '#FFF', fontSize: 20, fontWeight: '800', letterSpacing: 2 },

  timerStartBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  timerStartText: { color: '#007AFF', fontWeight: '700', marginLeft: 8 },

  timerWrapper: { alignItems: 'center', marginTop: -10, marginBottom: 30 },
  timerText: { fontSize: 70, fontWeight: '900', color: '#1C1C1E', fontVariant: ['tabular-nums'], letterSpacing: -2 },
  stopBtnCard: { backgroundColor: '#FF3B30', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 30, marginTop: 10, elevation: 2 },
  stopBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 1 },

  // Time Travel Styles
  headerTimeTravel: { backgroundColor: '#FF9500' },
  headerTitleWhite: { color: '#FFF' },
  backDateBadge: { marginLeft: 10, backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  backDateText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
});