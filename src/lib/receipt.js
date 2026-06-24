// @ts-nocheck — plain JS (DOM), not type-checked
// Fills + prints the shared ReceiptView markup. Reused by the post-payment modal
// (ReceiptModal) and the standalone reprint page (/receipts/view).

import { formatMoney, formatDateTime } from './format.js';

export function fillReceipt(root, r, currency = 'LYD') {
  if (!root) return;
  const set = (field, val) => {
    const el = root.querySelector(`[data-rcp="${field}"]`);
    if (el) el.textContent = val ?? '';
  };
  set('no', `#${r.receipt_no}`);
  set('datetime', formatDateTime(r.timestamp));
  set('student_name', r.student_name);
  set('university_id', r.university_id);
  set('semester', r.semester);
  set('major', r.major || '—');
  set('desc', `قسط الرسوم الدراسية — ${r.semester}`);
  set('amount', formatMoney(r.amount_paid, currency));
  set('total', formatMoney(r.amount_paid, currency));
  set('method', r.payment_method);
  set('employee', r.employee_name || '—');

  const stamp = root.querySelector('[data-rcp="stamp"]');
  if (stamp) {
    stamp.classList.remove('hidden', 'paid', 'due');
    if (r.is_fully_paid) {
      stamp.textContent = '>>> تم سداد الحساب بالكامل <<<';
      stamp.classList.add('paid');
    } else {
      stamp.textContent = `المتبقّي على الفصل: ${formatMoney(r.remaining, currency)}`;
      stamp.classList.add('due');
    }
  }
}

// Print just the receipt by cloning it into a top-level portal (a direct child
// of <body>) and hiding everything else — see global.css `.printing-receipt`.
// This avoids the layout collapse you get from absolute-positioning a node that
// lives inside the modal's positioned ancestor.
function findReceiptEl() {
  const modal = document.getElementById('receipt-modal');
  if (modal && !modal.classList.contains('hidden')) {
    const inModal = modal.querySelector('.receipt');
    if (inModal) return inModal;
  }
  return document.querySelector('.receipt');
}

// Two copies per print: one for the student, one for the office, separated by a
// dashed cut line so the cashier can split a single sheet.
const COPY_LABELS = ['نسخة الطالب', 'نسخة المكتب'];

export function printReceipt() {
  const receipt = findReceiptEl();
  if (!receipt) { window.print(); return; }
  let portal = document.getElementById('print-portal');
  if (!portal) {
    portal = document.createElement('div');
    portal.id = 'print-portal';
    document.body.appendChild(portal);
  }
  portal.innerHTML = '';
  COPY_LABELS.forEach((label, i) => {
    const copy = document.createElement('div');
    copy.className = 'receipt-copy';
    const cap = document.createElement('div');
    cap.className = 'receipt-copy-label';
    cap.textContent = label;
    copy.appendChild(cap);
    copy.appendChild(receipt.cloneNode(true)); // keeps scoped styles + filled values
    portal.appendChild(copy);
    if (i < COPY_LABELS.length - 1) {
      const cut = document.createElement('div');
      cut.className = 'receipt-cut';
      cut.textContent = '✂ قص هنا';
      portal.appendChild(cut);
    }
  });
  document.body.classList.add('printing-receipt');
  window.print();
}

if (typeof window !== 'undefined') {
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-receipt');
    const portal = document.getElementById('print-portal');
    if (portal) portal.innerHTML = '';
  });
}

export function openReceiptModal(receipt, currency = 'LYD') {
  const modal = document.getElementById('receipt-modal');
  if (!modal) return;
  fillReceipt(modal, receipt, currency);
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

export function closeReceiptModal() {
  const modal = document.getElementById('receipt-modal');
  modal?.classList.add('hidden');
  document.body.classList.remove('modal-open');
}
