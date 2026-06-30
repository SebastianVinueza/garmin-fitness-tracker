// v3.0 - FIT/TCX binary parser + GPX fix
// ============================================================
// GARMIN FITNESS TRACKER - app.js
// ============================================================

const SUPABASE_URL = 'https://snmqnbxmjiivjyeevugd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNubXFuYnhtamlpdmp5ZWV2dWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTI0MDcsImV4cCI6MjA5ODI2ODQwN30.mktcJueyphNdvnpxc6fNf8zYMJJqkpToOa5TVUP5E9g';

let _db;
let currentUser = null;
let charts = {};
let currentFile = null;
let parsedActivityData = null;

// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  _db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { session } } = await _db.auth.getSession();
  if (session) { currentUser = session.user; showMainApp(); }
  else { showAuthScreen(); }
  _db.auth.onAuthStateChange((event, session) => {
    if (session) { currentUser = session.user; showMainApp(); }
    else { currentUser = null; showAuthScreen(); }
  });
  const rpeSlider = document.getElementById('activity-rpe');
  if (rpeSlider) rpeSlider.addEventListener('input', () => {
    document.getElementById('rpe-value').textContent = rpeSlider.value;
  });
  document.getElementById('daily-date-picker').value = new Date().toISOString().split('T')[0];
});

// ---- AUTH ----
function showAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
  event.target.classList.add('active');
  document.getElementById(tab + '-form').classList.remove('hidden');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('auth-message');
  msg.textContent = 'Iniciando sesion...'; msg.className = 'message';
  const { error } = await _db.auth.signInWithPassword({ email, password });
  if (error) { msg.textContent = error.message; msg.className = 'message error'; }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const msg = document.getElementById('auth-message');
  msg.textContent = 'Creando cuenta...'; msg.className = 'message';
  const { error } = await _db.auth.signUp({ email, password });
  if (error) { msg.textContent = error.message; msg.className = 'message error'; }
  else { msg.textContent = 'Cuenta creada. Revisa tu correo.'; msg.className = 'message success'; }
}

async function handleLogout() { await _db.auth.signOut(); }

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('main-app').classList.add('hidden');
}

async function showMainApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  document.getElementById('main-app').style.display = 'flex';
  await loadProfile();
  await loadDashboard();
}

// ---- NAVIGATION ----
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => { p.classList.add('hidden'); p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) { pageEl.classList.remove('hidden'); pageEl.classList.add('active'); }
  document.getElementById('page-title').textContent = {
    dashboard:'Dashboard', activities:'Actividades', daily:'Metricas Diarias',
    records:'Records Personales', plans:'Planes de Entrenamiento', profile:'Mi Perfil'
  }[page] || page;
  event.currentTarget.classList.add('active');
  if (page === 'activities') loadActivities();
  if (page === 'daily') loadDailyMetrics();
  if (page === 'records') loadRecords();
  if (page === 'plans') loadPlans();
  if (page === 'profile') loadProfilePage();
}

function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); }

// ---- DASHBOARD ----
async function loadDashboard() {
  if (!currentUser) return;
  const { data: activities } = await _db.from('activities').select('*')
    .eq('user_id', currentUser.id).order('fecha_inicio', { ascending: false });
  if (!activities) return;
  const totalDist = activities.reduce((s,a) => s + (a.distancia_metros||0), 0) / 1000;
  const totalCal  = activities.reduce((s,a) => s + (a.calorias||0), 0);
  const totalTime = activities.reduce((s,a) => s + (a.duracion_segundos||0), 0);
  document.getElementById('total-activities').textContent = activities.length;
  document.getElementById('total-distance').textContent   = totalDist.toFixed(1) + ' km';
  document.getElementById('total-calories').textContent   = totalCal.toLocaleString();
  document.getElementById('total-time').textContent       = formatDuration(totalTime, true);
  const recentList = document.getElementById('recent-list');
  recentList.innerHTML = (activities.slice(0,5).length > 0
    ? activities.slice(0,5).map(function(a) {
      var id = String(a.id);
      var row = ['<div class="activity-row" onclick="showActivityDetail(', id, ')">'];
      row.push('<div class="activity-sport-icon">' + sportIcon(a.tipo_actividad) + '</div>');
      row.push('<div class="activity-info">');
      row.push('<div class="activity-name">' + (a.nombre||'Sin nombre') + '</div>');
      row.push('<div class="activity-meta"><span>' + formatDate(a.fecha_inicio) + '</span><span>' + (a.tipo_actividad||'Actividad') + '</span></div>');
      row.push('</div><div class="activity-stats">');
      row.push('<div class="activity-distance">' + ((a.distancia_metros||0)/1000).toFixed(2) + ' km</div>');
      row.push('<div class="activity-duration">' + formatDuration(a.duracion_segundos) + '</div>');
      row.push('</div></div>');
      return row.join('');
    }).join('')
    : '<div class="empty-state"><p>Sube tu primera actividad</p></div>');
    renderWeeklyChart(activities);
  renderSportChart(activities);
}

function renderWeeklyChart(activities) {
  const ctx = document.getElementById('weekly-chart');
  if (!ctx) return;
  if (charts.weekly) charts.weekly.destroy();
  const weeks = {};
  activities.forEach(a => {
    const d = new Date(a.fecha_inicio);
    const week = getWeekKey(d);
    weeks[week] = (weeks[week] || 0) + 1;
  });
  const labels = Object.keys(weeks).slice(-8);
  const data = labels.map(k => weeks[k]);
  charts.weekly = new Chart(ctx, {
    type: 'bar',
    data: { labels: labels.map(l => 'Sem ' + l.split('-W')[1]), datasets: [{ label: 'Actividades', data, backgroundColor: 'rgba(0,180,216,0.7)', borderRadius: 6 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#334155' }, ticks: { color: '#94A3B8' } }, y: { grid: { color: '#334155' }, ticks: { color: '#94A3B8', stepSize: 1 } } } }
  });
}

function renderSportChart(activities) {
  const ctx = document.getElementById('sport-chart');
  if (!ctx) return;
  if (charts.sport) charts.sport.destroy();
  const sports = {};
  activities.forEach(a => { const s = a.tipo_actividad||'other'; sports[s] = (sports[s]||0) + 1; });
  charts.sport = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: Object.keys(sports).map(l => l.charAt(0).toUpperCase()+l.slice(1)), datasets: [{ data: Object.values(sports), backgroundColor: ['#00B4D8','#10B981','#F59E0B','#8B5CF6','#EF4444','#F97316'] }] },
    options: { responsive: true, plugins: { legend: { labels: { color: '#94A3B8', padding: 12 } } } }
  });
}

// ---- ACTIVITIES ----
async function loadActivities() {
  if (!currentUser) return;
  const sport = document.getElementById('filter-sport')?.value;
  const from  = document.getElementById('filter-date-from')?.value;
  const to    = document.getElementById('filter-date-to')?.value;
  const list  = document.getElementById('activities-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  let query = _db.from('activities').select('*').eq('user_id', currentUser.id).order('fecha_inicio', { ascending: false });
  if (sport) query = query.eq('tipo_actividad', sport);
  if (from)  query = query.gte('fecha_inicio', from);
  if (to)    query = query.lte('fecha_inicio', to + 'T23:59:59');
  const { data, error } = await query;
  if (error || !data?.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🏃</div><p>No hay actividades. Sube tu primera!</p></div>';
    return;
  }
  list.innerHTML = (data.length > 0
    ? data.map(function(a) {
      var id = String(a.id);
      var card = ['<div class="activity-card" onclick="showActivityDetail(', id, ')">'];
      card.push('<div class="activity-sport-icon">' + sportIcon(a.tipo_actividad) + '</div>');
      card.push('<div class="activity-info">');
      card.push('<div class="activity-name">' + (a.nombre||'Actividad sin nombre') + '</div>');
      card.push('<div class="activity-meta"><span>' + formatDate(a.fecha_inicio) + '</span></div>');
      card.push('</div><div class="activity-card-stats">');
      card.push('<div class="act-stat"><div class="act-stat-value">' + ((a.distancia_metros||0)/1000).toFixed(2) + '</div><div class="act-stat-label">km</div></div>');
      card.push('<div class="act-stat"><div class="act-stat-value">' + formatDuration(a.duracion_segundos) + '</div><div class="act-stat-label">Tiempo</div></div>');
      card.push('<div class="act-stat"><div class="act-stat-value">' + (a.frecuencia_cardiaca_promedio||'--') + '</div><div class="act-stat-label">FC Media</div></div>');
      card.push('<div class="act-stat"><div class="act-stat-value">' + (a.calorias||'--') + '</div><div class="act-stat-label">kcal</div></div>');
      card.push('</div></div>');
      return card.join('');
    }).join('')
    : '<div class="empty-state"><p>No hay actividades. Sube tu primera!</p></div>'))
}

async function showActivityDetail(id) {
  const { data: a } = await _db.from('activities').select('*').eq('id', id).single();
  if (!a) return;
  const modal = document.getElementById('activity-detail-modal');
  document.getElementById('detail-title').textContent = a.nombre || 'Detalle de Actividad';
  var pace = a.pace_promedio_seg_km ? formatPace(a.pace_promedio_seg_km) : '--';
  var elev = a.elevacion_ganada_m ? a.elevacion_ganada_m.toFixed(0) + ' m' : '--';
  var html = '<div class="detail-stats-grid">';
  html += '<div class="detail-stat"><div class="detail-stat-label">Distancia</div><div class="detail-stat-value">' + ((a.distancia_metros||0)/1000).toFixed(2) + ' km</div></div>';
  html += '<div class="detail-stat"><div class="detail-stat-label">Tiempo</div><div class="detail-stat-value">' + formatDuration(a.duracion_segundos) + '</div></div>';
  html += '<div class="detail-stat"><div class="detail-stat-label">Ritmo</div><div class="detail-stat-value">' + pace + '/km</div></div>';
  html += '<div class="detail-stat"><div class="detail-stat-label">FC Media</div><div class="detail-stat-value">' + (a.frecuencia_cardiaca_promedio||'--') + ' bpm</div></div>';
  html += '<div class="detail-stat"><div class="detail-stat-label">FC Max</div><div class="detail-stat-value">' + (a.frecuencia_cardiaca_maxima||'--') + ' bpm</div></div>';
  html += '<div class="detail-stat"><div class="detail-stat-label">Calorias</div><div class="detail-stat-value">' + (a.calorias||'--') + ' kcal</div></div>';
  html += '<div class="detail-stat"><div class="detail-stat-label">Cadencia</div><div class="detail-stat-value">' + (a.cadencia_promedio||'--') + ' spm</div></div>';
  html += '<div class="detail-stat"><div class="detail-stat-label">Elevacion</div><div class="detail-stat-value">' + elev + '</div></div>';
  html += '<div class="detail-stat"><div class="detail-stat-label">TSS</div><div class="detail-stat-value">' + (a.training_stress_score||'--') + '</div></div>';
  html += '</div>';
  if (a.notas) html += '<div style="background:var(--bg);padding:12px;border-radius:8px;margin-bottom:12px;">' + a.notas + '</div>';
  html += '<div style="display:flex;gap:10px;margin-top:12px;">';
  html += '<button class="btn-secondary" style="flex:1;color:var(--danger);" onclick="deleteActivity(' + JSON.stringify(a.id) + ')">Eliminar</button>';
  html += '</div>';
  document.getElementById('activity-detail-content').innerHTML = html;
  modal.classList.remove('hidden');
}
async function deleteActivity(id) {
  if (!confirm('Eliminar esta actividad?')) return;
  const { error } = await _db.from('activities').delete().eq('id', id);
  if (!error) { closeModal('activity-detail-modal'); loadActivities(); loadDashboard(); showToast('Actividad eliminada', 'success'); }
}

// ---- FILE UPLOAD ----
function showUploadModal() { document.getElementById('upload-modal').classList.remove('hidden'); }

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  currentFile = file;
  parsedActivityData = null;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['gpx','fit','tcx','csv'].includes(ext)) {
    showToast('Formato no soportado. Usa GPX, FIT, TCX o CSV', 'error'); return;
  }
  document.getElementById('file-name-display').textContent = file.name;
  document.getElementById('file-size-display').textContent = (file.size/1024).toFixed(1) + ' KB';
  document.getElementById('activity-name').value = file.name.replace(/.[^.]+$/, '');
  document.getElementById('upload-area').classList.add('hidden');
  document.getElementById('upload-preview').classList.remove('hidden');

  const reader = new FileReader();
  if (ext === 'gpx') {
    reader.onload = e => { parsedActivityData = parseGPX(e.target.result); };
    reader.readAsText(file);
  } else if (ext === 'tcx') {
    reader.onload = e => { parsedActivityData = parseTCX(e.target.result); };
    reader.readAsText(file);
  } else if (ext === 'fit') {
    reader.onload = e => { parsedActivityData = parseFIT(e.target.result); };
    reader.readAsArrayBuffer(file);
  }
}

// ---- GPX PARSER ----
function parseGPX(xmlString) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, 'text/xml');
  const trkpts = xml.querySelectorAll('trkpt');
  const points = [];
  let totalDist = 0;
  let prevPt = null;
  const times = [], elevs = [], hrs = [];

  trkpts.forEach(pt => {
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));
    const ele = parseFloat(pt.querySelector('ele')?.textContent || 0);
    const time = pt.querySelector('time')?.textContent;
    const hrEl = pt.querySelector('hr, heartrate, value, gpxtpx\:hr');
    const hr = hrEl ? parseInt(hrEl.textContent) : 0;

    if (!isNaN(lat) && !isNaN(lon)) {
      points.push([lat, lon]);
      if (prevPt) totalDist += haversine(prevPt[0], prevPt[1], lat, lon);
      prevPt = [lat, lon];
    }
    if (time) times.push(new Date(time));
    if (ele > 0) elevs.push(ele);
    if (hr > 0) hrs.push(hr);
  });

  const duration = times.length > 1 ? (times[times.length-1] - times[0]) / 1000 : 0;
  const avgHr = hrs.length ? Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length) : null;
  const maxHr = hrs.length ? Math.max(...hrs) : null;
  let elevGain = 0;
  for (let i = 1; i < elevs.length; i++) if (elevs[i] > elevs[i-1]) elevGain += elevs[i]-elevs[i-1];

  return {
    totalDist, duration,
    startTime: times[0]?.toISOString(),
    endTime:   times[times.length-1]?.toISOString(),
    avgHr, maxHr,
    elevGain: parseFloat(elevGain.toFixed(1)),
    startCoords: points[0] ? { lat: points[0][0], lng: points[0][1] } : null
  };
}

// ---- TCX PARSER ----
function parseTCX(xmlString) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, 'text/xml');
  const trkpts = xml.querySelectorAll('Trackpoint');
  const times = [], hrs = [], elevs = [], speeds = [];
  let totalDist = 0;
  let prevPt = null;
  const positions = [];

  trkpts.forEach(tp => {
    const time = tp.querySelector('Time')?.textContent;
    const hr   = parseInt(tp.querySelector('HeartRateBpm Value, HeartRateBpm')?.textContent || 0);
    const ele  = parseFloat(tp.querySelector('AltitudeMeters')?.textContent || 0);
    const dist = parseFloat(tp.querySelector('DistanceMeters')?.textContent || 0);
    const lat  = parseFloat(tp.querySelector('LatitudeDegrees')?.textContent);
    const lon  = parseFloat(tp.querySelector('LongitudeDegrees')?.textContent);
    const cadence = parseInt(tp.querySelector('RunCadence, Cadence')?.textContent || 0);

    if (time) times.push(new Date(time));
    if (hr > 0) hrs.push(hr);
    if (ele > 0) elevs.push(ele);
    if (!isNaN(lat) && !isNaN(lon)) positions.push([lat, lon]);
    if (dist > totalDist) totalDist = dist;
  });

  // Try DistanceMeters from last trackpoint or sum
  if (totalDist === 0 && positions.length > 1) {
    let d = 0, prev = null;
    positions.forEach(p => { if (prev) d += haversine(prev[0], prev[1], p[0], p[1]); prev = p; });
    totalDist = d;
  }

  const calEl = xml.querySelector('Calories');
  const calories = calEl ? parseInt(calEl.textContent) : null;

  const duration = times.length > 1 ? (times[times.length-1] - times[0]) / 1000 : 0;
  const avgHr = hrs.length ? Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length) : null;
  const maxHr = hrs.length ? Math.max(...hrs) : null;
  let elevGain = 0;
  for (let i = 1; i < elevs.length; i++) if (elevs[i] > elevs[i-1]) elevGain += elevs[i]-elevs[i-1];

  return {
    totalDist, duration,
    startTime: times[0]?.toISOString(),
    endTime:   times[times.length-1]?.toISOString(),
    avgHr, maxHr, calories,
    elevGain: parseFloat(elevGain.toFixed(1)),
    startCoords: positions[0] ? { lat: positions[0][0], lng: positions[0][1] } : null
  };
}

// ---- FIT BINARY PARSER ----
function parseFIT(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view  = new DataView(arrayBuffer);
  if (bytes.length < 14) return null;
  const headerSize = bytes[0];
  const dataType = String.fromCharCode(bytes[8],bytes[9],bytes[10],bytes[11]);
  if (dataType !== '.FIT') return null;

  const localMessageDefs = {};
  let offset = headerSize;
  const dataEnd = bytes.length - 2;
  const records = [];
  let sessionData = null;
  const MESG_SESSION = 18;
  const MESG_RECORD  = 20;

  while (offset < dataEnd) {
    if (offset >= bytes.length) break;
    const recordHeader = bytes[offset];
    const isCompressed = (recordHeader & 0x80) !== 0;
    const isDefinition = !isCompressed && (recordHeader & 0x40) !== 0;
    const localMesgNum = isCompressed ? (recordHeader >> 5) & 0x03 : recordHeader & 0x0F;
    const hasDeveloper = !isCompressed && (recordHeader & 0x20) !== 0;
    offset++;

    if (isDefinition) {
      offset++;
      const arch = bytes[offset++];
      const le = arch === 0;
      const globalMesgNum = le ? view.getUint16(offset,true) : view.getUint16(offset,false);
      offset += 2;
      const numFields = bytes[offset++];
      const fields = [];
      for (let i = 0; i < numFields; i++) {
        const fieldDefNum = bytes[offset++];
        const fieldSize   = bytes[offset++];
        const baseType    = bytes[offset++];
        fields.push({ fieldDefNum, fieldSize, baseType });
      }
      if (hasDeveloper) {
        const numDev = bytes[offset++];
        for (let i = 0; i < numDev; i++) offset += 3;
      }
      localMessageDefs[localMesgNum] = { globalMesgNum, littleEndian: le, fields };
    } else {
      const def = localMessageDefs[localMesgNum];
      if (!def) { offset++; continue; }
      const rec = { _type: def.globalMesgNum };
      for (const f of def.fields) {
        const { fieldDefNum, fieldSize, baseType } = f;
        const bt = baseType & 0x9F;
        let v = 0;
        try {
          const le = def.littleEndian;
          if      (bt===0x00||bt===0x02||bt===0x0A) v = bytes[offset];
          else if (bt===0x01) v = view.getInt8(offset);
          else if (bt===0x83) v = le ? view.getInt16(offset,true)  : view.getInt16(offset,false);
          else if (bt===0x84) v = le ? view.getUint16(offset,true) : view.getUint16(offset,false);
          else if (bt===0x85) v = le ? view.getInt32(offset,true)  : view.getInt32(offset,false);
          else if (bt===0x86) v = le ? view.getUint32(offset,true) : view.getUint32(offset,false);
          else v = bytes[offset];
        } catch(e) { v = 0; }
        rec[fieldDefNum] = v;
        offset += fieldSize;
      }
      if (def.globalMesgNum === MESG_RECORD)  records.push(rec);
      if (def.globalMesgNum === MESG_SESSION) sessionData = rec;
    }
  }

  const SPORT_MAP = {0:'other',1:'running',2:'cycling',5:'swimming',4:'hiking',11:'walking',10:'strength'};
  const SEMICIRCLE = 180 / Math.pow(2,31);

  let totalDist=0, duration=0, calories=null, avgHr=null, maxHr=null;
  let avgCadence=null, maxSpeed=0, elevGain=0, startTime=null, endTime=null;
  let sportCode=0;

  if (sessionData) {
    if (sessionData[9]  !== undefined && sessionData[9]  < 0xFFFFFFFF) totalDist = sessionData[9] / 100;
    if (sessionData[7]  !== undefined && sessionData[7]  < 0xFFFFFFFF) duration  = sessionData[7] / 1000;
    if (sessionData[11] !== undefined && sessionData[11] < 0xFFFF)     calories  = sessionData[11];
    if (sessionData[14] !== undefined && sessionData[14] < 0xFF)       avgHr     = sessionData[14];
    if (sessionData[15] !== undefined && sessionData[15] < 0xFF)       maxHr     = sessionData[15];
    if (sessionData[16] !== undefined && sessionData[16] < 0xFF)       avgCadence= sessionData[16];
    if (sessionData[19] !== undefined && sessionData[19] < 0xFFFF)     maxSpeed  = sessionData[19]/1000;
    if (sessionData[22] !== undefined && sessionData[22] < 0xFFFF)     elevGain  = sessionData[22];
    if (sessionData[5]  !== undefined)                                  sportCode = sessionData[5];
    if (sessionData[2]  !== undefined && sessionData[2]  < 0xFFFFFFFF) {
      startTime = new Date((sessionData[2] + 631065600) * 1000).toISOString();
      if (duration) endTime = new Date((sessionData[2] + 631065600 + Math.round(duration)) * 1000).toISOString();
    }
  }

  let startCoords = null, recHrs = [], recLats = [], recLons = [];
  records.forEach(r => {
    const lat = r[0], lon = r[1];
    if (lat !== undefined && lon !== undefined && lat !== 0x7FFFFFFF && lon !== 0x7FFFFFFF && lat !== 0) {
      const latD = lat * SEMICIRCLE;
      const lonD = lon * SEMICIRCLE;
      if (!startCoords) startCoords = { lat: latD, lng: lonD };
      recLats.push(latD); recLons.push(lonD);
    }
    if (r[3] !== undefined && r[3] > 0 && r[3] < 0xFF) recHrs.push(r[3]);
    if (r[253] !== undefined && r[253] < 0xFFFFFFFF && !startTime)
      startTime = new Date((r[253] + 631065600) * 1000).toISOString();
  });

  if (!totalDist && recLats.length > 1) {
    let d=0;
    for (let i=1;i<recLats.length;i++) d += haversine(recLats[i-1],recLons[i-1],recLats[i],recLons[i]);
    totalDist = d;
  }
  if (!avgHr && recHrs.length) avgHr = Math.round(recHrs.reduce((a,b)=>a+b,0)/recHrs.length);
  if (!maxHr && recHrs.length) maxHr = Math.max(...recHrs);

  return {
    totalDist, duration: Math.round(duration), startTime, endTime,
    avgHr, maxHr, avgCadence, maxSpeed, elevGain, calories, startCoords,
    sport: SPORT_MAP[sportCode] || 'other'
  };
}

// ---- TCX PARSER ----
function parseTCX(xmlString) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, 'text/xml');
  const trkpts = xml.querySelectorAll('Trackpoint');
  const times=[],hrs=[],elevs=[],positions=[];
  let totalDist=0;

  trkpts.forEach(tp => {
    const time = tp.querySelector('Time')?.textContent;
    const hr   = parseInt(tp.querySelector('HeartRateBpm Value')?.textContent || tp.querySelector('HeartRateBpm')?.textContent || 0);
    const ele  = parseFloat(tp.querySelector('AltitudeMeters')?.textContent || 0);
    const dist = parseFloat(tp.querySelector('DistanceMeters')?.textContent || 0);
    const lat  = parseFloat(tp.querySelector('LatitudeDegrees')?.textContent);
    const lon  = parseFloat(tp.querySelector('LongitudeDegrees')?.textContent);
    if (time) times.push(new Date(time));
    if (hr > 0) hrs.push(hr);
    if (ele > 0) elevs.push(ele);
    if (!isNaN(lat) && !isNaN(lon)) positions.push([lat,lon]);
    if (dist > totalDist) totalDist = dist;
  });

  if (totalDist === 0 && positions.length > 1) {
    let d=0, prev=null;
    positions.forEach(p => { if(prev) d+=haversine(prev[0],prev[1],p[0],p[1]); prev=p; });
    totalDist = d;
  }

  const calories = parseInt(xml.querySelector('Calories')?.textContent || 0) || null;
  const duration = times.length > 1 ? (times[times.length-1]-times[0])/1000 : 0;
  const avgHr = hrs.length ? Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length) : null;
  const maxHr = hrs.length ? Math.max(...hrs) : null;
  let elevGain=0;
  for(let i=1;i<elevs.length;i++) if(elevs[i]>elevs[i-1]) elevGain+=elevs[i]-elevs[i-1];

  return {
    totalDist, duration: Math.round(duration),
    startTime: times[0]?.toISOString(),
    endTime:   times[times.length-1]?.toISOString(),
    avgHr, maxHr, calories,
    elevGain: parseFloat(elevGain.toFixed(1)),
    startCoords: positions[0] ? {lat:positions[0][0],lng:positions[0][1]} : null
  };
}

// ---- GPX PARSER ----
function parseGPX(xmlString) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, 'text/xml');
  const trkpts = xml.querySelectorAll('trkpt');
  const points=[],times=[],elevs=[],hrs=[];
  let totalDist=0, prevPt=null;

  trkpts.forEach(pt => {
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));
    const ele = parseFloat(pt.querySelector('ele')?.textContent || 0);
    const time = pt.querySelector('time')?.textContent;
    const hrText = pt.querySelector('hr, heartrate, value')?.textContent;
    const hr = hrText ? parseInt(hrText) : 0;
    if (!isNaN(lat) && !isNaN(lon)) {
      points.push([lat,lon]);
      if (prevPt) totalDist += haversine(prevPt[0],prevPt[1],lat,lon);
      prevPt = [lat,lon];
    }
    if (time) times.push(new Date(time));
    if (ele>0) elevs.push(ele);
    if (hr>0) hrs.push(hr);
  });

  const duration = times.length>1 ? (times[times.length-1]-times[0])/1000 : 0;
  const avgHr = hrs.length ? Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length) : null;
  const maxHr = hrs.length ? Math.max(...hrs) : null;
  let elevGain=0;
  for(let i=1;i<elevs.length;i++) if(elevs[i]>elevs[i-1]) elevGain+=elevs[i]-elevs[i-1];

  return {
    totalDist, duration: Math.round(duration),
    startTime: times[0]?.toISOString(),
    endTime:   times[times.length-1]?.toISOString(),
    avgHr, maxHr,
    elevGain: parseFloat(elevGain.toFixed(1)),
    startCoords: points[0] ? {lat:points[0][0],lng:points[0][1]} : null
  };
}

function haversine(lat1,lon1,lat2,lon2) {
  const R=6371000;
  const phi1=lat1*Math.PI/180, phi2=lat2*Math.PI/180;
  const dphi=(lat2-lat1)*Math.PI/180, dlam=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dphi/2)**2+Math.cos(phi1)*Math.cos(phi2)*Math.sin(dlam/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

async function uploadActivity() {
  if (!currentFile || !currentUser) return;
  const name  = document.getElementById('activity-name').value || currentFile.name;
  const type  = document.getElementById('activity-type').value;
  const notes = document.getElementById('activity-notes').value;
  const rpe   = parseInt(document.getElementById('activity-rpe').value);

  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-progress').classList.remove('hidden');
  document.getElementById('progress-fill').style.width = '30%';
  document.getElementById('upload-status').textContent = 'Procesando datos...';

  // Wait a bit for async parsers to finish
  await new Promise(r => setTimeout(r, 300));

  const activityData = {
    user_id: currentUser.id,
    nombre: name,
    tipo_actividad: type,
    notas: notes,
    percepcion_esfuerzo: rpe,
    sincronizado_en: new Date().toISOString(),
    fecha_inicio: new Date().toISOString()
  };

  const p = parsedActivityData;
  if (p) {
    if (p.totalDist  > 0)          activityData.distancia_metros           = parseFloat(p.totalDist.toFixed(2));
    if (p.duration   > 0)          activityData.duracion_segundos          = Math.round(p.duration);
    if (p.startTime)               activityData.fecha_inicio               = p.startTime;
    if (p.endTime)                 activityData.fecha_fin                  = p.endTime;
    if (p.avgHr)                   activityData.frecuencia_cardiaca_promedio = p.avgHr;
    if (p.maxHr)                   activityData.frecuencia_cardiaca_maxima  = p.maxHr;
    if (p.elevGain > 0)            activityData.elevacion_ganada_m         = p.elevGain;
    if (p.calories)                activityData.calorias                   = p.calories;
    if (p.avgCadence)              activityData.cadencia_promedio          = p.avgCadence;
    if (p.maxSpeed > 0)            activityData.velocidad_maxima_ms        = p.maxSpeed;
    if (activityData.duracion_segundos > 0 && activityData.distancia_metros > 0)
      activityData.pace_promedio_seg_km = Math.round(activityData.duracion_segundos / (activityData.distancia_metros / 1000));
    // Use FIT sport if user didn't change type
    if (p.sport && p.sport !== 'other' && type === 'running') activityData.tipo_actividad = p.sport;
  }

  document.getElementById('progress-fill').style.width = '70%';
  document.getElementById('upload-status').textContent = 'Guardando en base de datos...';

  const { error } = await _db.from('activities').insert([activityData]);
  document.getElementById('progress-fill').style.width = '100%';

  if (error) {
    document.getElementById('upload-status').textContent = 'Error: ' + error.message;
    showToast('Error al guardar: ' + error.message, 'error');
  } else {
    document.getElementById('upload-status').textContent = 'Actividad guardada correctamente!';
    showToast('Actividad subida exitosamente!', 'success');
    setTimeout(() => {
      closeModal('upload-modal');
      resetUploadModal();
      loadActivities();
      loadDashboard();
    }, 1500);
  }
}

function resetUploadModal() {
  currentFile = null; parsedActivityData = null;
  document.getElementById('upload-area').classList.remove('hidden');
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-progress').classList.add('hidden');
  document.getElementById('progress-fill').style.width = '0';
  document.getElementById('file-input').value = '';
}

// ---- DAILY METRICS ----
async function loadDailyMetrics() {
  if (!currentUser) return;
  const date = document.getElementById('daily-date-picker')?.value || new Date().toISOString().split('T')[0];
  const { data } = await _db.from('daily_metrics').select('*').eq('user_id',currentUser.id).eq('fecha',date).single();
  const set = (id,val,suffix='') => { const el=document.getElementById(id); if(el) el.textContent=val ? val+suffix : '--'; };
  set('d-steps', data?.pasos?.toLocaleString());
  set('d-hr',    data?.frecuencia_cardiaca_reposo,' bpm');
  set('d-battery',data?.body_battery_max);
  set('d-sleep', data?.horas_sueno?.toFixed(1),' h');
  set('d-stress',data?.nivel_estres);
  set('d-hrv',   data?.variabilidad_fc_hrv,' ms');
  set('d-readiness',data?.training_readiness);
  set('d-spo2',  data?.spo2_promedio?.toFixed(1),'%');
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate()-7);
  const { data: weekData } = await _db.from('daily_metrics').select('*')
    .eq('user_id',currentUser.id).gte('fecha',sevenDaysAgo.toISOString().split('T')[0]).order('fecha');
  renderWellnessChart(weekData||[]);
}

function renderWellnessChart(data) {
  const ctx = document.getElementById('wellness-chart');
  if (!ctx) return;
  if (charts.wellness) charts.wellness.destroy();
  charts.wellness = new Chart(ctx, {
    type:'line',
    data: {
      labels: data.map(d => d.fecha?.substring(5)),
      datasets: [
        { label:'Body Battery',       data:data.map(d=>d.body_battery_max),    borderColor:'#00B4D8',tension:0.4,fill:false },
        { label:'Training Readiness', data:data.map(d=>d.training_readiness),  borderColor:'#10B981',tension:0.4,fill:false },
        { label:'Estres',             data:data.map(d=>d.nivel_estres),        borderColor:'#EF4444',tension:0.4,fill:false }
      ]
    },
    options: { responsive:true,
      scales: { x:{grid:{color:'#334155'},ticks:{color:'#94A3B8'}}, y:{grid:{color:'#334155'},ticks:{color:'#94A3B8'},min:0,max:100} },
      plugins: { legend:{labels:{color:'#94A3B8'}} }
    }
  });
}

// ---- RECORDS ----
async function loadRecords() {
  if (!currentUser) return;
  const { data:acts } = await _db.from('activities').select('*').eq('user_id',currentUser.id).eq('tipo_actividad','running').order('pace_promedio_seg_km',{ascending:true});
  const findBest = (min,max) => acts?.find(a => a.distancia_metros>=min && a.distancia_metros<=max && a.duracion_segundos);
  const fmtTime = secs => { if(!secs) return '--:--'; const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60; return h>0?h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); };
  const pr5k=findBest(4900,5100), pr10k=findBest(9900,10100), prHalf=findBest(21000,21200), prFull=findBest(42100,42300);
  document.getElementById('pr-5k').textContent   = pr5k  ? fmtTime(pr5k.duracion_segundos)  : '--:--';
  document.getElementById('pr-10k').textContent  = pr10k ? fmtTime(pr10k.duracion_segundos) : '--:--';
  document.getElementById('pr-half').textContent = prHalf? fmtTime(prHalf.duracion_segundos): '--:--';
  document.getElementById('pr-full').textContent = prFull? fmtTime(prFull.duracion_segundos): '--:--';
  const { data:allActs } = await _db.from('activities').select('distancia_metros,velocidad_maxima_ms').eq('user_id',currentUser.id);
  if (allActs?.length) {
    const longest  = Math.max(...allActs.map(a=>a.distancia_metros||0));
    const maxSpd   = Math.max(...allActs.map(a=>a.velocidad_maxima_ms||0));
    document.getElementById('pr-longest').textContent = (longest/1000).toFixed(2)+' km';
    document.getElementById('pr-speed').textContent   = (maxSpd*3.6).toFixed(1)+' km/h';
  }
}

// ---- PLANS ----
async function loadPlans() {
  if (!currentUser) return;
  const { data } = await _db.from('training_plans').select('*').eq('user_id',currentUser.id).order('creado_en',{ascending:false});
  const list = document.getElementById('plans-list');
  if (!data?.length) { list.innerHTML='<div class="empty-state"><div class="empty-icon">📋</div><p>No tienes planes. Crea uno!</p></div>'; return; }
  list.innerHTML = data.map(function(p) {
    var pid = String(p.id);
    var card = '<div class="plan-card">';
    card += '<div><h4>' + p.nombre + '</h4>';
    card += '<p style="color:var(--text-muted);font-size:0.85rem;">' + (p.descripcion||'') + '</p>';
    card += '<p style="color:var(--text-muted);font-size:0.8rem;">' + (p.semanas||0) + ' semanas | Inicio: ' + (p.fecha_inicio||'--') + '</p></div>';
    card += '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">';
    card += '<span class="plan-badge">' + (p.deporte||'General') + '</span>';
    card += '<button class="btn-secondary" style="font-size:0.8rem;padding:6px 12px;" onclick="deletePlan(' + JSON.stringify(p.id) + ')">🗑️</button></div></div>';
    return card;
  }).join('');
}

function showCreatePlanModal() { document.getElementById('plan-modal').classList.remove('hidden'); }

async function createPlan(e) {
  e.preventDefault();
  const planData = {
    user_id: currentUser.id,
    nombre:      document.getElementById('plan-name').value,
    descripcion: document.getElementById('plan-desc').value,
    deporte:     document.getElementById('plan-sport').value,
    nivel:       document.getElementById('plan-level').value,
    semanas:     parseInt(document.getElementById('plan-weeks').value)||null,
    fecha_inicio:document.getElementById('plan-start').value,
    activo: true
  };
  const { error } = await _db.from('training_plans').insert([planData]);
  if (!error) { closeModal('plan-modal'); loadPlans(); showToast('Plan creado!','success'); e.target.reset(); }
  else showToast('Error: '+error.message,'error');
}

async function deletePlan(id) {
  if (!confirm('Eliminar este plan?')) return;
  await _db.from('training_plans').delete().eq('id',id);
  loadPlans(); showToast('Plan eliminado','success');
}

// ---- PROFILE ----
async function loadProfile() {
  if (!currentUser) return;
  const { data } = await _db.from('user_profile').select('*').eq('user_id',currentUser.id).limit(1).single();
  if (data) document.getElementById('user-name-display').textContent = data.nombre||'Usuario';
}

async function loadProfilePage() {
  if (!currentUser) return;
  const { data:p } = await _db.from('user_profile').select('*').eq('user_id',currentUser.id).limit(1).single();
  if (p) {
    document.getElementById('profile-name').textContent = p.nombre||'Sebastian Vinueza';
    const age = new Date().getFullYear() - new Date(p.fecha_nacimiento).getFullYear();
    document.getElementById('p-age').textContent    = age+' anos';
    document.getElementById('p-weight').textContent = p.peso_kg+' kg';
    document.getElementById('p-height').textContent = (p.estatura_cm/100).toFixed(2)+' m';
    const bmi = p.peso_kg/Math.pow(p.estatura_cm/100,2);
    document.getElementById('p-bmi').textContent    = bmi.toFixed(1);
    document.getElementById('p-maxhr').textContent  = (220-age)+' bpm';
    document.getElementById('p-resthr').textContent = (p.frecuencia_cardiaca_reposo||60)+' bpm';
  }
}

function connectGarmin() {
  showToast('Integracion Garmin disponible proximamente!','success');
}

// ---- MODALS ----
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ---- UTILS ----
function sportIcon(type) {
  return {running:'🏃',cycling:'🚴',swimming:'🏄',hiking:'🥞',walking:'🚶',strength:'💪',yoga:'🧘',triathlon:'🏅'}[type]||'🏈';
}

function formatDuration(seconds,compact=false) {
  if (!seconds) return '--';
  const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;
  if (compact) return h>0?h+'h '+m+'m':m+'m';
  return h>0?h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

function formatDate(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
}

function formatPace(secsPerKm) {
  if (!secsPerKm) return '--';
  const m=Math.floor(secsPerKm/60),s=secsPerKm%60;
  return m+':'+String(s).padStart(2,'0');
}

function getWeekKey(date) {
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const dayNum=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-dayNum);
  const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return d.getUTCFullYear()+'-W'+String(Math.ceil((((d-yearStart)/86400000)+1)/7)).padStart(2,'0');
}

function showToast(msg,type='success') {
  const toast=document.getElementById('toast');
  toast.textContent=msg;
  toast.className='toast '+type;
  setTimeout(()=>toast.className='toast hidden',3500);
}
