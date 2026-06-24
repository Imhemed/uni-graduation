// Seed data for the mock API. Returned fresh by seedData() with payment/enrollment
// dates computed RELATIVE TO NOW, so the daily/weekly/monthly reports always have
// data regardless of the machine clock.
//
// Coherent sample (matches the screenshots where possible):
//   أحمد علي (CS, 6 courses) → 6×200 + 150 = 1350, paid 1000 → 350 remaining (74%).

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export function seedData() {
  return {
    counters: { student: 5, enrollment: 3, payment: 4, receipt: 99824, major: 3, semester: 3, employee: 3 },

    employees: [
      { id: 1, full_name: 'مسؤول النظام', username: 'root_admin', role: 'superadmin', phone: '0910000000' },
      { id: 2, full_name: 'سارة جينكينز', username: 'sjenkins_fin', role: 'manager', phone: '0911111111' },
      { id: 3, full_name: 'محمد سالم', username: 'msalem', role: 'employee', phone: '0912222222' },
    ],

    majors: [
      { id: 1, name: 'علوم الحاسب', price_per_course: 200, semester_base_fee: 150, courses_count: 40 },
      { id: 2, name: 'إدارة الأعمال', price_per_course: 180, semester_base_fee: 120, courses_count: 38 },
      { id: 3, name: 'الهندسة', price_per_course: 220, semester_base_fee: 200, courses_count: 45 },
    ],

    semesters: [
      { id: 1, name: 'خريف 2026', start_date: '2026-09-01', end_date: '2027-01-15', is_active: true },
      { id: 2, name: 'ربيع 2026', start_date: '2026-01-15', end_date: '2026-05-10', is_active: false },
      { id: 3, name: 'خريف 2025', start_date: '2025-09-01', end_date: '2026-01-15', is_active: false },
    ],

    students: [
      { id: 1, university_id: '202600123', full_name: 'أحمد علي', major_id: 1, phone: '0913333333', email: 'a.ali@university.edu', address: 'طرابلس' },
      { id: 2, university_id: '202600124', full_name: 'فاطمة حسن', major_id: 2, phone: '0914444444', email: 'f.hassan@university.edu', address: 'بنغازي' },
      { id: 3, university_id: '202600125', full_name: 'خالد إبراهيم', major_id: 3, phone: null, email: null, address: null },
      { id: 4, university_id: '202500098', full_name: 'نورة عبدالله', major_id: 1, phone: '0915555555', email: null, address: null },
      { id: 5, university_id: '202600126', full_name: 'عمر يوسف', major_id: 2, phone: null, email: 'o.youssef@university.edu', address: null },
    ],

    enrollments: [
      // أحمد علي — current term, 1000/1350 paid
      { id: 1, student_id: 1, semester_id: 1, major_id: 1, courses_count: 6, snapshot_course_price: 200, snapshot_base_fee: 150, status: 'Active', created_at: daysAgoISO(10) },
      // فاطمة حسن — current term, 500/1020 paid
      { id: 2, student_id: 2, semester_id: 1, major_id: 2, courses_count: 5, snapshot_course_price: 180, snapshot_base_fee: 120, status: 'Active', created_at: daysAgoISO(8) },
      // نورة عبدالله — past term, fully paid
      { id: 3, student_id: 4, semester_id: 3, major_id: 1, courses_count: 4, snapshot_course_price: 200, snapshot_base_fee: 150, status: 'Completed', created_at: daysAgoISO(200) },
    ],

    payments: [
      { id: 1, student_id: 4, semester_id: 3, amount_paid: 950, payment_method: 'نقدًا', created_by: 3, notes: null, timestamp: daysAgoISO(200), receipt_no: 99818 },
      { id: 2, student_id: 1, semester_id: 1, amount_paid: 600, payment_method: 'نقدًا', created_by: 3, notes: null, timestamp: daysAgoISO(4), receipt_no: 99821 },
      { id: 3, student_id: 2, semester_id: 1, amount_paid: 500, payment_method: 'بطاقة', created_by: 3, notes: null, timestamp: daysAgoISO(2), receipt_no: 99823 },
      { id: 4, student_id: 1, semester_id: 1, amount_paid: 400, payment_method: 'بطاقة', created_by: 3, notes: null, timestamp: daysAgoISO(0), receipt_no: 99824 },
    ],
  };
}
