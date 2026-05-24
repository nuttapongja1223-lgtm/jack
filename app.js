'use strict';

/* ===============================================================
 * แหล่งราคา: Google Sheet (ดึงสดทุกครั้งที่เปิดหน้า)
 * ---------------------------------------------------------------
 * โครงสร้างตารางที่รองรับ:
 *   - แถวบนสุด (header): ช่องแรกเว้นว่าง/ชื่ออะไรก็ได้ ช่องถัดไป = ขนาด BTU
 *   - แถวถัดมา: ช่องแรก = ชื่อบริการ ช่องถัดไป = ราคาในแต่ละขนาด
 *   ตัวอย่าง:
 *     บริการ , 9000 , 12000 , 18000 , 24000 , 36000
 *     ล้างแอร์ , 700  , 900   , 1100  , 1400  , 1800
 *     ซ่อมแอร์ , 800  , ...
 *     ติดตั้งแอร์, 2500, ...
 *
 * ใช้ลิงก์ "เผยแพร่ไปยังเว็บ → CSV" (Publish to web) ซึ่งเข้าถึงสาธารณะได้
 * และดึงข้อมูลข้ามโดเมนได้ (CORS) — แก้ราคาในชีตแล้วระบบจะอัปเดตตามอัตโนมัติ
 * (Google แคชไฟล์เผยแพร่ราว 1–5 นาที การเปลี่ยนแปลงจึงอาจหน่วงเล็กน้อย)
 * =============================================================== */
const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSexxfuCO0RyTHa2qy9Y4ZrDWE-YdUKhs0QgdFJ12hNTyjXnLOPB0k_A_ZzMQ2kz03kPm4m7QIb6rbR/pub?output=csv';
const POLL_MS = 15000;   // ดึงราคาซ้ำทุก 15 วินาที เพื่ออัปเดตขณะเปิดหน้าค้างไว้

/* แปลงชื่อบริการในชีต (อังกฤษ) ให้แสดงเป็นไทยใน UI — ชื่ออื่นจะแสดงตามชีต */
const LABEL_MAP = {
  wash: 'ล้างแอร์',
  clean: 'ล้างแอร์',
  repair: 'ซ่อมแอร์',
  fix: 'ซ่อมแอร์',
  install: 'ติดตั้งแอร์',
  installation: 'ติดตั้งแอร์',
};

/* ราคาสำรอง (ใช้เมื่อโหลดชีตไม่สำเร็จ) */
const DEFAULT_SERVICES = {
  'ล้างแอร์':   { label: 'ล้างแอร์',   prices: { '9000': 500,  '12000': 600,  '18000': 800,  '24000': 1000, '36000': 1400 } },
  'ซ่อมแอร์':   { label: 'ซ่อมแอร์',   prices: { '9000': 800,  '12000': 900,  '18000': 1100, '24000': 1300, '36000': 1700 } },
  'ติดตั้งแอร์': { label: 'ติดตั้งแอร์', prices: { '9000': 2500, '12000': 2800, '18000': 3500, '24000': 4200, '36000': 5500 } },
};
const DEFAULT_SIZES = [
  { value: '9000',  label: '9,000 BTU' },
  { value: '12000', label: '12,000 BTU' },
  { value: '18000', label: '18,000 BTU' },
  { value: '24000', label: '24,000 BTU' },
  { value: '36000', label: '36,000 BTU' },
];

// ตารางราคาที่ใช้งานจริง (ถูกแทนที่ด้วยข้อมูลจากชีตเมื่อโหลดสำเร็จ)
let SERVICES = JSON.parse(JSON.stringify(DEFAULT_SERVICES));
let SIZES = DEFAULT_SIZES.slice();

// ค่าเดินทางตามช่วงระยะทาง (คิดครั้งเดียวต่อออร์เดอร์)
const DISTANCES = [
  { value: 'd0', label: 'ในเขต (0–10 กม.)', fee: 0 },
  { value: 'd1', label: '10–25 กม.',        fee: 150 },
  { value: 'd2', label: '25–50 กม.',        fee: 300 },
  { value: 'd3', label: 'มากกว่า 50 กม.',   fee: 500 },
];

/* --------------------------------------------------------------- */
const baht = (n) => '฿' + Number(n).toLocaleString('th-TH');
let uid = 0;

const els = {
  itemsList:    document.getElementById('itemsList'),
  itemsError:   document.getElementById('itemsError'),
  priceStatus:  document.getElementById('priceStatus'),
  addItemBtn:   document.getElementById('addItemBtn'),
  distance:     document.getElementById('distance'),
  summaryItems: document.getElementById('summaryItems'),
  sumServices:  document.getElementById('sumServices'),
  sumTravel:    document.getElementById('sumTravel'),
  sumTravelLabel: document.getElementById('sumTravelLabel'),
  sumTotal:     document.getElementById('sumTotal'),
  form:         document.getElementById('bookingForm'),
  refreshPrice: document.getElementById('refreshPrice'),
  custName:     document.getElementById('custName'),
  custPhone:    document.getElementById('custPhone'),
  custAddress:  document.getElementById('custAddress'),
  svcDate:      document.getElementById('svcDate'),
  svcTime:      document.getElementById('svcTime'),
  modal:        document.getElementById('modal'),
  bookingNo:    document.getElementById('bookingNo'),
  receiptBody:  document.getElementById('receiptBody'),
  printBtn:     document.getElementById('printBtn'),
  newBtn:       document.getElementById('newBtn'),
};

/* ===============================================================
 * ดึง + แปลงราคาจากชีต
 * =============================================================== */
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') { q = true; }
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c === '\r') { /* skip */ }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function formatBtu(raw) {
  const num = String(raw).replace(/[^0-9]/g, '');
  return num ? Number(num).toLocaleString('th-TH') + ' BTU' : String(raw).trim();
}
function toNumber(raw) {
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}

// แปลงแถว CSV -> { services, sizes }
function buildTable(rows) {
  const clean = rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  if (clean.length < 2) throw new Error('ข้อมูลในชีตไม่พอ');

  const header = clean[0];
  const sizeCols = [];
  for (let i = 1; i < header.length; i++) {
    const raw = String(header[i]).trim();
    if (raw === '') continue;
    const num = String(raw).replace(/[^0-9]/g, '');
    sizeCols.push({ col: i, value: num || raw, label: formatBtu(raw) });
  }
  if (sizeCols.length === 0) throw new Error('ไม่พบคอลัมน์ขนาดในแถวหัวตาราง');

  const services = {};
  for (let r = 1; r < clean.length; r++) {
    const name = String(clean[r][0] || '').trim();
    if (!name) continue;
    const prices = {};
    sizeCols.forEach((s) => {
      const v = toNumber(clean[r][s.col]);
      if (v !== null) prices[s.value] = v;
    });
    const label = LABEL_MAP[name.toLowerCase()] || name;
    if (Object.keys(prices).length) services[name] = { label, prices };
  }
  if (Object.keys(services).length === 0) throw new Error('ไม่พบรายการบริการในชีต');

  return {
    services,
    sizes: sizeCols.map((s) => ({ value: s.value, label: s.label })),
  };
}

async function loadPricing() {
  // อย่ารีเฟรชตัวเลือกขณะเปิดใบยืนยันการจอง (กันรบกวนระหว่างยืนยัน)
  if (!els.modal.classList.contains('hidden')) return;
  try {
    const res = await fetch(SHEET_CSV_URL + '&_=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const { services, sizes } = buildTable(parseCSV(text));
    SERVICES = services;
    SIZES = sizes;
    refreshOptions();
    recalc();
    setStatus(`ราคาอัปเดตจากชีตแล้ว · ${new Date().toLocaleTimeString('th-TH')}`, 'ok');
  } catch (err) {
    setStatus('โหลดราคาจากชีตไม่สำเร็จ — ใช้ราคาสำรอง (ตรวจสอบการตั้งค่าแชร์ชีต)', 'warn');
    console.warn('loadPricing:', err);
  }
}

function setStatus(msg, kind) {
  els.priceStatus.textContent = msg;
  els.priceStatus.className =
    'mt-2 text-[13px] ' + (kind === 'warn' ? 'text-[#B45309]' : 'text-muted');
}

/* ===============================================================
 * ตัวเลือกระยะทาง
 * =============================================================== */
DISTANCES.forEach((d) => {
  const opt = document.createElement('option');
  opt.value = d.value;
  opt.textContent = `${d.label} — ${d.fee === 0 ? 'ฟรี' : baht(d.fee)}`;
  els.distance.appendChild(opt);
});

/* ===============================================================
 * แถวรายการบริการ
 * =============================================================== */
const fieldClass =
  'field w-full text-[14px] bg-surface border border-line rounded-lg px-3 py-2 appearance-none';

function serviceOptionsHtml() {
  return '<option value="" disabled selected>เลือกบริการ</option>' +
    Object.keys(SERVICES).map((k) => `<option value="${escapeAttr(k)}">${escapeHtml(SERVICES[k].label)}</option>`).join('');
}
function sizeOptionsHtml() {
  return '<option value="" disabled selected>เลือกขนาด</option>' +
    SIZES.map((s) => `<option value="${escapeAttr(s.value)}">${escapeHtml(s.label)}</option>`).join('');
}

// อัปเดต option ของทุกแถวหลังโหลดราคาจากชีต โดยพยายามคงค่าที่เลือกไว้
function refreshOptions() {
  els.itemsList.querySelectorAll('.item').forEach((row) => {
    const svcSel = row.querySelector('.js-service');
    const sizeSel = row.querySelector('.js-size');
    const svcVal = svcSel.value, sizeVal = sizeSel.value;
    svcSel.innerHTML = serviceOptionsHtml();
    sizeSel.innerHTML = sizeOptionsHtml();
    if (svcVal && SERVICES[svcVal]) svcSel.value = svcVal;
    if (sizeVal && SIZES.some((s) => s.value === sizeVal)) sizeSel.value = sizeVal;
  });
}

function addItem() {
  const id = 'item-' + (++uid);
  const row = document.createElement('div');
  row.className = 'item bg-surface border border-line rounded-lg p-3 grid grid-cols-2 sm:grid-cols-[1fr_1fr_88px_auto] gap-3 items-end';
  row.dataset.id = id;
  row.innerHTML = `
    <label class="block">
      <span class="block text-[13px] font-medium text-muted mb-1">ประเภทบริการ</span>
      <select class="js-service ${fieldClass}">${serviceOptionsHtml()}</select>
    </label>
    <label class="block">
      <span class="block text-[13px] font-medium text-muted mb-1">ขนาดแอร์</span>
      <select class="js-size ${fieldClass}">${sizeOptionsHtml()}</select>
    </label>
    <label class="block">
      <span class="block text-[13px] font-medium text-muted mb-1">จำนวน</span>
      <input type="number" class="js-qty field w-full text-[14px] bg-surface border border-line rounded-lg px-3 py-2 text-center" min="1" step="1" value="1" />
    </label>
    <button type="button" class="js-remove h-[38px] w-[38px] inline-flex items-center justify-center rounded-lg border border-line text-muted hover:text-[#DC2626] hover:border-[#DC2626] transition-colors focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2" aria-label="ลบรายการ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
    </button>`;
  els.itemsList.appendChild(row);
  recalc();
}

/* ===============================================================
 * คำนวณราคา
 * =============================================================== */
function readItems() {
  return [...els.itemsList.querySelectorAll('.item')].map((row) => {
    const service = row.querySelector('.js-service').value;
    const size = row.querySelector('.js-size').value;
    const qty = Math.max(1, parseInt(row.querySelector('.js-qty').value, 10) || 1);
    let unit = 0;
    if (service && size && SERVICES[service]) unit = SERVICES[service].prices[size] || 0;
    return { row, service, size, qty, unit, total: unit * qty };
  });
}

function recalc() {
  const items = readItems();
  const valid = items.filter((i) => i.service && i.size && i.unit > 0);
  const servicesTotal = valid.reduce((s, i) => s + i.total, 0);
  const dist = DISTANCES.find((d) => d.value === els.distance.value) || DISTANCES[0];
  const travel = dist.fee;
  const total = servicesTotal + travel;

  if (valid.length === 0) {
    els.summaryItems.innerHTML =
      '<div class="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] p-4 text-center text-[13px] text-muted">ยังไม่มีรายการบริการ</div>';
  } else {
    els.summaryItems.innerHTML = valid.map((i) => {
      const sizeLabel = (SIZES.find((s) => s.value === i.size) || {}).label || '';
      return `<div class="flex justify-between gap-2">
          <span>${escapeHtml(SERVICES[i.service].label)} · ${escapeHtml(sizeLabel)}${i.qty > 1 ? ` ×${i.qty}` : ''}</span>
          <span class="whitespace-nowrap">${baht(i.total)}</span>
        </div>`;
    }).join('');
  }

  els.sumServices.textContent = baht(servicesTotal);
  els.sumTravel.textContent = travel === 0 ? 'ฟรี' : baht(travel);
  els.sumTravelLabel.textContent = `ค่าเดินทาง (${dist.label})`;
  els.sumTotal.textContent = baht(total);

  return { items, valid, servicesTotal, travel, total, dist };
}

/* ===============================================================
 * ตรวจสอบความถูกต้อง
 * =============================================================== */
function showError(input, on) {
  input.classList.toggle('invalid', on);
  const err = input.parentElement.querySelector('.err');
  if (err) err.classList.toggle('hidden', !on);
}

function validate(calc) {
  let ok = true;

  const hasItems = calc.valid.length > 0;
  els.itemsError.classList.toggle('hidden', hasItems);
  if (!hasItems) ok = false;

  const nameOk = els.custName.value.trim().length > 0;
  showError(els.custName, !nameOk);
  if (!nameOk) ok = false;

  const phoneDigits = els.custPhone.value.replace(/\D/g, '');
  const phoneOk = phoneDigits.length >= 9 && phoneDigits.length <= 10;
  showError(els.custPhone, !phoneOk);
  if (!phoneOk) ok = false;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dateOk = els.svcDate.value && new Date(els.svcDate.value) >= today;
  showError(els.svcDate, !dateOk);
  if (!dateOk) ok = false;

  const timeOk = !!els.svcTime.value;
  showError(els.svcTime, !timeOk);
  if (!timeOk) ok = false;

  return ok;
}

/* ===============================================================
 * หมายเลขจอง + ใบยืนยัน
 * =============================================================== */
function genBookingNo() {
  const d = new Date();
  const ymd = d.getFullYear().toString().slice(2) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `BK-${ymd}-${rand}`;
}

function fmtDateTime() {
  const d = new Date(els.svcDate.value + 'T' + els.svcTime.value);
  const date = d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `${date} เวลา ${els.svcTime.value} น.`;
}

function showReceipt(calc) {
  els.bookingNo.textContent = genBookingNo();

  const lines = calc.valid.map((i) => {
    const sizeLabel = (SIZES.find((s) => s.value === i.size) || {}).label || '';
    return `<div class="flex justify-between gap-2">
        <span>${escapeHtml(SERVICES[i.service].label)} · ${escapeHtml(sizeLabel)} ${i.qty > 1 ? `(${baht(i.unit)} ×${i.qty})` : ''}</span>
        <span class="whitespace-nowrap font-medium">${baht(i.total)}</span>
      </div>`;
  }).join('');

  const addr = els.custAddress.value.trim();
  els.receiptBody.innerHTML = `
    <div>
      <p class="text-[13px] text-muted mb-1">ลูกค้า</p>
      <p class="font-medium">${escapeHtml(els.custName.value.trim())}</p>
      <p>${escapeHtml(els.custPhone.value.trim())}</p>
      ${addr ? `<p class="text-muted">${escapeHtml(addr)}</p>` : ''}
    </div>
    <div>
      <p class="text-[13px] text-muted mb-1">นัดหมายให้บริการ</p>
      <p class="font-medium">${fmtDateTime()}</p>
    </div>
    <div>
      <p class="text-[13px] text-muted mb-2">รายการบริการ</p>
      <div class="space-y-1.5">${lines}</div>
    </div>
    <div class="pt-3 border-t border-line space-y-1.5">
      <div class="flex justify-between text-muted"><span>ยอดค่าบริการ</span><span>${baht(calc.servicesTotal)}</span></div>
      <div class="flex justify-between text-muted"><span>ค่าเดินทาง (${calc.dist.label})</span><span>${calc.travel === 0 ? 'ฟรี' : baht(calc.travel)}</span></div>
      <div class="flex justify-between items-baseline pt-2 border-t border-line">
        <span class="font-semibold">ยอดรวมทั้งสิ้น</span>
        <span class="text-[23px] font-semibold">${baht(calc.total)}</span>
      </div>
    </div>`;

  els.modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

/* ===============================================================
 * เหตุการณ์
 * =============================================================== */
els.addItemBtn.addEventListener('click', addItem);
els.itemsList.addEventListener('click', (e) => {
  const btn = e.target.closest('.js-remove');
  if (!btn) return;
  if (els.itemsList.querySelectorAll('.item').length <= 1) {
    const row = btn.closest('.item');
    row.querySelectorAll('select').forEach((s) => (s.selectedIndex = 0));
    row.querySelector('.js-qty').value = 1;
  } else {
    btn.closest('.item').remove();
  }
  recalc();
});
els.itemsList.addEventListener('input', recalc);
els.itemsList.addEventListener('change', recalc);
els.distance.addEventListener('change', recalc);
els.refreshPrice.addEventListener('click', async () => {
  setStatus('กำลังรีเฟรชราคา…', 'ok');
  await loadPricing();
});

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const calc = recalc();
  if (!validate(calc)) {
    const firstErr = els.form.querySelector('.invalid, .item');
    if (!calc.valid.length) els.itemsError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  showReceipt(calc);
});

els.printBtn.addEventListener('click', () => window.print());
els.newBtn.addEventListener('click', () => {
  els.modal.classList.add('hidden');
  document.body.style.overflow = '';
  els.form.reset();
  els.itemsList.innerHTML = '';
  document.querySelectorAll('.err').forEach((el) => el.classList.add('hidden'));
  document.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
  els.svcTime.value = '09:00';
  setDefaultDate();
  addItem();
});
els.modal.addEventListener('click', (e) => {
  if (e.target === els.modal) { els.modal.classList.add('hidden'); document.body.style.overflow = ''; }
});

/* ===============================================================
 * ค่าเริ่มต้น
 * =============================================================== */
function setDefaultDate() {
  const d = new Date();
  els.svcDate.min = d.toISOString().slice(0, 10);
  els.svcDate.value = d.toISOString().slice(0, 10);
}
setDefaultDate();
addItem();
recalc();
loadPricing();                       // ดึงราคาล่าสุดเมื่อเปิดหน้า
setInterval(loadPricing, POLL_MS);   // และอัปเดตซ้ำเป็นระยะขณะเปิดหน้าค้างไว้
