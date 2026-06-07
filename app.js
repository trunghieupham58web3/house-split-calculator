'use strict';

/* ================================================================
   MÔ HÌNH
   ----------------------------------------------------------------
   - members: danh sách thành viên động, mỗi người có { name, count }
     count = số người thực (vd: vợ chồng em gái = 2).
   - Mỗi khoản chi có:
       amount       : số tiền
       mode         : 'equal' (chia đều, mỗi thành viên 1 phần)
                      'head'  (theo số người = count)
       participants : danh sách id thành viên cùng chia khoản này
   - Cách tính cho 1 khoản:
       weight(m) = (mode==='head') ? m.count : 1
       totalW    = tổng weight các participants
       m phải trả = amount * weight(m) / totalW
   Mô hình này tự đúng với BẤT KỲ số thành viên nào.
   ================================================================ */

/* ================================================================
   STATE
   ================================================================ */
const DB_KEY = 'house-calc-v4';
let _id = 0;
const nid = () => `id_${++_id}`;

const MEMBER_COLORS = [
  { name: 'purple', accent: '#a78bfa', bg: 'rgba(139,92,246,.18)', bd: 'rgba(139,92,246,.4)' },
  { name: 'teal',   accent: '#2dd4bf', bg: 'rgba(45,212,191,.15)', bd: 'rgba(45,212,191,.4)' },
  { name: 'pink',   accent: '#f472b6', bg: 'rgba(236,72,153,.15)', bd: 'rgba(236,72,153,.4)' },
  { name: 'amber',  accent: '#fbbf24', bg: 'rgba(245,158,11,.15)', bd: 'rgba(245,158,11,.4)' },
  { name: 'cyan',   accent: '#22d3ee', bg: 'rgba(34,211,238,.15)', bd: 'rgba(34,211,238,.4)' },
  { name: 'green',  accent: '#34d399', bg: 'rgba(16,185,129,.15)', bd: 'rgba(16,185,129,.4)' },
];
const colorOf = (i) => MEMBER_COLORS[i % MEMBER_COLORS.length];

let members = [];   // [{ id, name, count }]
let fixed   = [];   // [{ id, emoji, label, amount, mode, participants:[id] }]
let custom  = [];   // [{ id, name, amount, note, mode, participants:[id] }]

const FIXED_SEED = [
  { emoji: '🏠', label: 'Tiền nhà',    mode: 'equal' },
  { emoji: '⚡', label: 'Tiền điện',   mode: 'equal' },
  { emoji: '💧', label: 'Tiền nước',   mode: 'head'  },
  { emoji: '🛵', label: 'Tiền gửi xe', mode: 'head'  },
  { emoji: '🏢', label: 'Phí quản lý', mode: 'head'  },
];

/* ================================================================
   FORMAT
   ================================================================ */
function fmt(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Math.round(n || 0));
}

// Chèn dấu chấm phân cách hàng nghìn: "2315131" -> "2.315.131"
function groupDigits(digits) {
  const d = String(digits || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
}
// Hiển thị số tiền trong ô input (rỗng nếu 0)
function moneyDisplay(n) { return n ? groupDigits(String(n)) : ''; }

// Xử lý gõ số tiền: format tại chỗ + giữ vị trí con trỏ + lưu số thật vào state
function onMoney(el, kind, id) {
  const selStart = el.selectionStart;
  const digitsBefore = (el.value.slice(0, selStart).match(/\d/g) || []).length;
  const digits = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const formatted = groupDigits(digits);
  el.value = formatted;

  const num = parseInt(digits || '0', 10);
  if (kind === 'fixed') updFixed(id, 'amount', num);
  else updCustom(id, 'amount', num);

  // khôi phục vị trí con trỏ theo số chữ số phía trước
  let pos = 0, count = 0;
  while (pos < formatted.length && count < digitsBefore) {
    if (/\d/.test(formatted[pos])) count++;
    pos++;
  }
  el.setSelectionRange(pos, pos);
}

/* ================================================================
   MEMBERS
   ================================================================ */
function addMember(preset) {
  const m = preset || { id: nid(), name: `Người ${members.length + 1}`, count: 1 };
  if (!m.id) m.id = nid();
  members.push(m);
  // mọi khoản hiện có mặc định bao gồm thành viên mới
  fixed.forEach(c => c.participants.push(m.id));
  custom.forEach(c => c.participants.push(m.id));
  renderMembers();
  renderFixed();
  renderCustom();
}

function removeMember(id) {
  if (members.length <= 1) { showToast('Cần ít nhất 1 thành viên'); return; }
  members = members.filter(m => m.id !== id);
  fixed.forEach(c => c.participants = c.participants.filter(p => p !== id));
  custom.forEach(c => c.participants = c.participants.filter(p => p !== id));
  renderMembers();
  renderFixed();
  renderCustom();
}

function setMemberCount(id, delta) {
  const m = members.find(x => x.id === id);
  if (!m) return;
  m.count = Math.max(1, (m.count || 1) + delta);
  renderMembers();
  renderFixed();
  renderCustom();
}

function setMemberName(id, name) {
  const m = members.find(x => x.id === id);
  if (m) m.name = name;
}

function renderMembers() {
  const wrap = document.getElementById('membersList');
  wrap.innerHTML = members.map((m, i) => {
    const c = colorOf(i);
    return `
      <div class="member-row" data-id="${m.id}" style="--accent:${c.accent};--mbg:${c.bg};--mbd:${c.bd}">
        <span class="member-dot"></span>
        <input class="input-field member-name" value="${escapeAttr(m.name)}"
               oninput="setMemberName('${m.id}', this.value)" placeholder="Tên" />
        <div class="member-count">
          <button class="count-btn" onclick="setMemberCount('${m.id}',-1)" title="Bớt">−</button>
          <span class="count-val">${m.count}</span>
          <button class="count-btn" onclick="setMemberCount('${m.id}',1)" title="Thêm">+</button>
          <span class="count-label">người</span>
        </div>
        <button class="remove-btn" onclick="removeMember('${m.id}')" title="Xoá">✕</button>
      </div>`;
  }).join('');
  bindCursorHover(wrap.querySelectorAll('input, button'));
}

/* ================================================================
   COST RENDERING (shared by fixed + custom)
   ================================================================ */
function modeSelectHTML(cost, onchange) {
  return `
    <div class="select-wrap select-wrap-mode">
      <select class="input-field mode-select" onchange="${onchange}">
        <option value="equal" ${cost.mode === 'equal' ? 'selected' : ''}>Chia đều</option>
        <option value="head"  ${cost.mode === 'head'  ? 'selected' : ''}>Theo số người</option>
      </select>
      <span class="select-arrow">▾</span>
    </div>`;
}

function participantsHTML(cost, toggleFn) {
  if (!members.length) return '';
  return `<div class="participants">` + members.map((m, i) => {
    const c = colorOf(i);
    const on = cost.participants.includes(m.id);
    return `<button class="chip ${on ? 'chip-on' : ''}"
              style="--accent:${c.accent};--mbg:${c.bg};--mbd:${c.bd}"
              onclick="${toggleFn}('${cost.id}','${m.id}')">${on ? '✓ ' : ''}${escapeHtml(m.name)}</button>`;
  }).join('') + `</div>`;
}

function renderFixed() {
  const wrap = document.getElementById('fixedList');
  wrap.innerHTML = fixed.map(c => `
    <div class="cost-card" data-id="${c.id}">
      <div class="cost-top">
        <div class="cost-title"><span class="cost-emoji">${c.emoji}</span><span class="cost-name">${c.label}</span></div>
        <div class="input-money-wrap">
          <input type="text" inputmode="numeric" class="input-field money-input" placeholder="0"
                 value="${moneyDisplay(c.amount)}" oninput="onMoney(this,'fixed','${c.id}')" />
          <span class="currency-tag">đ</span>
        </div>
      </div>
      <div class="cost-config">
        <span class="config-label">Cách chia</span>
        ${modeSelectHTML(c, `updFixed('${c.id}','mode',this.value)`)}
        ${participantsHTML(c, 'toggleFixedP')}
      </div>
    </div>`).join('');
  bindCursorHover(wrap.querySelectorAll('input, button, select'));
}

function renderCustom() {
  const wrap = document.getElementById('customList');
  const empty = document.getElementById('customEmpty');
  empty.style.display = custom.length ? 'none' : '';
  wrap.innerHTML = custom.map(c => `
    <div class="cost-card cost-card-custom" data-id="${c.id}">
      <div class="cost-top">
        <input type="text" class="input-field custom-name" placeholder="Tên khoản (vd: Internet)"
               value="${escapeAttr(c.name)}" oninput="updCustom('${c.id}','name',this.value)" />
        <div class="input-money-wrap">
          <input type="text" inputmode="numeric" class="input-field money-input" placeholder="0"
                 value="${moneyDisplay(c.amount)}" oninput="onMoney(this,'custom','${c.id}')" />
          <span class="currency-tag">đ</span>
        </div>
        <button class="remove-btn" onclick="removeCustomItem('${c.id}')" title="Xoá">✕</button>
      </div>
      <div class="cost-config">
        <span class="config-label">Cách chia</span>
        ${modeSelectHTML(c, `updCustom('${c.id}','mode',this.value)`)}
        ${participantsHTML(c, 'toggleCustomP')}
      </div>
      <input type="text" class="input-field custom-note" placeholder="Ghi chú (không bắt buộc)"
             value="${escapeAttr(c.note)}" oninput="updCustom('${c.id}','note',this.value)" />
    </div>`).join('');
  bindCursorHover(wrap.querySelectorAll('input, button, select'));
}

/* update handlers */
function updFixed(id, field, val) {
  const c = fixed.find(x => x.id === id); if (!c) return;
  c[field] = field === 'amount' ? (parseFloat(val) || 0) : val;
}
function updCustom(id, field, val) {
  const c = custom.find(x => x.id === id); if (!c) return;
  c[field] = field === 'amount' ? (parseFloat(val) || 0) : val;
}
function toggleFixedP(id, mid) { togglePart(fixed, id, mid, renderFixed); }
function toggleCustomP(id, mid) { togglePart(custom, id, mid, renderCustom); }
function togglePart(list, id, mid, rerender) {
  const c = list.find(x => x.id === id); if (!c) return;
  if (c.participants.includes(mid)) c.participants = c.participants.filter(p => p !== mid);
  else c.participants.push(mid);
  rerender();
}

function addCustomItem(preset) {
  const c = preset || { id: nid(), name: '', amount: 0, note: '', mode: 'equal', participants: members.map(m => m.id) };
  if (!c.id) c.id = nid();
  if (!c.participants) c.participants = members.map(m => m.id);
  custom.push(c);
  renderCustom();
  const el = document.querySelector(`.cost-card[data-id="${c.id}"] .custom-name`);
  if (el) el.focus();
}
function removeCustomItem(id) {
  custom = custom.filter(c => c.id !== id);
  renderCustom();
}

/* ================================================================
   CALCULATE
   ================================================================ */
let _lastCalc = null;

// Trả về map { memberId: amount } cho 1 khoản
function splitCost(amount, mode, participants) {
  const result = {};
  const parts = members.filter(m => participants.includes(m.id));
  const totalW = parts.reduce((s, m) => s + (mode === 'head' ? m.count : 1), 0);
  if (totalW <= 0) return result;
  parts.forEach(m => {
    const w = mode === 'head' ? m.count : 1;
    result[m.id] = amount * w / totalW;
  });
  return result;
}

function calculate() {
  const month = document.getElementById('month').value;
  const year  = document.getElementById('year').value;

  const totals = {};
  members.forEach(m => totals[m.id] = 0);
  let grand = 0;

  const buildRows = (list, isCustom) => list
    .filter(c => c.amount > 0)
    .map(c => {
      const shares = splitCost(c.amount, c.mode, c.participants);
      Object.entries(shares).forEach(([mid, amt]) => totals[mid] += amt);
      grand += c.amount;
      return {
        label: isCustom ? c.name : `${c.emoji} ${c.label}`,
        emoji: isCustom ? '📌' : c.emoji,
        name:  isCustom ? c.name : c.label,
        note:  isCustom ? c.note : '',
        amount: c.amount, mode: c.mode, participants: c.participants, shares,
      };
    });

  const fixedRows  = buildRows(fixed, false);
  const customRows = buildRows(custom, true);

  _lastCalc = {
    month, year,
    members: members.map(m => ({ ...m })),
    fixedRows, customRows, totals, grand,
  };

  renderResults(_lastCalc);
  saveRecord();

  const btn = document.getElementById('calcBtn');
  btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
  setTimeout(() => { btn.style.background = ''; }, 1200);
}

/* ================================================================
   RENDER RESULTS
   ================================================================ */
function modeLabel(m) { return m === 'head' ? 'Theo người' : 'Chia đều'; }

function renderResults(c) {
  const { month, year, members: ms, fixedRows, customRows, totals, grand } = c;
  const card = document.getElementById('resultsCard');
  const inner = document.getElementById('resultsInner');

  const memberHead = ms.map((m, i) => `<span class="head-right" style="color:${colorOf(i).accent}">${escapeHtml(m.name)}</span>`).join('');

  const rowHTML = (r) => {
    const cells = ms.map((m, i) => {
      const amt = r.shares[m.id];
      return `<span class="share-cell" style="color:${amt ? colorOf(i).accent : 'var(--c-muted)'}">${amt ? fmt(amt) : '—'}</span>`;
    }).join('');
    return `
      <div class="table-row" style="grid-template-columns:${gridCols(ms.length)}">
        <span class="item-name">${escapeHtml(r.label)}${r.note ? `<span class="item-sub">${escapeHtml(r.note)}</span>` : ''}</span>
        <span class="item-amount">${fmt(r.amount)}</span>
        <span class="item-mode">${modeLabel(r.mode)}</span>
        ${cells}
      </div>`;
  };

  const tableBlock = (title, rows) => rows.length ? `
    <div class="table-scroll">
    <div class="breakdown-table" style="min-width:${320 + ms.length * 110}px">
      <div class="table-row table-head" style="grid-template-columns:${gridCols(ms.length)}">
        <span>${title}</span><span>Số tiền</span><span>Cách chia</span>${memberHead}
      </div>
      ${rows.map(rowHTML).join('')}
    </div></div>` : '';

  inner.innerHTML = `
    <div class="results-header">
      <div>
        <div class="results-period">Tháng ${month}/${year}</div>
        <div class="results-title">Kết quả tính toán</div>
      </div>
      <div>
        <div class="results-grand-label">Tổng chi phí</div>
        <div class="results-grand">${fmt(grand)}</div>
      </div>
    </div>

    <div class="person-cards" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
      ${ms.map((m, i) => {
        const col = colorOf(i);
        return `
        <div class="person-card" style="--accent:${col.accent};--mbg:${col.bg};--mbd:${col.bd};border-color:${col.bd};background:linear-gradient(135deg,${col.bg},transparent)">
          <div class="person-avatar">${m.count > 1 ? '👫' : '🧑'}</div>
          <div class="person-name">${escapeHtml(m.name)}</div>
          <div class="person-amount">${fmt(totals[m.id])}</div>
          <div class="person-detail">${m.count} người</div>
        </div>`;
      }).join('')}
    </div>

    ${tableBlock('Khoản cố định', fixedRows)}
    ${tableBlock('Khoản phát sinh', customRows)}

    <div class="export-row">
      <button class="export-btn export-pdf"  onclick="exportPDF()">📄 Xuất PDF</button>
      <button class="export-btn export-jpeg" onclick="exportJPEG()">🖼️ Xuất JPEG</button>
    </div>
  `;

  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  bindCursorHover(card.querySelectorAll('button'));
}

function gridCols(n) { return `1.6fr 1.1fr 1fr ${Array(n).fill('1.1fr').join(' ')}`; }

/* ================================================================
   EXPORT TEMPLATE
   ================================================================ */
function buildExportTemplate() {
  if (!_lastCalc) return;
  const { month, year, members: ms, fixedRows, customRows, totals, grand } = _lastCalc;
  const today = new Date().toLocaleDateString('vi-VN');

  const memberTh = ms.map((m, i) => `<th style="text-align:right;color:${colorOf(i).accent}">${escapeHtml(m.name)}</th>`).join('');
  const rowsHTML = (rows) => rows.map(r => `
    <tr>
      <td>${escapeHtml(r.label)}${r.note ? `<div style="font-size:11px;color:#9ca3af;font-style:italic">${escapeHtml(r.note)}</div>` : ''}</td>
      <td style="text-align:right">${fmt(r.amount)}</td>
      <td style="text-align:center"><span class="et-divisor-badge">${modeLabel(r.mode)}</span></td>
      ${ms.map((m, i) => {
        const amt = r.shares[m.id];
        return `<td style="text-align:right;font-weight:700;color:${amt ? colorOf(i).accent : '#cbd5e1'}">${amt ? fmt(amt) : '—'}</td>`;
      }).join('')}
    </tr>`).join('');

  const tpl = document.getElementById('exportTpl');
  tpl.innerHTML = `
  <div class="et-wrap">
    <div class="et-header">
      <div class="et-header-top">
        <div>
          <span class="et-logo">🏠</span>
          <div class="et-title">Bảng Chia Tiền Nhà</div>
          <div class="et-sub">${ms.map(m => escapeHtml(m.name)).join(' • ')}</div>
        </div>
        <div class="et-period-box">
          <div class="et-period-label">Kỳ thanh toán</div>
          <div class="et-period-val">T${month}/${year}</div>
        </div>
      </div>
    </div>

    <div class="et-body">
      <div class="et-total-bar">
        <div class="et-total-bar-label">Tổng chi phí tháng này</div>
        <div class="et-total-bar-val">${fmt(grand)}</div>
      </div>

      <div class="et-persons">
        ${ms.map((m, i) => {
          const col = colorOf(i);
          return `
          <div class="et-person-card" style="background:linear-gradient(135deg,${hexLight(col.accent)},#fff);border-color:${col.accent}">
            <div class="et-person-avatar">${m.count > 1 ? '👫' : '🧑'}</div>
            <div class="et-person-name">${escapeHtml(m.name)} · ${m.count} người</div>
            <div class="et-person-amount" style="color:${col.accent}">${fmt(totals[m.id])}</div>
          </div>`;
        }).join('')}
      </div>

      ${fixedRows.length ? `
      <div class="et-section-title">Khoản cố định</div>
      <table class="et-table">
        <thead><tr><th>Khoản chi</th><th style="text-align:right">Số tiền</th><th style="text-align:center">Cách chia</th>${memberTh}</tr></thead>
        <tbody>${rowsHTML(fixedRows)}</tbody>
      </table>` : ''}

      ${customRows.length ? `
      <div class="et-section-title">Khoản phát sinh</div>
      <table class="et-custom-table">
        <thead><tr><th>Tên khoản</th><th style="text-align:right">Số tiền</th><th style="text-align:center">Cách chia</th>${memberTh}</tr></thead>
        <tbody>${rowsHTML(customRows)}</tbody>
      </table>` : ''}
    </div>

    <div class="et-footer">
      <div class="et-footer-brand">🏠 Tính Tiền Nhà</div>
      <div class="et-footer-date">Tạo ngày: ${today}</div>
    </div>
  </div>`;
  return tpl;
}

// làm nhạt 1 màu hex để dùng làm nền card sáng
function hexLight(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
  const mix = (x) => Math.round(x + (255 - x) * 0.86);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

/* ================================================================
   EXPORT JPEG / PDF
   ================================================================ */
async function exportJPEG() {
  if (!_lastCalc) { showToast('Hãy tính toán trước!'); return; }
  showToast('Đang tạo ảnh...');
  const tpl = buildExportTemplate(); tpl.style.left = '-9999px'; tpl.style.top = '0';
  try {
    const canvas = await html2canvas(tpl, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', width: 794 });
    const link = document.createElement('a');
    link.download = `tien-nha-T${_lastCalc.month}-${_lastCalc.year}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
    showToast('✅ Đã lưu ảnh JPEG!');
  } catch (e) { console.error(e); showToast('❌ Lỗi xuất ảnh: ' + e.message); }
}

async function exportPDF() {
  if (!_lastCalc) { showToast('Hãy tính toán trước!'); return; }
  showToast('Đang tạo PDF...');
  const tpl = buildExportTemplate(); tpl.style.left = '-9999px'; tpl.style.top = '0';
  try {
    const canvas = await html2canvas(tpl, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', width: 794 });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const imgData = canvas.toDataURL('image/jpeg', 0.97);
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    const pageH = pdf.internal.pageSize.getHeight();
    let y = 0;
    while (y < pdfH) { if (y > 0) pdf.addPage(); pdf.addImage(imgData, 'JPEG', 0, -y, pdfW, pdfH); y += pageH; }
    pdf.save(`tien-nha-T${_lastCalc.month}-${_lastCalc.year}.pdf`);
    showToast('✅ Đã xuất PDF!');
  } catch (e) { console.error(e); showToast('❌ Lỗi xuất PDF: ' + e.message); }
}

/* ================================================================
   HISTORY  (snapshot toàn bộ state)
   ================================================================ */
function snapshot() {
  return {
    id: `${document.getElementById('year').value}-${document.getElementById('month').value}`,
    month: document.getElementById('month').value,
    year:  document.getElementById('year').value,
    members: JSON.parse(JSON.stringify(members)),
    fixed:   JSON.parse(JSON.stringify(fixed)),
    custom:  JSON.parse(JSON.stringify(custom)),
    savedAt: new Date().toISOString(),
  };
}
function snapTotal(s) {
  const f = (s.fixed || []).reduce((a, c) => a + (c.amount || 0), 0);
  const c = (s.custom || []).reduce((a, x) => a + (x.amount || 0), 0);
  return f + c;
}
/* ---- Lớp lưu trữ: ưu tiên API MongoDB, fallback localStorage ----
   _backend = 'api'  -> đang dùng database trên Vercel
              'local'-> file:// hoặc API lỗi, dùng localStorage         */
const API_URL = '/api/records';
let _backend = null;           // null = chưa biết
let _history = [];             // cache danh sách hiển thị

function lsGet() { try { return JSON.parse(localStorage.getItem(DB_KEY)) || { records: [] }; } catch { return { records: [] }; } }
function lsSet(d) { localStorage.setItem(DB_KEY, JSON.stringify(d)); }
function lsUpsert(rec) {
  const d = lsGet();
  d.records = d.records.filter(r => r.id !== rec.id);
  d.records.unshift(rec);
  if (d.records.length > 60) d.records = d.records.slice(0, 60);
  lsSet(d);
  return d.records;
}

// Chỉ thử API khi không phải file:// (mở trực tiếp)
const _apiPossible = location.protocol === 'http:' || location.protocol === 'https:';

async function storeList() {
  if (_apiPossible && _backend !== 'local') {
    try {
      const r = await fetch(API_URL);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      _backend = 'api';
      // mirror xuống local làm backup offline
      lsSet({ records: j.records || [] });
      return j.records || [];
    } catch (e) { _backend = 'local'; }
  } else { _backend = 'local'; }
  return lsGet().records;
}

async function storeSave(rec) {
  lsUpsert(rec); // luôn lưu local trước (an toàn)
  if (_apiPossible && _backend !== 'local') {
    try {
      const r = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rec),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      _backend = 'api';
    } catch (e) { _backend = 'local'; }
  }
}

async function storeClear() {
  lsSet({ records: [] });
  if (_apiPossible && _backend !== 'local') {
    try { await fetch(API_URL, { method: 'DELETE' }); } catch (e) { _backend = 'local'; }
  }
}

async function refreshHistory() {
  _history = await storeList();
  renderHistoryDOM();
}

function renderHistoryDOM() {
  const list = document.getElementById('historyList');
  const tag = _backend === 'api'
    ? '<span class="db-badge db-on">☁️ MongoDB</span>'
    : '<span class="db-badge db-off">💾 Lưu cục bộ</span>';
  if (!_history.length) {
    list.innerHTML = `<div class="history-status">${tag}</div><div class="no-history">Chưa có lịch sử tính toán nào</div>`;
    return;
  }
  list.innerHTML = `<div class="history-status">${tag}</div><div class="history-list">${_history.map(r => `
    <div class="history-item" onclick="loadRecord('${r.id}')">
      <span class="history-month">📆 Tháng ${r.month}/${r.year}</span>
      <span class="history-meta">${(r.members || []).length} người</span>
      <span class="history-total">${fmt(snapTotal(r))}</span>
      <span class="history-arrow">→</span>
    </div>`).join('')}</div>`;
  bindCursorHover(document.querySelectorAll('.history-item'));
}

async function saveRecord() {
  await storeSave(snapshot());
  await refreshHistory();
}

function loadRecord(id) {
  const r = _history.find(x => x.id === id);
  if (!r) return;
  document.getElementById('month').value = r.month;
  document.getElementById('year').value  = r.year;
  members = JSON.parse(JSON.stringify(r.members || []));
  fixed   = JSON.parse(JSON.stringify(r.fixed || []));
  custom  = JSON.parse(JSON.stringify(r.custom || []));
  renderMembers(); renderFixed(); renderCustom();
  calculate();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast(`✅ Đã tải tháng ${r.month}/${r.year}`);
}

async function clearHistory() {
  if (!confirm('Xóa toàn bộ lịch sử?')) return;
  await storeClear();
  await refreshHistory();
  showToast('🗑️ Đã xóa lịch sử');
}

/* ================================================================
   HELPERS
   ================================================================ */
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }

let _toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ================================================================
   CURSOR / PARTICLES / PARALLAX / AOS
   ================================================================ */
function initCursor() {
  const dot = document.getElementById('cursor'), ring = document.getElementById('cursorRing');
  if (!dot || !ring) return;
  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; dot.style.left = mx + 'px'; dot.style.top = my + 'px'; });
  (function loop() { rx += (mx - rx) * .12; ry += (my - ry) * .12; ring.style.left = rx + 'px'; ring.style.top = ry + 'px'; requestAnimationFrame(loop); })();
  document.addEventListener('mousedown', () => { dot.style.transform = 'translate(-50%,-50%) scale(.6)'; ring.style.transform = 'translate(-50%,-50%) scale(.85)'; });
  document.addEventListener('mouseup', () => { dot.style.transform = ''; ring.style.transform = ''; });
  document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; ring.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { dot.style.opacity = '1'; ring.style.opacity = '1'; });
}
function bindCursorHover(els) {
  els.forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
}
function initParticles() {
  const wrap = document.getElementById('particles'); if (!wrap) return;
  const colors = ['rgba(167,139,250,.6)', 'rgba(34,211,238,.5)', 'rgba(249,168,212,.4)', 'rgba(110,231,183,.4)'];
  for (let i = 0; i < 55; i++) {
    const p = document.createElement('div'); p.className = 'particle';
    const s = 1 + Math.random() * 3;
    p.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;background:${colors[Math.floor(Math.random() * colors.length)]};animation-duration:${12 + Math.random() * 22}s;animation-delay:${-Math.random() * 25}s;`;
    wrap.appendChild(p);
  }
}
function initParallax() {
  const blobs = document.querySelectorAll('.blob');
  document.addEventListener('mousemove', e => {
    const cx = (e.clientX / window.innerWidth - .5) * 2, cy = (e.clientY / window.innerHeight - .5) * 2;
    blobs.forEach((b, i) => { const d = (i + 1) * 12; b.style.transform = `translate(${cx * d}px,${cy * d}px)`; });
  });
}
function initAOS() {
  const obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.style.animationPlayState = 'running'; obs.unobserve(e.target); } }), { threshold: .1 });
  document.querySelectorAll('[data-aos]').forEach(el => { el.style.animationPlayState = 'paused'; obs.observe(el); });
}

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  document.getElementById('year').value  = now.getFullYear();
  document.getElementById('month').value = String(now.getMonth() + 1).padStart(2, '0');

  // seed members
  members = [
    { id: nid(), name: 'Tôi', count: 1 },
    { id: nid(), name: 'Vợ chồng em gái', count: 2 },
  ];
  // seed fixed costs (all members participate)
  fixed = FIXED_SEED.map(f => ({ id: nid(), emoji: f.emoji, label: f.label, amount: 0, mode: f.mode, participants: members.map(m => m.id) }));
  custom = [];

  renderMembers();
  renderFixed();
  renderCustom();

  initParticles(); initCursor(); initParallax(); initAOS();
  refreshHistory();
  bindCursorHover(document.querySelectorAll('button, input, select, .history-item'));
});
