/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { serverStorage } from './serverStorage';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '10mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// GET /api/data
app.get('/api/data', (req, res) => {
  try {
    const store = serverStorage.getStore();
    res.json(store);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teachers
app.post('/api/teachers', (req, res) => {
  try {
    const store = serverStorage.saveTeachers(req.body.teachers || req.body);
    res.json({ success: true, teachers: store.teachers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/classrooms
app.post('/api/classrooms', (req, res) => {
  try {
    const store = serverStorage.saveClassrooms(req.body.classrooms || req.body);
    res.json({ success: true, classrooms: store.classrooms });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/classrooms/create
app.post('/api/classrooms/create', (req, res) => {
  try {
    const store = serverStorage.addClassroom(req.body);
    res.json({ success: true, classrooms: store.classrooms });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/classrooms/:id
app.delete('/api/classrooms/:id', (req, res) => {
  try {
    const store = serverStorage.deleteClassroom(req.params.id);
    res.json({ success: true, classrooms: store.classrooms });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/papers
app.post('/api/papers', (req, res) => {
  try {
    const store = serverStorage.savePapers(req.body.papers || req.body);
    res.json({ success: true, papers: store.papers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buildings
app.post('/api/buildings', (req, res) => {
  try {
    const store = serverStorage.saveBuildings(req.body.buildings || req.body);
    res.json({ success: true, buildings: store.buildings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buildings/create
app.post('/api/buildings/create', (req, res) => {
  try {
    const store = serverStorage.addBuilding(req.body);
    res.json({ success: true, buildings: store.buildings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routines
app.post('/api/routines', (req, res) => {
  try {
    const store = serverStorage.saveRoutines(req.body.routines || req.body);
    res.json({ success: true, routines: store.routines });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routines/save-one
app.post('/api/routines/save-one', (req, res) => {
  try {
    const store = serverStorage.saveRoutine(req.body.routine || req.body);
    res.json({ success: true, routines: store.routines, activeRoutineId: store.settings.activeRoutineId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/routines/:id
app.delete('/api/routines/:id', (req, res) => {
  try {
    const store = serverStorage.deleteRoutine(req.params.id);
    res.json({ success: true, routines: store.routines, activeRoutineId: store.settings.activeRoutineId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rules
app.post('/api/rules', (req, res) => {
  try {
    const store = serverStorage.saveRules(req.body.rules || req.body);
    res.json({ success: true, rules: store.rules });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings
app.post('/api/settings', (req, res) => {
  try {
    const store = serverStorage.saveSettings(req.body.settings || req.body);
    res.json({ success: true, settings: store.settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/unavailability
app.post('/api/unavailability', (req, res) => {
  try {
    const store = serverStorage.saveUnavailability(req.body.unavailability || req.body);
    res.json({ success: true, unavailability: store.unavailability });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reset
app.post('/api/reset', (req, res) => {
  try {
    const store = serverStorage.resetToDefault();
    res.json({ success: true, store });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString(), storage: 'server-disk' });
});

// Serve frontend in production if dist exists
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Express Backend] Routine Server running on http://localhost:${PORT}`);
  });
}

export default app;
