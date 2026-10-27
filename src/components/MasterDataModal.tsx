/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BuildingInfo, Classroom, Paper, Teacher } from '../types';
import { INITIAL_BUILDINGS } from '../data/initialData';
import {
  BookOpen,
  Building,
  Check,
  Edit2,
  GraduationCap,
  Layers,
  Plus,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';

interface MasterDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildings?: BuildingInfo[];
  classrooms: Classroom[];
  papers: Paper[];
  teachers: Teacher[];
  isAdmin: boolean;
  onUpdateBuildings?: (buildings: BuildingInfo[]) => void;
  onUpdateClassrooms?: (classrooms: Classroom[]) => void;
  onUpdatePapers?: (papers: Paper[]) => void;
  onUpdateTeachers?: (teachers: Teacher[]) => void;
  onOpenTeacherMapping?: () => void;
}

export const MasterDataModal: React.FC<MasterDataModalProps> = ({
  isOpen,
  onClose,
  buildings = INITIAL_BUILDINGS,
  classrooms,
  papers,
  teachers,
  isAdmin,
  onUpdateBuildings,
  onUpdateClassrooms,
  onUpdatePapers,
  onUpdateTeachers,
  onOpenTeacherMapping,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'rooms' | 'papers' | 'teachers'>('rooms');

  // Building adding state
  const [isAddingBuilding, setIsAddingBuilding] = useState(false);
  const [newBuildingData, setNewBuildingData] = useState<Partial<BuildingInfo>>({
    name: '',
    code: '',
    floors: 2,
    description: '',
  });

  // Editing state for Classroom
  const [editingRoom, setEditingRoom] = useState<Classroom | null>(null);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomData, setNewRoomData] = useState<Partial<Classroom>>({
    name: '',
    code: '',
    building: buildings[0]?.id || 'OLD',
    roomNumber: classrooms.length + 1,
    floor: 1,
    capacity: 70,
  });

  const handleAddBuilding = () => {
    if (!onUpdateBuildings || !newBuildingData.name || !newBuildingData.code) return;
    const bId = newBuildingData.code.trim().toUpperCase();
    const newBldg: BuildingInfo = {
      id: bId,
      name: newBuildingData.name.trim(),
      code: bId,
      floors: Number(newBuildingData.floors) || 1,
      description: newBuildingData.description?.trim() || `${newBuildingData.name} Facility`,
    };
    onUpdateBuildings([...buildings, newBldg]);
    setIsAddingBuilding(false);
    setNewBuildingData({ name: '', code: '', floors: 2, description: '' });
  };

  // Editing state for Paper
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [isAddingPaper, setIsAddingPaper] = useState(false);
  const [newPaperData, setNewPaperData] = useState<Partial<Paper>>({
    code: '',
    title: '',
    category: 'Legal Studies',
    totalTargetSessions: 40,
    color: '#3B82F6',
    description: '',
    theoryOrPractical: 'THEORY',
    maxDailyPerRoom: 2,
    preferredBuilding: 'ALL',
    primaryTeacherIds: [],
    nearestPaperIds: [],
  });

  // Editing state for Teacher
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isAddingTeacher, setIsAddingTeacher] = useState(false);
  const [newTeacherData, setNewTeacherData] = useState<Partial<Teacher>>({
    code: '',
    name: '',
    designation: 'Training Instructor',
    assignedBuilding: 'FLOATING',
    maxDailyPeriods: 4,
    primaryPaperIds: ['P01'],
    backupPaperIds: ['P02', 'P03'],
    secondaryPaperIds: ['P02', 'P03'],
    phone: '',
    email: '',
    status: 'ACTIVE',
    qualification: '',
    remarks: '',
  });

  // Handlers for Classrooms
  const handleSaveRoom = (room: Classroom) => {
    if (!onUpdateClassrooms) return;
    const updated = classrooms.map((r) => (r.id === room.id ? room : r));
    onUpdateClassrooms(updated);
    setEditingRoom(null);
  };

  const handleAddRoom = () => {
    if (!onUpdateClassrooms || !newRoomData.name) return;
    const bId = newRoomData.building || buildings[0]?.id || 'OLD';
    const bldg = buildings.find((b) => b.id === bId);
    const roomNumber = newRoomData.roomNumber || classrooms.length + 1;
    const code = newRoomData.code || `${bldg?.code || 'RM'}-${roomNumber < 10 ? '0' : ''}${roomNumber}`;
    const id = `CR-${code}-${Date.now()}`;
    const room: Classroom = {
      id,
      code,
      name: newRoomData.name,
      building: bId,
      roomNumber,
      floor: Number(newRoomData.floor) || 1,
      capacity: Number(newRoomData.capacity) || 70,
    };
    onUpdateClassrooms([...classrooms, room]);
    setIsAddingRoom(false);
    setNewRoomData({ name: '', code: '', building: bId, roomNumber: 1, floor: 1, capacity: 70 });
  };

  const handleDeleteRoom = (roomId: string) => {
    if (!onUpdateClassrooms || classrooms.length <= 1) return;
    if (window.confirm('Are you sure you want to delete this classroom?')) {
      onUpdateClassrooms(classrooms.filter((r) => r.id !== roomId));
    }
  };

  // Handlers for Papers
  const handleSavePaper = (paper: Paper) => {
    if (!onUpdatePapers) return;
    const updated = papers.map((p) => (p.id === paper.id ? paper : p));
    onUpdatePapers(updated);
    setEditingPaper(null);
  };

  const handleAddPaper = () => {
    if (!onUpdatePapers || !newPaperData.title || !newPaperData.code) return;
    const id = `P${papers.length + 1 < 10 ? '0' : ''}${papers.length + 1}`;
    const paper: Paper = {
      id,
      code: newPaperData.code,
      title: newPaperData.title,
      category: newPaperData.category || 'Legal Studies',
      totalTargetSessions: Number(newPaperData.totalTargetSessions) || 30,
      color: newPaperData.color || '#3B82F6',
      description: newPaperData.description || '',
      theoryOrPractical: newPaperData.theoryOrPractical || 'THEORY',
      maxDailyPerRoom: Number(newPaperData.maxDailyPerRoom) || 2,
      preferredBuilding: newPaperData.preferredBuilding || 'ALL',
      primaryTeacherIds: [],
      nearestPaperIds: [],
    };
    onUpdatePapers([...papers, paper]);
    setIsAddingPaper(false);
    setNewPaperData({
      code: '',
      title: '',
      category: 'Legal Studies',
      totalTargetSessions: 40,
      color: '#3B82F6',
      description: '',
      theoryOrPractical: 'THEORY',
      maxDailyPerRoom: 2,
      preferredBuilding: 'ALL',
      primaryTeacherIds: [],
      nearestPaperIds: []
    });
  };

  const handleDeletePaper = (paperId: string) => {
    if (!onUpdatePapers || papers.length <= 1) return;
    if (window.confirm('Are you sure you want to delete this paper?')) {
      onUpdatePapers(papers.filter((p) => p.id !== paperId));
    }
  };

  // Handlers for Teachers
  const handleSaveTeacher = (teacher: Teacher) => {
    if (!onUpdateTeachers) return;
    const backupPaperIds =
      teacher.backupPaperIds && teacher.backupPaperIds.length > 0
        ? teacher.backupPaperIds
        : teacher.secondaryPaperIds || [];
    const teacherToSave: Teacher = {
      ...teacher,
      backupPaperIds,
      secondaryPaperIds: backupPaperIds,
    };
    const updated = teachers.map((t) => (t.id === teacher.id ? teacherToSave : t));
    onUpdateTeachers(updated);
    setEditingTeacher(null);
  };

  const handleAddTeacher = () => {
    if (!onUpdateTeachers || !newTeacherData.name) return;
    const code = newTeacherData.code || `T${teachers.length + 1}`;
    const backupPaperIds =
      newTeacherData.backupPaperIds && newTeacherData.backupPaperIds.length > 0
        ? newTeacherData.backupPaperIds.filter(Boolean)
        : ['P02', 'P03'];
    const teacher: Teacher = {
      id: code,
      code,
      name: newTeacherData.name,
      designation: newTeacherData.designation || 'Training Instructor',
      assignedBuilding: newTeacherData.assignedBuilding || 'FLOATING',
      maxDailyPeriods: Number(newTeacherData.maxDailyPeriods) || 4,
      primaryPaperIds: newTeacherData.primaryPaperIds || ['P01'],
      backupPaperIds,
      secondaryPaperIds: backupPaperIds,
      phone: newTeacherData.phone || '',
      email: newTeacherData.email || '',
      status: (newTeacherData.status as any) || 'ACTIVE',
      qualification: newTeacherData.qualification || '',
      remarks: newTeacherData.remarks || '',
    };
    onUpdateTeachers([...teachers, teacher]);
    setIsAddingTeacher(false);
    setNewTeacherData({
      code: '',
      name: '',
      designation: 'Training Instructor',
      assignedBuilding: 'FLOATING',
      maxDailyPeriods: 4,
      primaryPaperIds: ['P01'],
      backupPaperIds: ['P02', 'P03'],
      secondaryPaperIds: ['P02', 'P03'],
      phone: '',
      email: '',
      status: 'ACTIVE',
      qualification: '',
      remarks: '',
    });
  };

  const handleDeleteTeacher = (teacherId: string) => {
    if (!onUpdateTeachers || teachers.length <= 1) return;
    if (window.confirm('Are you sure you want to delete this instructor?')) {
      onUpdateTeachers(teachers.filter((t) => t.id !== teacherId));
    }
  };

  const oldRooms = classrooms.filter((r) => r.building === 'OLD');
  const newRooms = classrooms.filter((r) => r.building === 'NEW');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Master Data Setup & Management
                </h2>
                {isAdmin ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Admin Editing Enabled
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                    Read-Only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {classrooms.length} Classrooms · {papers.length} Papers & Quotas · {teachers.length} Instructors
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-2 border-b border-slate-200 bg-white flex items-center gap-2">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'rooms'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Classrooms ({classrooms.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('papers')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'papers'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Papers & Target Quotas ({papers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('teachers')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'teachers'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Instructors ({teachers.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: CLASSROOMS & BUILDINGS */}
          {activeTab === 'rooms' && (
            <div className="space-y-6">
              {isAdmin && (
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <span className="text-xs text-slate-600 font-medium">
                    Manage academy buildings, classroom details, seating capacities, and add new training facilities.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsAddingBuilding(!isAddingBuilding);
                        setIsAddingRoom(false);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAddingBuilding ? 'Cancel' : 'Add New Building'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingRoom(!isAddingRoom);
                        setIsAddingBuilding(false);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAddingRoom ? 'Cancel' : 'Add Classroom'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Add Building Form */}
              {isAddingBuilding && (
                <div className="p-4 bg-slate-100 border border-slate-300 rounded-xl space-y-3 text-xs">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-indigo-700" />
                    <span>Register New Training Building</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Building Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Annex School Building"
                        value={newBuildingData.name || ''}
                        onChange={(e) => setNewBuildingData({ ...newBuildingData, name: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Building Code</label>
                      <input
                        type="text"
                        placeholder="e.g. AB or TB"
                        value={newBuildingData.code || ''}
                        onChange={(e) => setNewBuildingData({ ...newBuildingData, code: e.target.value.toUpperCase() })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Total Floors</label>
                      <input
                        type="number"
                        value={newBuildingData.floors || 2}
                        onChange={(e) => setNewBuildingData({ ...newBuildingData, floors: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Description / Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. 6 Classrooms, Capacity 60"
                        value={newBuildingData.description || ''}
                        onChange={(e) => setNewBuildingData({ ...newBuildingData, description: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setIsAddingBuilding(false)}
                      className="px-3 py-1 border border-slate-300 rounded text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddBuilding}
                      className="px-4 py-1 bg-slate-900 text-white rounded font-bold hover:bg-slate-800"
                    >
                      Save Building
                    </button>
                  </div>
                </div>
              )}

              {/* Add Room Form */}
              {isAddingRoom && (
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 text-xs">
                  <h4 className="font-bold text-indigo-900">Add New Classroom</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Room Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Room No. 9"
                        value={newRoomData.name || ''}
                        onChange={(e) => setNewRoomData({ ...newRoomData, name: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Building</label>
                      <select
                        value={newRoomData.building || buildings[0]?.id || 'OLD'}
                        onChange={(e) => setNewRoomData({ ...newRoomData, building: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        {buildings.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Floor</label>
                      <input
                        type="number"
                        value={newRoomData.floor || 1}
                        onChange={(e) => setNewRoomData({ ...newRoomData, floor: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Capacity (Recruits)</label>
                      <input
                        type="number"
                        value={newRoomData.capacity || 70}
                        onChange={(e) => setNewRoomData({ ...newRoomData, capacity: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setIsAddingRoom(false)}
                      className="px-3 py-1 border border-slate-300 rounded text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddRoom}
                      className="px-4 py-1 bg-indigo-600 text-white rounded font-bold"
                    >
                      Save Room
                    </button>
                  </div>
                </div>
              )}

              {/* Dynamic Buildings & Classrooms Sections */}
              {buildings.map((bldg) => {
                const bRooms = classrooms.filter((r) => r.building === bldg.id);
                return (
                  <div key={bldg.id} className="space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between pb-1.5 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                        <span className="font-bold text-slate-900">{bldg.name}</span>
                        <span className="text-slate-500 font-normal">({bRooms.length} Classrooms)</span>
                      </div>
                      <span className="text-[11px] font-mono text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded font-bold">
                        {bldg.description || `Building Code: ${bldg.code}`}
                      </span>
                    </h3>

                    {bRooms.length === 0 ? (
                      <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
                        No classrooms added to this building yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        {bRooms.map((r) => (
                          <div
                            key={r.id}
                            className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs flex flex-col justify-between"
                          >
                            {editingRoom?.id === r.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editingRoom.name}
                                  onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                                  className="w-full text-xs border rounded px-1.5 py-1 bg-white font-bold"
                                />
                                <div className="flex gap-1 text-[11px]">
                                  <input
                                    type="number"
                                    title="Capacity"
                                    value={editingRoom.capacity}
                                    onChange={(e) => setEditingRoom({ ...editingRoom, capacity: Number(e.target.value) })}
                                    className="w-16 border rounded px-1.5 py-0.5 bg-white font-mono"
                                  />
                                  <button
                                    onClick={() => handleSaveRoom(editingRoom)}
                                    className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingRoom(null)}
                                    className="px-1.5 py-0.5 border rounded text-[10px]"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between">
                                  <div className="font-bold text-slate-900 text-sm">{r.name}</div>
                                  {isAdmin && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => setEditingRoom(r)}
                                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                        title="Edit classroom"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteRoom(r.id)}
                                        className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                        title="Delete classroom"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-600 mt-2 font-mono flex items-center justify-between">
                                  <span>Floor {r.floor}</span>
                                  <span>
                                    Cap: <strong className="text-slate-900">{r.capacity}</strong>
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: PAPERS */}
          {activeTab === 'papers' && (
            <div className="space-y-4">
              {isAdmin && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs text-slate-600 font-medium">
                    Modify subject papers, quota targets, color codes, or add special training modules.
                  </span>
                  <button
                    onClick={() => setIsAddingPaper(!isAddingPaper)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingPaper ? 'Cancel' : 'Add Subject / Paper'}</span>
                  </button>
                </div>
              )}

              {/* Add Paper Form */}
              {isAddingPaper && (
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 text-xs">
                  <h4 className="font-bold text-indigo-900">Add New Subject Paper</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Code</label>
                      <input
                        type="text"
                        placeholder="e.g. Paper-14"
                        value={newPaperData.code || ''}
                        onChange={(e) => setNewPaperData({ ...newPaperData, code: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Traffic Management & Radar"
                        value={newPaperData.title || ''}
                        onChange={(e) => setNewPaperData({ ...newPaperData, title: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Category</label>
                      <select
                        value={newPaperData.category || 'Legal Studies'}
                        onChange={(e) => setNewPaperData({ ...newPaperData, category: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        <option value="Legal Studies">Legal Studies</option>
                        <option value="Forensics & Investigation">Forensics & Investigation</option>
                        <option value="Police Administration">Police Administration</option>
                        <option value="Behavioral & Ethics">Behavioral & Ethics</option>
                        <option value="Practical & Applied">Practical & Applied</option>
                        <option value="Special Police Ops">Special Police Ops</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Target Quota (Per Room)</label>
                      <input
                        type="number"
                        value={newPaperData.totalTargetSessions || 30}
                        onChange={(e) => setNewPaperData({ ...newPaperData, totalTargetSessions: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Curriculum Type</label>
                      <select
                        value={newPaperData.theoryOrPractical || 'THEORY'}
                        onChange={(e) => setNewPaperData({ ...newPaperData, theoryOrPractical: e.target.value as any })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        <option value="THEORY">Theory Subject</option>
                        <option value="PRACTICAL">Practical / Hands-On</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Max Daily / Room</label>
                      <select
                        value={newPaperData.maxDailyPerRoom || 2}
                        onChange={(e) => setNewPaperData({ ...newPaperData, maxDailyPerRoom: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        <option value="1">1 Period / Day</option>
                        <option value="2">2 Periods / Day (Standard)</option>
                        <option value="3">3 Periods / Day</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Badge Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={newPaperData.color || '#3B82F6'}
                          onChange={(e) => setNewPaperData({ ...newPaperData, color: e.target.value })}
                          className="h-8 w-12 rounded cursor-pointer border border-slate-300 p-0.5"
                        />
                        <input
                          type="text"
                          value={newPaperData.color || '#3B82F6'}
                          onChange={(e) => setNewPaperData({ ...newPaperData, color: e.target.value })}
                          className="flex-1 bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-xs uppercase"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Suitable Campus / Bldg</label>
                      <select
                        value={newPaperData.preferredBuilding || 'ALL'}
                        onChange={(e) => setNewPaperData({ ...newPaperData, preferredBuilding: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        <option value="ALL">All Buildings (Floating)</option>
                        <option value="OLD">Old School Building</option>
                        <option value="NEW">New School Building</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1 font-semibold">Syllabus Outline & Key Topics</label>
                    <input
                      type="text"
                      placeholder="e.g. Traffic Act, radar gun calibration, accident investigation reports..."
                      value={newPaperData.description || ''}
                      onChange={(e) => setNewPaperData({ ...newPaperData, description: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setIsAddingPaper(false)}
                      className="px-3 py-1 border border-slate-300 rounded text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddPaper}
                      className="px-4 py-1 bg-indigo-600 text-white rounded font-bold"
                    >
                      Save Paper
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {papers.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-2 flex flex-col justify-between"
                  >
                    {editingPaper?.id === p.id ? (
                      <div className="space-y-2.5 bg-indigo-50/60 p-3 rounded-lg border border-indigo-200">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700">Code</label>
                            <input
                              type="text"
                              value={editingPaper.code}
                              onChange={(e) => setEditingPaper({ ...editingPaper, code: e.target.value })}
                              className="w-full text-xs font-bold border rounded px-2 py-1 bg-white font-mono"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-slate-700">Title</label>
                            <input
                              type="text"
                              value={editingPaper.title}
                              onChange={(e) => setEditingPaper({ ...editingPaper, title: e.target.value })}
                              className="w-full text-xs font-bold border rounded px-2 py-1 bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700">Category</label>
                            <select
                              value={editingPaper.category || 'Legal Studies'}
                              onChange={(e) => setEditingPaper({ ...editingPaper, category: e.target.value })}
                              className="w-full text-xs border rounded px-1.5 py-1 bg-white"
                            >
                              <option value="Legal Studies">Legal Studies</option>
                              <option value="Forensics & Investigation">Forensics & Investigation</option>
                              <option value="Police Administration">Police Administration</option>
                              <option value="Behavioral & Ethics">Behavioral & Ethics</option>
                              <option value="Practical & Applied">Practical & Applied</option>
                              <option value="Special Police Ops">Special Police Ops</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700">Quota (Per Room)</label>
                            <input
                              type="number"
                              value={editingPaper.totalTargetSessions}
                              onChange={(e) => setEditingPaper({ ...editingPaper, totalTargetSessions: Number(e.target.value) })}
                              className="w-full text-xs border rounded px-2 py-1 bg-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700">Type</label>
                            <select
                              value={editingPaper.theoryOrPractical || 'THEORY'}
                              onChange={(e) => setEditingPaper({ ...editingPaper, theoryOrPractical: e.target.value as any })}
                              className="w-full text-xs border rounded px-1.5 py-1 bg-white"
                            >
                              <option value="THEORY">Theory</option>
                              <option value="PRACTICAL">Practical</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700">Badge Color</label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={editingPaper.color || '#3B82F6'}
                                onChange={(e) => setEditingPaper({ ...editingPaper, color: e.target.value })}
                                className="h-6 w-8 rounded cursor-pointer border p-0.5"
                              />
                              <input
                                type="text"
                                value={editingPaper.color || '#3B82F6'}
                                onChange={(e) => setEditingPaper({ ...editingPaper, color: e.target.value })}
                                className="w-16 text-[10px] border rounded px-1 py-1 bg-white font-mono uppercase"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-700">Syllabus Outline & Key Topics</label>
                          <input
                            type="text"
                            value={editingPaper.description || ''}
                            onChange={(e) => setEditingPaper({ ...editingPaper, description: e.target.value })}
                            className="w-full text-xs border rounded px-2 py-1 bg-white"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-1 border-t border-indigo-200">
                          <button
                            onClick={() => setEditingPaper(null)}
                            className="px-2.5 py-1 border rounded text-xs bg-white text-slate-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSavePaper(editingPaper)}
                            className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="px-2 py-0.5 rounded text-white font-mono font-bold text-[11px]"
                                style={{ backgroundColor: p.color }}
                              >
                                {p.code}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium uppercase">
                                {p.category}
                              </span>
                              {p.theoryOrPractical === 'PRACTICAL' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-lime-100 text-lime-800 border border-lime-200">
                                  Practical
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-indigo-700 font-mono tabular-nums">
                                Quota: {p.totalTargetSessions} sessions
                              </span>
                              {isAdmin && (
                                <div className="flex items-center ml-1">
                                  <button
                                    onClick={() => setEditingPaper(p)}
                                    className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                    title="Edit paper"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePaper(p.id)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                    title="Delete paper"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="font-bold text-slate-900 text-sm mt-1">{p.title}</div>
                          {p.description && (
                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                              {p.description}
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-600 pt-2 border-t border-slate-200 flex items-center justify-between">
                          <span>
                            <strong className="text-slate-700">Instructors:</strong>{' '}
                            {p.primaryTeacherIds.length > 0 ? (
                              p.primaryTeacherIds.join(', ')
                            ) : (
                              <span className="font-semibold text-lime-700">
                                All instructors eligible (Practical)
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-slate-500">
                            Max {p.maxDailyPerRoom || 2}/room/day
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: TEACHERS */}
          {activeTab === 'teachers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200">
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    Instructor Roster & Building Base Assignments
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Instructors are assigned to Old Building, New Building, or Floating across both.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      onClick={() => setIsAddingTeacher(!isAddingTeacher)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAddingTeacher ? 'Cancel' : 'Add Instructor'}</span>
                    </button>
                  )}
                  {onOpenTeacherMapping && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenTeacherMapping();
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                    >
                      Open Instructor Mapping Editor
                    </button>
                  )}
                </div>
              </div>

              {/* Add Teacher Form */}
              {isAddingTeacher && (
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 text-xs">
                  <h4 className="font-bold text-indigo-900">Add New Instructor</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">System Code</label>
                      <input
                        type="text"
                        placeholder="e.g. T27"
                        value={newTeacherData.code || ''}
                        onChange={(e) => setNewTeacherData({ ...newTeacherData, code: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Insp. Vikram Singh"
                        value={newTeacherData.name || ''}
                        onChange={(e) => setNewTeacherData({ ...newTeacherData, name: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Rank / Designation</label>
                      <input
                        type="text"
                        placeholder="e.g. Senior Law Instructor"
                        value={newTeacherData.designation || ''}
                        onChange={(e) => setNewTeacherData({ ...newTeacherData, designation: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Duty Status</label>
                      <select
                        value={newTeacherData.status || 'ACTIVE'}
                        onChange={(e) => setNewTeacherData({ ...newTeacherData, status: e.target.value as any })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        <option value="ACTIVE">Active on Duty</option>
                        <option value="LEAVE">On Leave / Absent</option>
                        <option value="DEPUTED">Deputed / Camp Duty</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Campus Base</label>
                      <select
                        value={newTeacherData.assignedBuilding || 'FLOATING'}
                        onChange={(e) => setNewTeacherData({ ...newTeacherData, assignedBuilding: e.target.value as any })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        <option value="FLOATING">Floating / Campus Wide</option>
                        <option value="OLD">Old School Building</option>
                        <option value="NEW">New School Building</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Max Daily Periods</label>
                      <input
                        type="number"
                        value={newTeacherData.maxDailyPeriods || 4}
                        onChange={(e) => setNewTeacherData({ ...newTeacherData, maxDailyPeriods: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Phone / Mobile</label>
                      <input
                        type="text"
                        placeholder="+91 94120 10001"
                        value={newTeacherData.phone || ''}
                        onChange={(e) => setNewTeacherData({ ...newTeacherData, phone: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1 font-semibold">Email / Official ID</label>
                      <input
                        type="text"
                        placeholder="instructor@stc.police.gov.in"
                        value={newTeacherData.email || ''}
                        onChange={(e) => setNewTeacherData({ ...newTeacherData, email: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1 font-semibold">Specialization & Qualification</label>
                    <input
                      type="text"
                      placeholder="e.g. Certified Ballistics & Cyber Forensics Specialist, LL.M (Criminal Law)"
                      value={newTeacherData.qualification || ''}
                      onChange={(e) => setNewTeacherData({ ...newTeacherData, qualification: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>

                  {/* Main & Backup Subject Selectors (At least 2 Backup Options, 100% Floating) */}
                  <div className="space-y-2 pt-1 border-t border-indigo-200/60">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-indigo-900 mb-1 font-bold">
                          Main Subject (Primary)
                        </label>
                        <select
                          value={newTeacherData.primaryPaperIds?.[0] || 'P01'}
                          onChange={(e) =>
                            setNewTeacherData({
                              ...newTeacherData,
                              primaryPaperIds: [e.target.value],
                            })
                          }
                          className="w-full bg-white border border-indigo-300 rounded px-2.5 py-1.5 font-medium"
                        >
                          {papers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code}: {p.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-emerald-900 mb-1 font-bold">
                          Backup Subject 1 (Floating)
                        </label>
                        <select
                          value={newTeacherData.backupPaperIds?.[0] || 'P02'}
                          onChange={(e) => {
                            const val = e.target.value;
                            const b2 = newTeacherData.backupPaperIds?.[1] || '';
                            const bList = [val, b2].filter(Boolean);
                            setNewTeacherData({
                              ...newTeacherData,
                              backupPaperIds: bList,
                              secondaryPaperIds: bList,
                            });
                          }}
                          className="w-full bg-white border border-emerald-300 rounded px-2.5 py-1.5 font-medium"
                        >
                          <option value="">-- None / General Reserve --</option>
                          {papers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code}: {p.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-teal-900 mb-1 font-bold">
                          Backup Subject 2 (Floating)
                        </label>
                        <select
                          value={newTeacherData.backupPaperIds?.[1] || 'P03'}
                          onChange={(e) => {
                            const val = e.target.value;
                            const b1 = newTeacherData.backupPaperIds?.[0] || 'P02';
                            const bList = [b1, val].filter(Boolean);
                            setNewTeacherData({
                              ...newTeacherData,
                              backupPaperIds: bList,
                              secondaryPaperIds: bList,
                            });
                          }}
                          className="w-full bg-white border border-teal-300 rounded px-2.5 py-1.5 font-medium"
                        >
                          <option value="">-- None / General Reserve --</option>
                          {papers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code}: {p.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="text-[10px] text-emerald-700 italic">
                      * Note: Backup subjects operate with ZERO building restrictions (100% Floating across Old & New Buildings).
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setIsAddingTeacher(false)}
                      className="px-3 py-1 border border-slate-300 rounded text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddTeacher}
                      className="px-4 py-1 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700"
                    >
                      Save Instructor
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {teachers.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-2 flex flex-col justify-between"
                  >
                    {editingTeacher?.id === t.id ? (
                      <div className="space-y-2 bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-200">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700">Full Name</label>
                            <input
                              type="text"
                              value={editingTeacher.name}
                              onChange={(e) => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                              className="w-full text-xs font-bold border rounded px-2 py-1 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700">Rank / Designation</label>
                            <input
                              type="text"
                              value={editingTeacher.designation || ''}
                              onChange={(e) => setEditingTeacher({ ...editingTeacher, designation: e.target.value })}
                              className="w-full text-xs border rounded px-2 py-1 bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700">Campus Base</label>
                            <select
                              value={editingTeacher.assignedBuilding}
                              onChange={(e) => setEditingTeacher({ ...editingTeacher, assignedBuilding: e.target.value as any })}
                              className="w-full text-xs border rounded px-1.5 py-1 bg-white"
                            >
                              <option value="FLOATING">Floating</option>
                              <option value="OLD">Old Bldg</option>
                              <option value="NEW">New Bldg</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700">Duty Status</label>
                            <select
                              value={editingTeacher.status || 'ACTIVE'}
                              onChange={(e) => setEditingTeacher({ ...editingTeacher, status: e.target.value as any })}
                              className="w-full text-xs border rounded px-1.5 py-1 bg-white"
                            >
                              <option value="ACTIVE">Active on Duty</option>
                              <option value="LEAVE">On Leave</option>
                              <option value="DEPUTED">Deputed / Camp</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700">Max Periods</label>
                            <input
                              type="number"
                              title="Max periods"
                              value={editingTeacher.maxDailyPeriods}
                              onChange={(e) => setEditingTeacher({ ...editingTeacher, maxDailyPeriods: Number(e.target.value) })}
                              className="w-full text-xs border rounded px-1.5 py-1 bg-white font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700">Phone</label>
                            <input
                              type="text"
                              value={editingTeacher.phone || ''}
                              onChange={(e) => setEditingTeacher({ ...editingTeacher, phone: e.target.value })}
                              className="w-full text-xs border rounded px-1.5 py-1 bg-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700">Email ID</label>
                            <input
                              type="text"
                              value={editingTeacher.email || ''}
                              onChange={(e) => setEditingTeacher({ ...editingTeacher, email: e.target.value })}
                              className="w-full text-xs border rounded px-1.5 py-1 bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-700">Specialization & Notes</label>
                          <input
                            type="text"
                            value={editingTeacher.qualification || editingTeacher.remarks || ''}
                            onChange={(e) => setEditingTeacher({ ...editingTeacher, qualification: e.target.value, remarks: e.target.value })}
                            className="w-full text-xs border rounded px-2 py-1 bg-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-indigo-900 block mb-0.5">
                            Main Subject (Primary Paper)
                          </label>
                          <select
                            value={editingTeacher.primaryPaperIds[0] || 'P01'}
                            onChange={(e) =>
                              setEditingTeacher({
                                ...editingTeacher,
                                primaryPaperIds: [e.target.value],
                              })
                            }
                            className="w-full text-xs border border-indigo-300 rounded px-1.5 py-1 bg-white font-semibold text-indigo-950"
                          >
                            {papers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.code}: {p.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-emerald-900 block mb-0.5">
                              Backup 1 (Floating)
                            </label>
                            <select
                              value={editingTeacher.backupPaperIds?.[0] || editingTeacher.secondaryPaperIds?.[0] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const b2 = editingTeacher.backupPaperIds?.[1] || editingTeacher.secondaryPaperIds?.[1] || '';
                                const bList = [val, b2].filter(Boolean);
                                setEditingTeacher({
                                  ...editingTeacher,
                                  backupPaperIds: bList,
                                  secondaryPaperIds: bList,
                                });
                              }}
                              className="w-full text-xs border border-emerald-300 rounded px-1 py-1 bg-white font-semibold text-emerald-950"
                            >
                              <option value="">-- None --</option>
                              {papers.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.code}: {p.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-teal-900 block mb-0.5">
                              Backup 2 (Floating)
                            </label>
                            <select
                              value={editingTeacher.backupPaperIds?.[1] || editingTeacher.secondaryPaperIds?.[1] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const b1 = editingTeacher.backupPaperIds?.[0] || editingTeacher.secondaryPaperIds?.[0] || '';
                                const bList = [b1, val].filter(Boolean);
                                setEditingTeacher({
                                  ...editingTeacher,
                                  backupPaperIds: bList,
                                  secondaryPaperIds: bList,
                                });
                              }}
                              className="w-full text-xs border border-teal-300 rounded px-1 py-1 bg-white font-semibold text-teal-950"
                            >
                              <option value="">-- None --</option>
                              {papers.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.code}: {p.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="text-[9px] text-emerald-700 italic">
                          * Backups act as 100% Floating across campus (Old & New Bldgs).
                        </div>

                        <div className="flex justify-end gap-2 pt-1 border-t border-indigo-200">
                          <button
                            onClick={() => setEditingTeacher(null)}
                            className="px-2.5 py-1 border border-slate-300 rounded text-[11px] text-slate-700 bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveTeacher(editingTeacher)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-indigo-700 font-bold bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200">
                                {t.code}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  t.status === 'LEAVE'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : t.status === 'DEPUTED'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {t.status === 'LEAVE' ? 'On Leave' : t.status === 'DEPUTED' ? 'Deputed' : 'Active'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500">Max {t.maxDailyPeriods} / day</span>
                              {isAdmin && (
                                <div className="flex items-center ml-1">
                                  <button
                                    onClick={() => setEditingTeacher(t)}
                                    className="p-0.5 text-indigo-600 hover:bg-indigo-50 rounded"
                                    title="Edit instructor subjects & details"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTeacher(t.id)}
                                    className="p-0.5 text-rose-600 hover:bg-rose-50 rounded"
                                    title="Delete teacher"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mt-1">
                            <span className="truncate">{t.name}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded font-bold text-[10px] shrink-0 ml-1 ${
                                t.assignedBuilding === 'OLD'
                                  ? 'bg-amber-100 text-amber-900'
                                  : t.assignedBuilding === 'NEW'
                                  ? 'bg-sky-100 text-sky-900'
                                  : 'bg-purple-100 text-purple-900'
                              }`}
                            >
                              {t.assignedBuilding === 'OLD'
                                ? 'Old Bldg'
                                : t.assignedBuilding === 'NEW'
                                ? 'New Bldg'
                                : 'Floating'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{t.designation}</p>
                          {t.phone && (
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                              📞 {t.phone} {t.email ? `• ✉️ ${t.email}` : ''}
                            </div>
                          )}
                        </div>

                        {/* Subject Mapping Displays */}
                        <div className="space-y-1 pt-1.5 border-t border-slate-200 text-[10px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Main Subject:</span>
                            <span className="font-bold text-indigo-700 truncate max-w-[170px]">
                              {t.primaryPaperIds
                                .map((pid) => {
                                  const p = papers.find((x) => x.id === pid);
                                  return p ? `${p.code} (${p.title})` : pid;
                                })
                                .join(', ') || 'General'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Backup 1 (Floating):</span>
                            <span className="font-bold text-emerald-700 truncate max-w-[170px]">
                              {(() => {
                                const b1 = (t.backupPaperIds && t.backupPaperIds[0]) || (t.secondaryPaperIds && t.secondaryPaperIds[0]);
                                if (!b1) return 'None';
                                const p = papers.find((x) => x.id === b1);
                                return p ? `${p.code} (${p.title})` : b1;
                              })()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Backup 2 (Floating):</span>
                            <span className="font-bold text-teal-700 truncate max-w-[170px]">
                              {(() => {
                                const b2 = (t.backupPaperIds && t.backupPaperIds[1]) || (t.secondaryPaperIds && t.secondaryPaperIds[1]);
                                if (!b2) return 'None';
                                const p = papers.find((x) => x.id === b2);
                                return p ? `${p.code} (${p.title})` : b2;
                              })()}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {isAdmin ? 'All changes persist automatically to database and routine engine.' : 'Master configuration preview.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
