/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Plugin } from 'vite';
import { serverStorage } from './serverStorage.ts';
import url from 'url';

export function viteApiPlugin(): Plugin {
  return {
    name: 'vite-api-server-storage-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const parsedUrl = url.parse(req.url || '', true);
        const pathname = parsedUrl.pathname || '';

        if (!pathname.startsWith('/api')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        // Helper to read JSON request body
        const readBody = (): Promise<any> => {
          return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch (err) {
                reject(err);
              }
            });
            req.on('error', reject);
          });
        };

        try {
          // 1. GET /api/data - Full database load
          if (pathname === '/api/data' && req.method === 'GET') {
            const store = serverStorage.getStore();
            res.statusCode = 200;
            return res.end(JSON.stringify(store));
          }

          // 2. POST /api/teachers - Save teachers list
          if (pathname === '/api/teachers' && req.method === 'POST') {
            const body = await readBody();
            const store = serverStorage.saveTeachers(body.teachers || body);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, teachers: store.teachers }));
          }

          // 3. POST /api/classrooms - Save classrooms list
          if (pathname === '/api/classrooms' && req.method === 'POST') {
            const body = await readBody();
            const store = serverStorage.saveClassrooms(body.classrooms || body);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, classrooms: store.classrooms }));
          }

          // 4. POST /api/classrooms/create - Add single classroom
          if (pathname === '/api/classrooms/create' && req.method === 'POST') {
            const body = await readBody();
            const store = serverStorage.addClassroom(body);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, classrooms: store.classrooms }));
          }

          // 5. DELETE /api/classrooms/:id - Delete classroom
          const classroomDelMatch = pathname.match(/^\/api\/classrooms\/([^/]+)$/);
          if (classroomDelMatch && req.method === 'DELETE') {
            const id = classroomDelMatch[1];
            const store = serverStorage.deleteClassroom(id);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, classrooms: store.classrooms }));
          }

          // 6. POST /api/papers - Save papers list
          if (pathname === '/api/papers' && req.method === 'POST') {
            const body = await readBody();
            const store = serverStorage.savePapers(body.papers || body);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, papers: store.papers }));
          }

          // 7. POST /api/buildings - Save buildings list
          if (pathname === '/api/buildings' && req.method === 'POST') {
            const body = await readBody();
            const store = serverStorage.saveBuildings(body.buildings || body);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, buildings: store.buildings }));
          }

          // 7. POST /api/buildings/create - Add single building
          if (pathname === '/api/buildings/create' && req.method === 'POST') {
            const body = await readBody();
            const store = serverStorage.addBuilding(body);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, buildings: store.buildings }));
          }

          // 8. POST /api/routines - Save all routines
          if (pathname === '/api/routines' && req.method === 'POST') {
            const body = await readBody();
            const store = serverStorage.saveRoutines(body.routines || body);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, routines: store.routines }));
          }

          // 9. POST /api/routines/save-one - Save or update single routine
          if (pathname === '/api/routines/save-one' && req.method === 'POST') {
            const body = await readBody();
            const store = serverStorage.saveRoutine(body.routine || body);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, routines: store.routines, activeRoutineId: store.settings.activeRoutineId }));
          }

          // 10. DELETE /api/routines/:id - Delete routine
          const routineDelMatch = pathname.match(/^\/api\/routines\/([^/]+)$/);
          if (routineDelMatch && req.method === 'DELETE') {
            const id = routineDelMatch[1];
            const store = serverStorage.deleteRoutine(id);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, routines: store.routines, activeRoutineId: store.settings.activeRoutineId }));
          }

          // 11. POST /api/rules - Save routine preparation check rules
          if (pathname === '/api/rules' && req.method === 'POST') {
            const body = await readBody();
            const store = serverStorage.saveRules(body.rules || body);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, rules: store.rules }));
          }

          // 12. POST /api/settings - Save app settings
          if (pathname === '/api/settings' && req.method === 'POST') {
            const body = await readBody();
            const store = serverStorage.saveSettings(body.settings || body);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, settings: store.settings }));
          }

          // 13. POST /api/reset - Factory reset on server
          if (pathname === '/api/reset' && req.method === 'POST') {
            const store = serverStorage.resetToDefault();
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, store }));
          }

          // 14. GET /api/health
          if (pathname === '/api/health' && req.method === 'GET') {
            res.statusCode = 200;
            return res.end(JSON.stringify({ status: 'ok', serverTime: new Date().toISOString(), storage: 'server-disk' }));
          }

          // Fallthrough 404
          res.statusCode = 404;
          return res.end(JSON.stringify({ error: `Not Found: ${pathname}` }));
        } catch (err: any) {
          console.error('[ViteApiPlugin] Error handling request:', err);
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message || 'Server error' }));
        }
      });
    },
  };
}
