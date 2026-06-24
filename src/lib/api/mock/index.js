// In-memory mock backend persisted to localStorage so data survives the hard-reload
// navigation of the MPA (create a payment, then see the balance update on the next page).
// Mirrors the API contract in PLAN.md. Throws ApiError for 4xx-style failures.

import { ApiError } from '../errors.js';
import { seedData } from './fixtures.js';
import { semesterCost, remaining as calcRemaining, isFullyPaid, sum, round2 } from '../../money.js';
import { getCurrentUser } from '../../auth.js';

const DB_KEY = 'hefs_mock_db';
const DB_VERSION = 2; // bump to force a re-seed after fixture changes

function saveData(data) {
  localStorage.setItem(DB_KEY, JSON.stringify({ __v: DB_VERSION, data }));
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.__v === DB_VERSION) return parsed.data;
    }
  } catch {
    /* fall through to re-seed */
  }
  const fresh = seedData();
  saveData(fresh);
  return fresh;
}

export function resetMockDb() {
  localStorage.removeItem(DB_KEY);
}

// ---------- helpers ----------
const byId = (arr, id) => arr.find((x) => String(x.id) === String(id));
const majorName = (db, id) => byId(db.majors, id)?.name || '';
const semName = (db, id) => byId(db.semesters, id)?.name || '';
const empName = (db, id) => byId(db.employees, id)?.full_name || '';

function enrollmentTotals(db, enr) {
  const cost = semesterCost(enr);
  const paid = sum(
    db.payments
      .filter((p) => String(p.student_id) === String(enr.student_id) && String(p.semester_id) === String(enr.semester_id))
      .map((p) => p.amount_paid),
  );
  return { cost, paid, remaining: calcRemaining(cost, paid), fully_paid: isFullyPaid(cost, paid) };
}

function buildReceipt(db, payment) {
  const student = byId(db.students, payment.student_id);
  const enr = db.enrollments.find(
    (e) => String(e.student_id) === String(payment.student_id) && String(e.semester_id) === String(payment.semester_id),
  );
  const totals = enr ? enrollmentTotals(db, enr) : { cost: 0, paid: payment.amount_paid, remaining: 0, fully_paid: true };
  return {
    receipt_id: payment.id,
    receipt_no: payment.receipt_no,
    student_id: payment.student_id,
    university_id: student?.university_id || '',
    student_name: student?.full_name || '',
    major: student ? majorName(db, student.major_id) : '',
    semester_id: payment.semester_id,
    semester: semName(db, payment.semester_id),
    amount_paid: payment.amount_paid,
    total_cost: totals.cost,
    total_paid: totals.paid,
    remaining: totals.remaining,
    is_fully_paid: totals.fully_paid,
    payment_method: payment.payment_method,
    notes: payment.notes || '',
    timestamp: payment.timestamp,
    employee_name: empName(db, payment.created_by),
  };
}

function ymd(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildReport(db, from, to, label) {
  const fromT = from ? new Date(`${from}T00:00:00`) : null;
  const toT = to ? new Date(`${to}T23:59:59`) : null;
  const rows = db.payments
    .filter((p) => {
      const d = new Date(p.timestamp);
      if (fromT && d < fromT) return false;
      if (toT && d > toT) return false;
      return true;
    })
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((p) => ({
      receipt_no: p.receipt_no,
      student_name: byId(db.students, p.student_id)?.full_name || '',
      university_id: byId(db.students, p.student_id)?.university_id || '',
      semester: semName(db, p.semester_id),
      payment_method: p.payment_method,
      amount: p.amount_paid,
      employee_name: empName(db, p.created_by),
      timestamp: p.timestamp,
    }));
  return { range_label: label, from: from || null, to: to || null, count: rows.length, total: sum(rows.map((r) => r.amount)), rows };
}

// ---------- handlers ----------
function login(ctx) {
  const { username, password } = ctx.body || {};
  if (!username || !password) throw new ApiError(400, 'يرجى إدخال اسم المستخدم وكلمة المرور.');
  const emp = ctx.db.employees.find((e) => e.username === String(username).trim());
  if (!emp) throw new ApiError(401, 'بيانات الدخول غير صحيحة.');
  // Mock: any non-empty password is accepted for an existing username.
  return {
    access_token: `mock.${emp.id}.${Date.now()}`,
    token_type: 'bearer',
    employee: { id: emp.id, full_name: emp.full_name, username: emp.username, role: emp.role },
  };
}

function listStudents(ctx) {
  const { search = '', major_id = '' } = ctx.query || {};
  let items = ctx.db.students.map((s) => ({ ...s, major_name: majorName(ctx.db, s.major_id) }));
  const q = String(search).trim().toLowerCase();
  if (q) items = items.filter((s) => s.full_name.toLowerCase().includes(q) || String(s.university_id).includes(q));
  if (major_id) items = items.filter((s) => String(s.major_id) === String(major_id));
  return items;
}

function createStudent(ctx) {
  const b = ctx.body || {};
  if (!b.full_name || !String(b.full_name).trim()) throw new ApiError(422, 'الاسم الكامل مطلوب.');
  if (!b.major_id) throw new ApiError(422, 'يجب اختيار التخصص.');
  if (!byId(ctx.db.majors, b.major_id)) throw new ApiError(422, 'التخصص المحدّد غير موجود.');
  const id = ++ctx.db.counters.student;
  const university_id = `${new Date().getFullYear()}${String(id).padStart(5, '0')}`;
  const student = {
    id,
    university_id,
    full_name: String(b.full_name).trim(),
    major_id: Number(b.major_id),
    phone: b.phone || null,
    email: b.email || null,
    address: b.address || null,
  };
  ctx.db.students.push(student);
  ctx.save();
  return { ...student, major_name: majorName(ctx.db, student.major_id) };
}

function getStudent(ctx) {
  const s = byId(ctx.db.students, ctx.params.id);
  if (!s) throw new ApiError(404, 'الطالب غير موجود.');
  return { ...s, major_name: majorName(ctx.db, s.major_id) };
}

function updateStudent(ctx) {
  const s = byId(ctx.db.students, ctx.params.id);
  if (!s) throw new ApiError(404, 'الطالب غير موجود.');
  const b = ctx.body || {};
  for (const k of ['full_name', 'major_id', 'phone', 'email', 'address']) {
    if (k in b) s[k] = k === 'major_id' ? Number(b[k]) : b[k];
  }
  ctx.save();
  return { ...s, major_name: majorName(ctx.db, s.major_id) };
}

function studentSummary(ctx) {
  const s = byId(ctx.db.students, ctx.params.id);
  if (!s) throw new ApiError(404, 'الطالب غير موجود.');
  const enrs = ctx.db.enrollments
    .filter((e) => String(e.student_id) === String(s.id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const semesters = enrs.map((e) => {
    const t = enrollmentTotals(ctx.db, e);
    // id of the most recent payment for this student+semester (for receipt reprint)
    const lastPayment = ctx.db.payments
      .filter((p) => String(p.student_id) === String(s.id) && String(p.semester_id) === String(e.semester_id))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    return {
      enrollment_id: e.id,
      semester_id: e.semester_id,
      semester_name: semName(ctx.db, e.semester_id),
      status: e.status,
      courses_count: e.courses_count,
      course_price: e.snapshot_course_price,
      base_fee: e.snapshot_base_fee,
      total_cost: t.cost,
      total_paid: t.paid,
      remaining: t.remaining,
      is_fully_paid: t.fully_paid,
      last_payment_id: lastPayment?.id ?? null,
    };
  });
  const totals = {
    total_cost: sum(semesters.map((x) => x.total_cost)),
    total_paid: sum(semesters.map((x) => x.total_paid)),
    balance: sum(semesters.map((x) => x.remaining)),
  };
  const current = semesters.find((x) => x.status === 'Active') || semesters[0] || null;
  return { student: { ...s, major_name: majorName(ctx.db, s.major_id) }, semesters, totals, current };
}

function enroll(ctx) {
  const b = ctx.body || {};
  const student = byId(ctx.db.students, b.student_id);
  if (!student) throw new ApiError(404, 'الطالب غير موجود.');
  const semester = byId(ctx.db.semesters, b.semester_id);
  if (!semester) throw new ApiError(422, 'الفصل الدراسي غير موجود.');
  const courses = Number(b.courses_count || 0);
  if (!Number.isInteger(courses) || courses <= 0) throw new ApiError(422, 'عدد المقررات يجب أن يكون رقمًا صحيحًا أكبر من صفر.');
  if (ctx.db.enrollments.some((e) => String(e.student_id) === String(student.id) && String(e.semester_id) === String(semester.id))) {
    throw new ApiError(409, 'الطالب مسجّل بالفعل في هذا الفصل الدراسي.');
  }
  // Debt verification: block enrollment if any previous semester is unpaid (DRD §9).
  const unpaid = [];
  for (const e of ctx.db.enrollments.filter((e) => String(e.student_id) === String(student.id))) {
    const t = enrollmentTotals(ctx.db, e);
    if (t.remaining > 0) unpaid.push({ semester_name: semName(ctx.db, e.semester_id), remaining: t.remaining });
  }
  if (unpaid.length) {
    const total = sum(unpaid.map((u) => u.remaining));
    throw new ApiError(409, `لا يمكن بدء فصل جديد: يوجد رصيد غير مسدّد بقيمة ${total} على فصول سابقة.`, { unpaid, total });
  }
  const major = byId(ctx.db.majors, student.major_id);
  const id = ++ctx.db.counters.enrollment;
  const enr = {
    id,
    student_id: student.id,
    semester_id: semester.id,
    major_id: student.major_id,
    courses_count: courses,
    snapshot_course_price: major?.price_per_course || 0,
    snapshot_base_fee: major?.semester_base_fee || 0,
    status: 'Active',
    created_at: new Date().toISOString(),
  };
  ctx.db.enrollments.push(enr);
  ctx.save();
  const cost = semesterCost(enr);
  return {
    enrollment: { ...enr, semester_name: semName(ctx.db, semester.id) },
    totals: { total_cost: cost, total_paid: 0, remaining: cost, is_fully_paid: false },
  };
}

function createPayment(ctx) {
  const b = ctx.body || {};
  const student = byId(ctx.db.students, b.student_id);
  if (!student) throw new ApiError(404, 'الطالب غير موجود.');
  const enr = ctx.db.enrollments.find(
    (e) => String(e.student_id) === String(b.student_id) && String(e.semester_id) === String(b.semester_id),
  );
  if (!enr) throw new ApiError(422, 'لا يوجد تسجيل لهذا الطالب في هذا الفصل الدراسي.');
  const amount = Number(b.amount_paid);
  if (!(amount > 0)) throw new ApiError(422, 'قيمة الدفعة غير صالحة.');
  const t = enrollmentTotals(ctx.db, enr);
  if (amount > t.remaining + 1e-9) {
    throw new ApiError(422, `المبلغ يتجاوز الرصيد المتبقّي (${t.remaining}).`, { remaining: t.remaining });
  }
  const user = getCurrentUser();
  const id = ++ctx.db.counters.payment;
  const receipt_no = ++ctx.db.counters.receipt;
  const payment = {
    id,
    student_id: student.id,
    semester_id: enr.semester_id,
    amount_paid: round2(amount),
    payment_method: b.payment_method || 'نقدًا',
    notes: b.notes || null,
    created_by: user?.id || 3,
    timestamp: new Date().toISOString(),
    receipt_no,
  };
  ctx.db.payments.push(payment);
  ctx.save();
  return { payment, receipt: buildReceipt(ctx.db, payment) };
}

function getReceipt(ctx) {
  const p = ctx.db.payments.find((x) => String(x.id) === String(ctx.params.id) || String(x.receipt_no) === String(ctx.params.id));
  if (!p) throw new ApiError(404, 'الإيصال غير موجود.');
  return buildReceipt(ctx.db, p);
}

// ----- majors -----
function listMajors(ctx) {
  return ctx.db.majors;
}
function createMajor(ctx) {
  const b = ctx.body || {};
  if (!b.name || !String(b.name).trim()) throw new ApiError(422, 'اسم التخصص مطلوب.');
  const major = {
    id: ++ctx.db.counters.major,
    name: String(b.name).trim(),
    price_per_course: round2(b.price_per_course || 0),
    semester_base_fee: round2(b.semester_base_fee || 0),
    courses_count: Math.max(0, Math.trunc(Number(b.courses_count) || 0)),
  };
  ctx.db.majors.push(major);
  ctx.save();
  return major;
}
function updateMajor(ctx) {
  const m = byId(ctx.db.majors, ctx.params.id);
  if (!m) throw new ApiError(404, 'التخصص غير موجود.');
  const b = ctx.body || {};
  if ('name' in b) m.name = String(b.name).trim();
  if ('price_per_course' in b) m.price_per_course = round2(b.price_per_course);
  if ('semester_base_fee' in b) m.semester_base_fee = round2(b.semester_base_fee);
  if ('courses_count' in b) m.courses_count = Math.max(0, Math.trunc(Number(b.courses_count) || 0));
  ctx.save();
  return m;
}
function deleteMajor(ctx) {
  const m = byId(ctx.db.majors, ctx.params.id);
  if (!m) throw new ApiError(404, 'التخصص غير موجود.');
  if (ctx.db.students.some((s) => String(s.major_id) === String(m.id))) {
    throw new ApiError(409, 'لا يمكن حذف تخصص مرتبط بطلاب.');
  }
  ctx.db.majors = ctx.db.majors.filter((x) => x.id !== m.id);
  ctx.save();
  return { ok: true };
}

// ----- semesters -----
function listSemesters(ctx) {
  return ctx.db.semesters;
}
function validateSemesterDates(b) {
  if (!b.name || !String(b.name).trim()) throw new ApiError(422, 'اسم الفصل مطلوب.');
  if (!b.start_date || !b.end_date) throw new ApiError(422, 'تاريخا البداية والنهاية مطلوبان.');
  if (new Date(b.end_date) <= new Date(b.start_date)) throw new ApiError(422, 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.');
}
function createSemester(ctx) {
  const b = ctx.body || {};
  validateSemesterDates(b);
  if (ctx.db.semesters.some((s) => s.name === String(b.name).trim())) throw new ApiError(409, 'يوجد فصل بنفس الاسم.');
  const semester = {
    id: ++ctx.db.counters.semester,
    name: String(b.name).trim(),
    start_date: b.start_date,
    end_date: b.end_date,
    is_active: Boolean(b.is_active),
  };
  if (semester.is_active) ctx.db.semesters.forEach((s) => (s.is_active = false));
  ctx.db.semesters.push(semester);
  ctx.save();
  return semester;
}
function updateSemester(ctx) {
  const s = byId(ctx.db.semesters, ctx.params.id);
  if (!s) throw new ApiError(404, 'الفصل غير موجود.');
  const b = { ...s, ...ctx.body };
  validateSemesterDates(b);
  if ('name' in ctx.body) s.name = String(ctx.body.name).trim();
  if ('start_date' in ctx.body) s.start_date = ctx.body.start_date;
  if ('end_date' in ctx.body) s.end_date = ctx.body.end_date;
  if ('is_active' in ctx.body) {
    s.is_active = Boolean(ctx.body.is_active);
    if (s.is_active) ctx.db.semesters.forEach((x) => { if (x.id !== s.id) x.is_active = false; });
  }
  ctx.save();
  return s;
}
function deleteSemester(ctx) {
  const s = byId(ctx.db.semesters, ctx.params.id);
  if (!s) throw new ApiError(404, 'الفصل غير موجود.');
  if (ctx.db.enrollments.some((e) => String(e.semester_id) === String(s.id))) {
    throw new ApiError(409, 'لا يمكن حذف فصل يحتوي على تسجيلات.');
  }
  ctx.db.semesters = ctx.db.semesters.filter((x) => x.id !== s.id);
  ctx.save();
  return { ok: true };
}

// ----- employees -----
function listEmployees(ctx) {
  return ctx.db.employees;
}
function createEmployee(ctx) {
  const b = ctx.body || {};
  if (!b.full_name || !String(b.full_name).trim()) throw new ApiError(422, 'الاسم الكامل مطلوب.');
  if (!b.username || !String(b.username).trim()) throw new ApiError(422, 'اسم المستخدم مطلوب.');
  if (!['employee', 'manager', 'superadmin'].includes(b.role)) throw new ApiError(422, 'الدور غير صالح.');
  if (ctx.db.employees.some((e) => e.username === String(b.username).trim())) throw new ApiError(409, 'اسم المستخدم مستخدم بالفعل.');
  const employee = {
    id: ++ctx.db.counters.employee,
    full_name: String(b.full_name).trim(),
    username: String(b.username).trim(),
    role: b.role,
    phone: b.phone || null,
  };
  ctx.db.employees.push(employee);
  ctx.save();
  return employee;
}
function updateEmployee(ctx) {
  const e = byId(ctx.db.employees, ctx.params.id);
  if (!e) throw new ApiError(404, 'الموظف غير موجود.');
  const b = ctx.body || {};
  if ('full_name' in b) e.full_name = String(b.full_name).trim();
  if ('phone' in b) e.phone = b.phone || null;
  if ('role' in b) {
    if (e.role === 'superadmin') throw new ApiError(403, 'لا يمكن تغيير دور مسؤول النظام المتميّز.');
    if (!['employee', 'manager', 'superadmin'].includes(b.role)) throw new ApiError(422, 'الدور غير صالح.');
    e.role = b.role;
  }
  ctx.save();
  return e;
}
function deleteEmployee(ctx) {
  const e = byId(ctx.db.employees, ctx.params.id);
  if (!e) throw new ApiError(404, 'الموظف غير موجود.');
  if (e.role === 'superadmin') throw new ApiError(403, 'لا يمكن حذف مسؤول النظام المتميّز.');
  ctx.db.employees = ctx.db.employees.filter((x) => x.id !== e.id);
  ctx.save();
  return { ok: true };
}
function resetEmployeePassword(ctx) {
  const e = byId(ctx.db.employees, ctx.params.id);
  if (!e) throw new ApiError(404, 'الموظف غير موجود.');
  const pwd = ctx.body?.password;
  if (pwd !== undefined && String(pwd).length < 4) throw new ApiError(422, 'كلمة المرور يجب ألا تقل عن 4 أحرف.');
  // Mock: passwords aren't persisted here — the backend will hash & store.
  return { ok: true, message: 'تم تحديث كلمة المرور.' };
}

// ----- reports -----
function rangeFromTo(daysBack) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  return { from: ymd(from), to: ymd(to) };
}
function reportDaily(ctx) {
  const today = ymd(new Date());
  return buildReport(ctx.db, today, today, 'يومي');
}
function reportWeekly(ctx) {
  const { from, to } = rangeFromTo(6);
  return buildReport(ctx.db, from, to, 'أسبوعي');
}
function reportMonthly(ctx) {
  const { from, to } = rangeFromTo(29);
  return buildReport(ctx.db, from, to, 'شهري');
}
function reportCustom(ctx) {
  const { from = '', to = '' } = ctx.query || {};
  if (!from || !to) throw new ApiError(422, 'يرجى تحديد تاريخي البداية والنهاية.');
  return buildReport(ctx.db, from, to, 'مخصّص');
}

// ---------- route table ----------
const routes = [
  ['POST', '/auth/login', login],
  ['GET', '/students', listStudents],
  ['POST', '/students', createStudent],
  ['POST', '/students/enroll', enroll],
  ['GET', '/students/:id', getStudent],
  ['PUT', '/students/:id', updateStudent],
  ['GET', '/students/:id/summary', studentSummary],
  ['POST', '/payments', createPayment],
  ['GET', '/transactions/:id', getReceipt],
  ['GET', '/majors', listMajors],
  ['POST', '/majors', createMajor],
  ['PUT', '/majors/:id', updateMajor],
  ['DELETE', '/majors/:id', deleteMajor],
  ['GET', '/semesters', listSemesters],
  ['POST', '/semesters', createSemester],
  ['PUT', '/semesters/:id', updateSemester],
  ['DELETE', '/semesters/:id', deleteSemester],
  ['GET', '/employees', listEmployees],
  ['POST', '/employees', createEmployee],
  ['PUT', '/employees/:id', updateEmployee],
  ['DELETE', '/employees/:id', deleteEmployee],
  ['POST', '/employees/:id/reset-password', resetEmployeePassword],
  ['GET', '/reports/daily', reportDaily],
  ['GET', '/reports/weekly', reportWeekly],
  ['GET', '/reports/monthly', reportMonthly],
  ['GET', '/reports', reportCustom],
];

function matchPath(pattern, path) {
  const pp = pattern.split('/').filter(Boolean);
  const xp = path.split('/').filter(Boolean);
  if (pp.length !== xp.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(xp[i]);
    else if (pp[i] !== xp[i]) return null;
  }
  return params;
}

const delay = () => new Promise((resolve) => setTimeout(resolve, 120));

export async function dispatch(method, path, { params = {}, body } = {}) {
  await delay();
  const db = loadDb();
  const ctx = { db, query: params, body, params: {}, save: () => saveData(db) };
  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue;
    const pathParams = matchPath(pattern, path);
    if (pathParams) {
      ctx.params = pathParams;
      return handler(ctx);
    }
  }
  throw new ApiError(404, `لا يوجد مسار مطابق: ${method} ${path}`);
}
