// Typed-by-convention API surface. Pages import ONLY from here, never call fetch
// directly. This is the single file to align with the backend's real paths/prefix
// (e.g. if FastAPI serves everything under /api/v1, add it here or in apiBaseUrl).

import { call } from './client.js';

// ----- auth -----
export const login = (username, password) => call('POST', '/auth/login', { body: { username, password } });

// ----- students -----
export const searchStudents = (query = {}) => call('GET', '/students', { params: query });
export const createStudent = (body) => call('POST', '/students', { body });
export const getStudent = (id) => call('GET', `/students/${id}`);
export const updateStudent = (id, body) => call('PUT', `/students/${id}`, { body });
export const getStudentSummary = (id) => call('GET', `/students/${id}/summary`);
export const enrollStudent = (body) => call('POST', '/students/enroll', { body });

// ----- payments / receipts -----
export const createPayment = (body) => call('POST', '/payments', { body });
export const getReceipt = (receiptId) => call('GET', `/transactions/${receiptId}`);

// ----- majors -----
export const listMajors = () => call('GET', '/majors');
export const createMajor = (body) => call('POST', '/majors', { body });
export const updateMajor = (id, body) => call('PUT', `/majors/${id}`, { body });
export const deleteMajor = (id) => call('DELETE', `/majors/${id}`);

// ----- semesters -----
export const listSemesters = () => call('GET', '/semesters');
export const createSemester = (body) => call('POST', '/semesters', { body });
export const updateSemester = (id, body) => call('PUT', `/semesters/${id}`, { body });
export const deleteSemester = (id) => call('DELETE', `/semesters/${id}`);

// ----- employees (staff) -----
export const listEmployees = () => call('GET', '/employees');
export const createEmployee = (body) => call('POST', '/employees', { body });
export const updateEmployee = (id, body) => call('PUT', `/employees/${id}`, { body });
export const deleteEmployee = (id) => call('DELETE', `/employees/${id}`);
export const resetEmployeePassword = (id, body = {}) => call('POST', `/employees/${id}/reset-password`, { body });

// ----- reports -----
// range: 'daily' | 'weekly' | 'monthly' | 'custom'
export const getReport = (range, params = {}) =>
  range === 'custom' ? call('GET', '/reports', { params }) : call('GET', `/reports/${range}`);
