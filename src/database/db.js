import * as SQLite from 'expo-sqlite';
import { Alert } from 'react-native';

const db = SQLite.openDatabaseSync('fitTraining_final_V2.db');

// --- HELPER: Safe DB Query ---
const safeGetAll = (query, params = []) => {
  try {
    const res = db.getAllSync(query, params);
    return res || [];
  } catch (e) {
    console.log("DB Error:", e);
    Alert.alert("SQL Error", e.message + "\n\nQuery: " + query);
    return [];
  }
};

export const initDB = async () => {
  console.log("Initializing Database...");

  // 1. Tabel Workouts
  db.execSync(`
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT, 
      scheduled_date TEXT,
      status TEXT DEFAULT 'pending'
    );
  `);
  
  try { db.execSync("ALTER TABLE workouts ADD COLUMN scheduled_date TEXT"); } catch (e) {}
  try { db.execSync("ALTER TABLE workouts ADD COLUMN status TEXT DEFAULT 'pending'"); } catch (e) {}

  // 2. Tabel Measurements (Body Stats)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT DEFAULT 'kg',
      date TEXT NOT NULL
    );
  `);

  // 3. Tabel Exercises (Library Gerakan)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      muscle_group TEXT, 
      notes TEXT,
      default_sets TEXT, 
      default_reps TEXT  
    );
  `);

  // 4. Tabel Workout_Exercises (Sesi Latihan Harian - LIVE DATA)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS workout_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER,
      exercise_id INTEGER,
      order_index INTEGER,
      notes TEXT,
      weight REAL DEFAULT 0,
      reps INTEGER DEFAULT 0,
      set_count INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      FOREIGN KEY (workout_id) REFERENCES workouts (id),
      FOREIGN KEY (exercise_id) REFERENCES exercises (id)
    );
  `);

  // 5. Tabel History (Arsip/Struk Permanen)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_date TEXT,
      exercise_name TEXT,
      muscle_group TEXT,
      weight REAL,
      reps INTEGER,
      sets INTEGER,
      notes TEXT
    );
  `);

  // 6. Tabel Workout Plans
  db.execSync(`CREATE TABLE IF NOT EXISTS workout_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);`);
  db.execSync(`CREATE TABLE IF NOT EXISTS plan_sections (id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER, title TEXT, order_index INTEGER);`);
  db.execSync(`CREATE TABLE IF NOT EXISTS plan_exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, section_id INTEGER, exercise_id INTEGER, order_index INTEGER);`);

  // --- MIGRATION ---
  const addCol = (tbl, col, type) => {
    try { db.execSync(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${type}`); } catch (e) {}
  };
  addCol('workout_exercises', 'set_count', 'INTEGER DEFAULT 0');
  addCol('workout_exercises', 'is_completed', 'INTEGER DEFAULT 0');
  addCol('history', 'workout_date', 'TEXT');
  addCol('history', 'exercise_name', 'TEXT');
  addCol('history', 'muscle_group', 'TEXT');
  addCol('history', 'weight', 'REAL');
  addCol('history', 'reps', 'INTEGER');
  addCol('history', 'sets', 'INTEGER');
  addCol('history', 'notes', 'TEXT');

  // NOTE: Seeding otomatis dimatikan. Manual via Settings -> Reset.
  console.log("Database Ready.");
};

// --- HELPERS ---

export const getLocalDate = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export const getLocalTimestamp = () => {
  const d = new Date();
  return `${getLocalDate()}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

export const getStartOfWeekDate = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(d.setDate(diff));
  return startOfWeek.getFullYear() + '-' + String(startOfWeek.getMonth() + 1).padStart(2, '0') + '-' + String(startOfWeek.getDate()).padStart(2, '0');
};

export const getStartOfMonthDate = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
};

export const getWorkoutDates = () => {
  try {
    const res = safeGetAll('SELECT DISTINCT workout_date FROM history ORDER BY workout_date ASC');
    return res.map(r => r.workout_date);
  } catch (error) { return []; }
};

// --- WORKOUT ENGINE ---

export const ensureWorkoutSession = (exerciseId, customDate = null) => {
  try {
    const targetDate = customDate || getLocalDate();
    let workoutId;
    const workouts = safeGetAll(`SELECT id FROM workouts WHERE scheduled_date = ? LIMIT 1`, [targetDate]);
    if (workouts.length > 0) {
      workoutId = workouts[0].id;
    } else {
      const res = db.runSync(`INSERT INTO workouts (name, scheduled_date) VALUES (?, ?)`, ['Daily Log', targetDate]);
      workoutId = res.lastInsertRowId;
    }
    const links = safeGetAll(`SELECT id FROM workout_exercises WHERE workout_id = ? AND exercise_id = ? LIMIT 1`, [workoutId, exerciseId]);
    if (links.length > 0) return links[0].id;
    const resLink = db.runSync(`INSERT INTO workout_exercises (workout_id, exercise_id) VALUES (?, ?)`, [workoutId, exerciseId]);
    return resLink.lastInsertRowId;
  } catch (error) {
    console.error("Error ensureWorkoutSession:", error);
    return null;
  }
};

export const saveExerciseSession = (workoutExerciseId, weight, reps, setCount, notes, isCompleted) => {
  try {
    const w = isNaN(weight) ? 0 : weight;
    const r = isNaN(reps) ? 0 : reps;
    const s = isNaN(setCount) ? 0 : setCount;
    const n = notes || '';
    const c = isCompleted ? 1 : 0;

    db.runSync(
      `UPDATE workout_exercises SET weight = ?, reps = ?, set_count = ?, notes = ?, is_completed = ? WHERE id = ?`,
      [w, r, s, n, c, workoutExerciseId]
    );

    if (isCompleted) {
       const details = safeGetAll(
         `SELECT e.name, e.muscle_group, w.scheduled_date FROM workout_exercises we JOIN workouts w ON we.workout_id = w.id JOIN exercises e ON we.exercise_id = e.id WHERE we.id = ?`,
          [workoutExerciseId]
       );
       if (details.length > 0) {
          const { name, muscle_group, scheduled_date } = details[0];
          try {
            db.runSync(`DELETE FROM history WHERE workout_date = ? AND exercise_name = ?`, [scheduled_date, name]);
            db.runSync(
              `INSERT INTO history (workout_date, exercise_name, muscle_group, weight, reps, sets, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [scheduled_date, name, muscle_group, w, r, s, n]
            );
          } catch (histErr) {
             Alert.alert("History Error", "Gagal menyimpan riwayat: " + histErr.message);
          }
       }
    }
    return true;
  } catch (error) {
    Alert.alert("Save Error", error.message);
    return false;
  }
};

export const getTodayLogs = (customDate = null) => {
  try {
    const targetDate = customDate || getLocalDate();
    const logs = safeGetAll(
      `SELECT we.exercise_id, we.weight, we.reps, we.set_count as setsLogged, we.is_completed, we.notes, we.id as workout_exercise_id
       FROM workout_exercises we JOIN workouts w ON we.workout_id = w.id WHERE w.scheduled_date = ? ORDER BY we.id ASC`,
      [targetDate]
    );
    const progressMap = {};
    logs.forEach(log => {
       progressMap[log.exercise_id] = { 
         setsLogged: log.setsLogged, lastWeight: log.weight, lastReps: log.reps, 
         isCompleted: log.is_completed === 1, notes: log.notes, workout_exercise_id: log.workout_exercise_id
       };
    });
    return progressMap;
  } catch (error) { return {}; }
};

export const getLastSessionStats = (exerciseId) => {
  try {
    if (!exerciseId) return null;
    const ex = safeGetAll('SELECT name FROM exercises WHERE id = ?', [exerciseId]);
    if (ex.length === 0) return null;
    const res = safeGetAll(`SELECT reps, weight, sets, notes FROM history WHERE exercise_name = ? ORDER BY workout_date DESC, id DESC LIMIT 1`, [ex[0].name]);
    return res.length > 0 ? res[0] : null;
  } catch (error) { return null; }
};

export const getWorkoutSessionDetails = (id) => {
  try {
    if (!id) return null;
    const res = safeGetAll('SELECT * FROM workout_exercises WHERE id = ?', [id]);
    return res.length > 0 ? res[0] : null;
  } catch (error) { return null; }
};

// --- STATS & PROGRESS ---

export const getWorkoutHistory = (limit = 10, offset = 0) => {
  try {
    const dates = safeGetAll(`SELECT DISTINCT workout_date as day FROM history ORDER BY day DESC LIMIT ? OFFSET ?`, [limit, offset]);
    return dates.map(d => {
       const logs = safeGetAll(`SELECT exercise_name, sets FROM history WHERE workout_date = ?`, [d.day]);
       return {
         date: d.day,
         totalSets: logs.reduce((sum, l) => sum + (l.sets || 0), 0),
         exerciseCount: logs.length,
         exercises: logs.map(l => l.exercise_name).join(", ")
       };
    });
  } catch (error) { return []; }
};

export const getWorkoutHistoryCount = () => {
  try {
    const res = safeGetAll(`SELECT COUNT(DISTINCT workout_date) as count FROM history`);
    return res.length > 0 ? res[0].count : 0;
  } catch (error) { return 0; }
};

export const getSessionDetails = (dateStr) => {
  try {
    return safeGetAll(`SELECT exercise_name as name, weight, reps, sets, notes FROM history WHERE workout_date = ? ORDER BY id ASC`, [dateStr]);
  } catch (error) { return []; }
};

export const getVolumeLast7Days = () => {
  try {
    const res = safeGetAll(`
      SELECT workout_date, SUM(weight * reps * sets) as vol 
      FROM history 
      GROUP BY workout_date 
      ORDER BY workout_date DESC 
      LIMIT 7
    `);
    const reversed = res.reverse();
    const labels = reversed.map(item => {
      const parts = item.workout_date.split('-');
      return `${parts[2]}/${parts[1]}`;
    });
    const data = reversed.map(item => item.vol);
    return { labels, data };
  } catch (error) { return { labels: [], data: [] }; }
};

export const getExerciseHistoryData = (exerciseId) => {
  try {
    if (!exerciseId) return [];
    const ex = safeGetAll('SELECT name FROM exercises WHERE id = ?', [exerciseId]);
    if (ex.length === 0) return [];
    return safeGetAll(`
      SELECT workout_date, MAX(weight) as weight, MAX(reps) as reps, SUM(sets) as sets 
      FROM history 
      WHERE exercise_name = ? 
      GROUP BY workout_date 
      ORDER BY workout_date ASC 
      LIMIT 10
    `, [ex[0].name]);
  } catch (error) { return []; }
};

// --- LIBRARY & PLANS ---

export const getAllExercises = () => safeGetAll('SELECT * FROM exercises ORDER BY name ASC');
export const addExercise = (n, m, nt) => db.runSync(`INSERT INTO exercises (name, muscle_group, notes) VALUES (?, ?, ?)`, [n, m, nt]);
export const deleteExercise = (id) => db.runSync('DELETE FROM exercises WHERE id = ?', [id]);
export const updateExerciseNotes = (id, nt) => db.runSync('UPDATE exercises SET notes = ? WHERE id = ?', [nt, id]);
export const updateExerciseDefaults = (id, s, r) => db.runSync('UPDATE exercises SET default_sets = ?, default_reps = ? WHERE id = ?', [s.toString(), r.toString(), id]);

export const getWorkoutPlans = () => safeGetAll('SELECT * FROM workout_plans');
export const createWorkoutPlan = (n) => db.runSync('INSERT INTO workout_plans (name) VALUES (?)', [n]).lastInsertRowId;
export const addSectionToPlan = (p, t, o) => db.runSync('INSERT INTO plan_sections (plan_id, title, order_index) VALUES (?, ?, ?)', [p, t, o]).lastInsertRowId;
export const addExerciseToSection = (s, e, o) => db.runSync('INSERT INTO plan_exercises (section_id, exercise_id, order_index) VALUES (?, ?, ?)', [s, e, o]);
export const getPlanDetails = (pId) => {
  try {
    const sections = safeGetAll('SELECT * FROM plan_sections WHERE plan_id = ? ORDER BY order_index ASC', [pId]);
    if (!sections) return [];
    return sections.map(s => ({
      ...s, 
      data: safeGetAll(`SELECT e.*, pe.id as plan_exercise_id FROM plan_exercises pe JOIN exercises e ON pe.exercise_id = e.id WHERE pe.section_id = ? ORDER BY pe.order_index ASC`, [s.id]) || [] 
    }));
  } catch (error) { return []; }
};
export const deleteWorkoutPlan = (pId) => {
  try {
    const sections = safeGetAll('SELECT id FROM plan_sections WHERE plan_id = ?', [pId]);
    if (sections.length > 0) db.runSync(`DELETE FROM plan_exercises WHERE section_id IN (${sections.map(s => s.id).join(',')})`);
    db.runSync('DELETE FROM plan_sections WHERE plan_id = ?', [pId]);
    db.runSync('DELETE FROM workout_plans WHERE id = ?', [pId]);
    return true;
  } catch (error) { return false; }
};

// --- BODY MEASUREMENTS ---

export const getLatestBodyStats = () => {
  const stats = {};
  ['weight', 'arm', 'forearm', 'chest'].forEach(t => {
    const res = safeGetAll(`SELECT value, date FROM measurements WHERE type = ? ORDER BY date DESC LIMIT 1`, [t]);
    stats[t] = res.length > 0 ? { value: res[0].value, date: res[0].date.split('T')[0] } : null;
  });
  return stats;
};

export const getBodyStatsHistory = () => {
  const datesRes = safeGetAll(`SELECT DISTINCT substr(date, 1, 10) as day FROM measurements ORDER BY day DESC LIMIT 7`);
  const dates = datesRes.map(d => d.day).reverse();
  const dataMap = { weight: [], arm: [], forearm: [], chest: [] };
  dates.forEach(day => {
    const records = safeGetAll(`SELECT type, value FROM measurements WHERE date LIKE ?`, [`${day}%`]);
    ['weight', 'arm', 'forearm', 'chest'].forEach(t => {
      const found = records.find(r => r.type === t);
      dataMap[t].push(found ? found.value : 0);
    });
  });
  return { labels: dates.map(d => d.split('-')[2] + '/' + d.split('-')[1]), datasets: Object.keys(dataMap).map(k => ({ type: k, data: dataMap[k] })) };
};

export const addMeasurement = (t, v, u = 'kg', d) => {
  const date = d ? (d.includes('T') ? d : `${d}T${new Date().toTimeString().split(' ')[0]}`) : getLocalTimestamp();
  db.runSync(`INSERT INTO measurements (type, value, unit, date) VALUES (?, ?, ?, ?)`, [t, v, u, date]);
};

export const getLastMeasurementDate = () => {
  const res = safeGetAll(`SELECT date FROM measurements ORDER BY date DESC LIMIT 1`);
  return res.length > 0 ? res[0].date.split('T')[0] : null;
};

export const getMeasurementHistoryGrouped = () => {
  try {
    const raw = safeGetAll(`SELECT id, type, value, date FROM measurements ORDER BY date DESC`);
    const grouped = {};
    raw.forEach(item => {
      const dateKey = item.date.split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateKey, data: { weight: '-', arm: '-', forearm: '-', chest: '-' } };
      }
      if (item.type === 'weight') grouped[dateKey].data.weight = item.value + ' kg';
      if (item.type === 'arm') grouped[dateKey].data.arm = item.value + ' cm';
      if (item.type === 'forearm') grouped[dateKey].data.forearm = item.value + ' cm';
      if (item.type === 'chest') grouped[dateKey].data.chest = item.value + ' cm';
    });
    return Object.values(grouped);
  } catch (error) { return []; }
};

export const deleteMeasurementsByDate = (dateString) => {
  try {
    db.runSync(`DELETE FROM measurements WHERE date LIKE ?`, [`${dateString}%`]);
    return true;
  } catch (error) { return false; }
};

// --- CLEANUP ---

export const deleteHistoryByDate = (date) => db.runSync('DELETE FROM history WHERE workout_date = ?', [date]);
export const getNextWorkout = () => {
  const res = safeGetAll(`SELECT * FROM workouts WHERE status = 'pending' ORDER BY scheduled_date ASC LIMIT 1`);
  return res.length > 0 ? res[0] : null;
};

// --- SEEDING LOGIC ---
export const seedFullbodyPlan = () => {
  try {
     console.log("Seeding Fullbody Split...");
     const exercisesList = [
       {name: 'Leg Press', muscle: 'Legs', notes: '10-12 reps', sets: '3', reps: '11'},
       {name: 'Leg Curl (Hamstring)', muscle: 'Legs', notes: '12-15 reps', sets: '3', reps: '14'},
       {name: 'Incline Dumbbell Press', muscle: 'Chest', notes: '8-10 reps (aga gemetar)', sets: '3', reps: '9'},
       {name: 'Lat Pull Down', muscle: 'Back', notes: '10-12 reps', sets: '3', reps: '10'},
       {name: 'Flat Bench Press', muscle: 'Chest', notes: '8-10 reps (tahan beban 2 detik)', sets: '3', reps: '8'},
       {name: 'Seated Row Machine', muscle: 'Back', notes: '10-12 reps', sets: '3', reps: '11'},
       {name: 'Shoulder Press', muscle: 'Shoulders', notes: '8-10 reps', sets: '3', reps: '10'},
       {name: 'Dips', muscle: 'Chest', notes: 'Sampe nyerah', sets: '3', reps: '10'},
       {name: 'Butterfly', muscle: 'Chest', notes: '12-15 reps', sets: '3', reps: '13'},
       {name: 'Lateral Raise', muscle: 'Shoulders', notes: '12-15 reps', sets: '3', reps: '15'},
       {name: 'Rear Delt Machine (Bahu Belakang)', muscle: 'Shoulders', notes: '15-20 reps', sets: '3', reps: '16'},
       {name: 'Rope Push Down', muscle: 'Arms', notes: '12-15 reps', sets: '3', reps: '13'},
       {name: 'Overhead Extension Machine', muscle: 'Arms', notes: '10-12 reps', sets: '3', reps: '10'},
       {name: 'Hammer Curl', muscle: 'Arms', notes: '10-12 reps', sets: '3', reps: '12'},
       {name: 'Zottman Curl', muscle: 'Arms', notes: '10-12 reps', sets: '3', reps: '12'},
       {name: 'Cable Crunch', muscle: 'Core', notes: '10-15 reps', sets: '3', reps: '13'},
       {name: 'Hanging Leg Raises', muscle: 'Core', notes: '8-12 reps', sets: '3', reps: '9'},
       {name: 'Plank', muscle: 'Core', notes: 'Sampai gemetar (detik)', sets: '3', reps: '60'},
       {name: 'Russian Twist', muscle: 'Core', notes: '15-20 per sisi', sets: '3', reps: '15'},
     ];
     exercisesList.forEach(ex => {
       db.runSync(
         `INSERT INTO exercises (name, muscle_group, notes, default_sets, default_reps) VALUES (?, ?, ?, ?, ?)`,
         [ex.name, ex.muscle, ex.notes, ex.sets, ex.reps]
       );
     });
     const planRes = db.runSync(`INSERT INTO workout_plans (name) VALUES (?)`, ['Fullbody']);
     const planId = planRes.lastInsertRowId;
     const createSection = (title, order, exNames) => {
       const secRes = db.runSync(`INSERT INTO plan_sections (plan_id, title, order_index) VALUES (?, ?, ?)`, [planId, title, order]);
       const secId = secRes.lastInsertRowId;
       exNames.forEach((name, idx) => {
         const exDB = safeGetAll(`SELECT id FROM exercises WHERE name = ?`, [name]);
         if (exDB.length > 0) {
           db.runSync(`INSERT INTO plan_exercises (section_id, exercise_id, order_index) VALUES (?, ?, ?)`, [secId, exDB[0].id, idx]);
         }
       });
     };
     createSection('Legs', 1, ['Leg Press', 'Leg Curl (Hamstring)']);
     createSection('Push & Pull', 2, ['Incline Dumbbell Press', 'Lat Pull Down', 'Flat Bench Press', 'Seated Row Machine', 'Shoulder Press']);
     createSection('Isolation & Detail', 3, ['Dips', 'Butterfly', 'Lateral Raise', 'Rear Delt Machine (Bahu Belakang)']);
     createSection('Arms', 4, ['Rope Push Down', 'Overhead Extension Machine', 'Hammer Curl', 'Zottman Curl']);
     createSection('Core', 5, ['Cable Crunch', 'Hanging Leg Raises', 'Plank', 'Russian Twist']);
     return true;
  } catch (e) { return false; }
};

// --- BACKUP & RESTORE ---

export const exportDatabaseToJson = () => {
  try {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      exercises: safeGetAll('SELECT * FROM exercises'),
      workouts: safeGetAll('SELECT * FROM workouts'),
      workout_exercises: safeGetAll('SELECT * FROM workout_exercises'),
      history: safeGetAll('SELECT * FROM history'),
      measurements: safeGetAll('SELECT * FROM measurements'),
      workout_plans: safeGetAll('SELECT * FROM workout_plans'),
      plan_sections: safeGetAll('SELECT * FROM plan_sections'),
      plan_exercises: safeGetAll('SELECT * FROM plan_exercises')
    };
    return JSON.stringify(data);
  } catch (error) { return null; }
};

export const importJsonToDatabase = async (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    if (!data.history || !data.exercises) throw new Error("Invalid Format");
    await db.withTransactionSync(() => {
      db.runSync('DELETE FROM exercises'); db.runSync('DELETE FROM workouts');
      db.runSync('DELETE FROM workout_exercises'); db.runSync('DELETE FROM history');
      db.runSync('DELETE FROM measurements'); db.runSync('DELETE FROM workout_plans');
      db.runSync('DELETE FROM plan_sections'); db.runSync('DELETE FROM plan_exercises');
      const insert = (table, rows) => {
        if (!rows || rows.length === 0) return;
        const keys = Object.keys(rows[0]);
        const placeholders = keys.map(() => '?').join(',');
        const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
        rows.forEach(row => db.runSync(sql, keys.map(k => row[k])));
      };
      insert('exercises', data.exercises); insert('workouts', data.workouts);
      insert('workout_exercises', data.workout_exercises); insert('history', data.history);
      insert('measurements', data.measurements); insert('workout_plans', data.workout_plans);
      insert('plan_sections', data.plan_sections); insert('plan_exercises', data.plan_exercises);
    });
    return true;
  } catch (error) { return false; }
};

// --- STATS HELPERS ---

export const getWeeklyWorkoutCount = (startOfWeek) => {
  try {
    const res = safeGetAll(`SELECT COUNT(DISTINCT workout_date) as count FROM history WHERE workout_date >= ?`, [startOfWeek]);
    return res?.[0]?.count || 0;
  } catch (error) { return 0; }
};

export const getMonthlyWorkoutCount = (startOfMonth) => {
  try {
    const res = safeGetAll(`SELECT COUNT(DISTINCT workout_date) as count FROM history WHERE workout_date >= ?`, [startOfMonth]);
    return res?.[0]?.count || 0;
  } catch (error) { return 0; }
};

export const getPersonalRecords = () => {
  try {
    return safeGetAll(`SELECT exercise_name as name, MAX(weight) as max_weight FROM history GROUP BY exercise_name ORDER BY max_weight DESC LIMIT 5`);
  } catch (error) { return []; }
};

export const getLatestWeight = () => {
  try {
    const res = safeGetAll(`SELECT value FROM measurements WHERE type = 'weight' ORDER BY date DESC LIMIT 1`);
    return res?.length > 0 ? res[0].value : 0;
  } catch (error) { return 0; }
};

export const getPrCount = () => {
  try {
    const res = safeGetAll(`SELECT COUNT(DISTINCT exercise_name) as count FROM history`);
    return res.length > 0 ? res[0].count : 0;
  } catch (error) { return 0; }
};

export const getPaginatedPersonalRecords = (limit = 5, offset = 0) => {
  try {
    return safeGetAll(`SELECT exercise_name as name, MAX(weight) as max_weight FROM history GROUP BY exercise_name ORDER BY name ASC LIMIT ? OFFSET ?`, [limit, offset]);
  } catch (error) { return []; }
};

export const getMusclesTrainedOnDate = (dateStr) => {
  try {
    const targetDate = dateStr || getLocalDate();
    const res = safeGetAll(`SELECT DISTINCT muscle_group FROM history WHERE workout_date = ?`, [targetDate]);
    return res.map(r => r.muscle_group);
  } catch (error) { return []; }
};

export default db;
