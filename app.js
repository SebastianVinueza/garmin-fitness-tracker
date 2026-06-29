// ============================================================
// GARMIN FITNESS TRACKER - app.js
// Supabase URL: https://snmqnbxmjiivjyeevugd.supabase.co
// ============================================================

const SUPABASE_URL = 'https://snmqnbxmjiivjyeevugd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNubXFuYnhtamlpdmp5ZWV2dWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTI0MDcsImV4cCI6MjA5ODI2ODQwN30.mktcJueyphNdvnpxc6fNf8zYMJJqkpToOa5TVUP5E9g';

let supabase;
let currentUser = null;
let charts = {};
let currentFile = null;
let gpxData = null;

// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    showMainApp();
  } else {
    showAuthScreen();
  }
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) { currentUser = session.user; showMainApp(); }
    else { currentUser = null; showAuthScreen(); }
  });

  // RPE slider
  const rpeSlider = document.getElementById('activity-rpe');
  if (rpeSlider) {
    rpeSlider.addEventListener('input', () => {
      document.getElementById('rpe-value').textContent = rpeSlider.value;
    });
  }

  // Set today's date for daily picker
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
  msg.textContent = 'Iniciando sesion...';
  msg.className = 'message';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { msg.textContent = error.message; msg.className = 'message error'; }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const msg = document.getElementById('auth-message');
  msg.textContent = 'Creando cuenta...';
  msg.className = 'message';
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) { msg.textContent = error.message; msg.className = 'message error'; }
  else {
    msg.textContent = 'Cuenta creada. Revisa tu correo para confirmar.';
    msg.className = 'message success';
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
}

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
    dashboard: 'Dashboard', activities: 'Actividades', daily: 'Metricas Diarias',
    records: 'Records Personales', plans: 'Planes de Entrenamiento', profile: 'Mi Perfil'
  }[page] || page;
  event.currentTarget.classList.add('active');

  if (page === 'activities') loadActivities();
  if (page === 'daily') loadDailyMetrics();
  if (page === 'records') loadRecords();
  if (page === 'plans') loadPlans();
  if (page === 'profile') loadProfilePage();
}

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}

// ---- DASHBOARD ----
async function loadDashboard() {
  if (!currentUser) return;
  const { data: activities } = await supabase
    .from('activities').select('*')
    .eq('user_id', currentUser.id)
    .order('fecha_inicio', { ascending: false });

  if (!activities) return;

  // Stats
  const totalDist = activities.reduce((s, a) => s + (a.distancia_metros || 0), 0) / 1000;
  const totalCal = activities.reduce((s, a) => s + (a.calorias || 0), 0);
  const totalTime = activities.reduce((s, a) => s + (a.duracion_segundos || 0), 0);

  document.getElementById('total-activities').textContent = activities.length;
  document.getElementById('total-distance').textContent = totalDist.toFixed(1) + ' km';
  document.getElementById('total-calories').textContent = totalCal.toLocaleString();
  document.getElementById('total-time').textContent = formatDuration(totalTime, true);

  // Recent activities
  const recentList = document.getElementById('recent-list');
  recentList.innerHTML = activities.slice(0, 5).map(a => `
    <div class="activity-row" onclick="showActivityDetail('${a.id}')">
      <div class="activity-sport-icon">${sportIcon(a.tipo_actividad)}</div>
      <div class="activity-info">
        <div class="activity-name">${a.nombre || 'Sin nombre'}</div>
        <div class="activity-meta">
          <span>${formatDate(a.fecha_inicio)}</span>
          <span>${a.tipo_actividad || 'Actividad'}</span>
        </div>
      </div>
      <div class="activity-stats">
        <div class="activity-distance">${((a.distancia_metros || 0)/1000).toFixed(2)} km</div>
        <div class="activity-duration">${formatDuration(a.duracion_segundos)}</div>
      </div>
    </div>
  `).join('') || '<div class="empty-state"><div class="empty-icon">🏃</div><p>Sube tu primera actividad</p></div>';

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
    data: {
      labels: labels.map(l => 'Sem ' + l.split('-W')[1]),
      datasets: [{ label: 'Actividades', data, backgroundColor: 'rgba(0, 180, 216, 0.7)', borderRadius: 6 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#334155' }, ticks: { color: '#94A3B8' } }, y: { grid: { color: '#334155' }, ticks: { color: '#94A3B8', stepSize: 1 } } } }
  });
}

function renderSportChart(activities) {
  const ctx = document.getElementById('sport-chart');
  if (!ctx) return;
  if (charts.sport) charts.sport.destroy();

  const sports = {};
  activities.forEach(a => { const s = a.tipo_actividad || 'other'; sports[s] = (sports[s] || 0) + 1; });
  const labels = Object.keys(sports);
  const data = Object.values(sports);

  charts.sport = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
      datasets: [{ data, backgroundColor: ['#00B4D8','#10B981','#F59E0B','#8B5CF6','#EF4444','#F97316'] }]
    },
    options: { responsive: true, plugins: { legend: { labels: { color: '#94A3B8', padding: 12 } } } }
  });
}

// ---- ACTIVITIES ----
async function loadActivities() {
  if (!currentUser) return;
  const sport = document.getElementById('filter-sport')?.value;
  const from = document.getElementById('filter-date-from')?.value;
  const to = document.getElementById('filter-date-to')?.value;
  const list = document.getElementById('activities-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  let query = supabase.from('activities').select('*').eq('user_id', currentUser.id).order('fecha_inicio', { ascending: false });
  if (sport) query = query.eq('tipo_actividad', sport);
  if (from) query = query.gte('fecha_inicio', from);
  if (to) query = query.lte('fecha_inicio', to + 'T23:59:59');

  const { data, error } = await query;
  if (error || !data?.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🏃</div><p>No hay actividades. Sube tu primera!</p></div>';
    return;
  }
  list.innerHTML = data.map(a => `
    <div class="activity-card" onclick="showActivityDetail('${a.id}')">
      <div class="activity-sport-icon">${sportIcon(a.tipo_actividad)}</div>
      <div class="activity-info">
        <div class="activity-name">${a.nombre || 'Actividad sin nombre'}</div>
        <div class="activity-meta">
          <span>${formatDate(a.fecha_inicio)}</span>
          <span style="background:rgba(0,180,216,0.15);color:#00B4D8;padding:2px 8px;border-radius:20px;font-size:0.75rem;">${a.tipo_actividad || 'general'}</span>
          ${a.notas ? '<span>📝 ' + a.notas.substring(0,30) + '</span>' : ''}
        </div>
      </div>
      <div class="activity-card-stats">
        <div class="act-stat"><div class="act-stat-value">${((a.distancia_metros||0)/1000).toFixed(2)}</div><div class="act-stat-label">km</div></div>
        <div class="act-stat"><div class="act-stat-value">${formatDuration(a.duracion_segundos)}</div><div class="act-stat-label">Tiempo</div></div>
        <div class="act-stat"><div class="act-stat-value">${a.frecuencia_cardiaca_promedio || '--'}</div><div class="act-stat-label">FC Media</div></div>
        <div class="act-stat"><div class="act-stat-value">${a.calorias || '--'}</div><div class="act-stat-label">kcal</div></div>
      </div>
    </div>
  `).join('');
}

async function showActivityDetail(id) {
  const { data: a } = await supabase.from('activities').select('*').eq('id', id).single();
  if (!a) return;
  const modal = document.getElementById('activity-detail-modal');
  document.getElementById('detail-title').textContent = a.nombre || 'Detalle de Actividad';
  
  const pace = a.pace_promedio_seg_km ? formatPace(a.pace_promedio_seg_km) : '--';
  const elev = a.elevacion_ganada_m ? a.elevacion_ganada_m.toFixed(0) + ' m' : '--';
  
  document.getElementById('activity-detail-content').innerHTML = `
    <div class="detail-stats-grid">
      <div class="detail-stat"><div class="detail-stat-label">Distancia</div><div class="detail-stat-value">${((a.distancia_metros||0)/1000).toFixed(2)} km</div></div>
      <div class="detail-stat"><div class="detail-stat-label">Tiempo</div><div class="detail-stat-value">${formatDuration(a.duracion_segundos)}</div></div>
      <div class="detail-stat"><div class="detail-stat-label">Ritmo</div><div class="detail-stat-value">${pace}/km</div></div>
      <div class="detail-stat"><div class="detail-stat-label">FC Media</div><div class="detail-stat-value">${a.frecuencia_cardiaca_promedio || '--'} bpm</div></div>
      <div class="detail-stat"><div class="detail-stat-label">FC Max</div><div class="detail-stat-value">${a.frecuencia_cardiaca_maxima || '--'} bpm</div></div>
      <div class="detail-stat"><div class="detail-stat-label">Calorias</div><div class="detail-stat-value">${a.calorias || '--'} kcal</div></div>
      <div class="detail-stat"><div class="detail-stat-label">Cadencia</div><div class="detail-stat-value">${a.cadencia_promedio || '--'} spm</div></div>
      <div class="detail-stat"><div class="detail-stat-label">Elevacion</div><div class="detail-stat-value">${elev}</div></div>
      <div class="detail-stat"><div class="detail-stat-label">TSS</div><div class="detail-stat-value">${a.training_stress_score || '--'}</div></div>
    </div>
    ${a.notas ? '<div style="background:var(--bg);padding:12px;border-radius:8px;margin-bottom:12px;font-size:0.9rem;color:var(--text-muted);">📝 ' + a.notas + '</div>' : ''}
    ${a.coordenadas_inicio ? '<div id="map"></div>' : ''}
    <div style="display:flex;gap:10px;margin-top:12px;">
      <button class="btn-secondary" style="flex:1;color:var(--danger);border-color:rgba(239,68,68,0.3);" onclick="deleteActivity('${a.id}')">🗑️ Eliminar</button>
    </div>
  `;
  
  modal.classList.remove('hidden');
  
  if (a.coordenadas_inicio) {
    setTimeout(() => {
      try {
        const coords = typeof a.coordenadas_inicio === 'string' ? JSON.parse(a.coordenadas_inicio) : a.coordenadas_inicio;
        const map = L.map('map').setView([coords.lat || 0, coords.lng || 0], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        L.marker([coords.lat, coords.lng]).addTo(map);
      } catch(e) {}
    }, 200);
  }
}

async function deleteActivity(id) {
  if (!confirm('Eliminar esta actividad?')) return;
  const { error } = await supabase.from('activities').delete().eq('id', id);
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
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['gpx','fit','tcx','csv'].includes(ext)) {
    showToast('Formato no soportado. Usa GPX, FIT, TCX o CSV', 'error'); return;
  }
  document.getElementById('file-name-display').textContent = file.name;
  document.getElementById('file-size-display').textContent = (file.size / 1024).toFixed(1) + ' KB';
  document.getElementById('activity-name').value = file.name.replace(/\.[^.]+$/, '');
  document.getElementById('upload-area').classList.add('hidden');
  document.getElementById('upload-preview').classList.remove('hidden');
  
  if (ext === 'gpx') {
    const reader = new FileReader();
    reader.onload = e => { gpxData = parseGPX(e.target.result); };
    reader.readAsText(file);
  }
}

function parseGPX(xmlString) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, 'text/xml');
  const trkpts = xml.querySelectorAll('trkpt');
  const points = [];
  let totalDist = 0, minLat, maxLat, minLon, maxLon;
  let prevPt = null;
  const times = [], elevs = [], hrs = [];

  trkpts.forEach(pt => {
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('ele') ? pt.getAttribute('lat') : pt.getAttribute('lat'));
    const lonVal = parseFloat(pt.getAttribute('lon'));
    const ele = parseFloat(pt.querySelector('ele')?.textContent || 0);
    const time = pt.querySelector('time')?.textContent;
    const hr = parseInt(pt.querySelector('hr, heartrate, value')?.textContent || 0);

    if (!isNaN(lat) && !isNaN(lonVal)) {
      points.push([lat, lonVal]);
      if (prevPt) totalDist += haversine(prevPt[0], prevPt[1], lat, lonVal);
      prevPt = [lat, lonVal];
      if (!minLat || lat < minLat) minLat = lat;
      if (!maxLat || lat > maxLat) maxLat = lat;
      if (!minLon || lonVal < minLon) minLon = lonVal;
      if (!maxLon || lonVal > maxLon) maxLon = lonVal;
    }
    if (time) times.push(new Date(time));
    if (ele) elevs.push(ele);
    if (hr) hrs.push(hr);
  });

  const duration = times.length > 1 ? (times[times.length-1] - times[0]) / 1000 : 0;
  const avgHr = hrs.length ? Math.round(hrs.reduce((a,b) => a+b, 0) / hrs.length) : null;
  const maxHr = hrs.length ? Math.max(...hrs) : null;
  let elevGain = 0;
  for (let i = 1; i < elevs.length; i++) { if (elevs[i] > elevs[i-1]) elevGain += elevs[i] - elevs[i-1]; }

  return {
    points, totalDist, duration,
    startTime: times[0]?.toISOString(),
    endTime: times[times.length-1]?.toISOString(),
    avgHr, maxHr, elevGain: elevGain.toFixed(1),
    startCoords: points[0] ? { lat: points[0][0], lng: points[0][1] } : null,
    name: xml.querySelector('name')?.textContent,
    type: xml.querySelector('type')?.textContent
  };
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const phi1 = lat1 * Math.PI/180;
  const phi2 = lat2 * Math.PI/180;
  const dphi = (lat2-lat1) * Math.PI/180;
  const dlam = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dphi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dlam/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function uploadActivity() {
  if (!currentFile || !currentUser) return;
  const name = document.getElementById('activity-name').value || currentFile.name;
  const type = document.getElementById('activity-type').value;
  const notes = document.getElementById('activity-notes').value;
  const rpe = parseInt(document.getElementById('activity-rpe').value);

  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-progress').classList.remove('hidden');
  document.getElementById('progress-fill').style.width = '30%';
  document.getElementById('upload-status').textContent = 'Procesando datos...';

  const activityData = {
    user_id: currentUser.id,
    nombre: name,
    tipo_actividad: type,
    notas: notes,
    percepcion_esfuerzo: rpe,
    sincronizado_en: new Date().toISOString()
  };

  if (gpxData) {
    activityData.distancia_metros = parseFloat(gpxData.totalDist?.toFixed(2) || 0);
    activityData.duracion_segundos = Math.round(gpxData.duration || 0);
    activityData.fecha_inicio = gpxData.startTime || new Date().toISOString();
    activityData.fecha_fin = gpxData.endTime;
    activityData.frecuencia_cardiaca_promedio = gpxData.avgHr;
    activityData.frecuencia_cardiaca_maxima = gpxData.maxHr;
    activityData.elevacion_ganada_m = parseFloat(gpxData.elevGain || 0);
    activityData.coordenadas_inicio = gpxData.startCoords;
    if (activityData.duracion_segundos > 0 && activityData.distancia_metros > 0) {
      activityData.pace_promedio_seg_km = Math.round(activityData.duracion_segundos / (activityData.distancia_metros / 1000));
    }
  } else {
    activityData.fecha_inicio = new Date().toISOString();
  }

  document.getElementById('progress-fill').style.width = '70%';
  document.getElementById('upload-status').textContent = 'Guardando en base de datos...';

  const { error } = await supabase.from('activities').insert([activityData]);
  document.getElementById('progress-fill').style.width = '100%';

  if (error) {
    document.getElementById('upload-status').textContent = 'Error: ' + error.message;
    showToast('Error al guardar', 'error');
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
  currentFile = null; gpxData = null;
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
  const { data } = await supabase.from('daily_metrics').select('*').eq('user_id', currentUser.id).eq('fecha', date).single();
  
  const set = (id, val, suffix='') => { const el = document.getElementById(id); if(el) el.textContent = val ? val + suffix : '--'; };
  set('d-steps', data?.pasos?.toLocaleString());
  set('d-hr', data?.frecuencia_cardiaca_reposo, ' bpm');
  set('d-battery', data?.body_battery_max);
  set('d-sleep', data?.horas_sueno?.toFixed(1), ' h');
  set('d-stress', data?.nivel_estres);
  set('d-hrv', data?.variabilidad_fc_hrv, ' ms');
  set('d-readiness', data?.training_readiness);
  set('d-spo2', data?.spo2_promedio?.toFixed(1), '%');

  // Load last 7 days chart
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: weekData } = await supabase.from('daily_metrics').select('*')
    .eq('user_id', currentUser.id).gte('fecha', sevenDaysAgo.toISOString().split('T')[0]).order('fecha');
  
  renderWellnessChart(weekData || []);
}

function renderWellnessChart(data) {
  const ctx = document.getElementById('wellness-chart');
  if (!ctx) return;
  if (charts.wellness) charts.wellness.destroy();
  charts.wellness = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.fecha?.substring(5)),
      datasets: [
        { label: 'Body Battery', data: data.map(d => d.body_battery_max), borderColor: '#00B4D8', tension: 0.4, fill: false },
        { label: 'Training Readiness', data: data.map(d => d.training_readiness), borderColor: '#10B981', tension: 0.4, fill: false },
        { label: 'Estres', data: data.map(d => d.nivel_estres), borderColor: '#EF4444', tension: 0.4, fill: false }
      ]
    },
    options: {
      responsive: true,
      scales: { x: { grid: { color: '#334155' }, ticks: { color: '#94A3B8' } }, y: { grid: { color: '#334155' }, ticks: { color: '#94A3B8' }, min: 0, max: 100 } },
      plugins: { legend: { labels: { color: '#94A3B8' } } }
    }
  });
}

// ---- RECORDS ----
async function loadRecords() {
  if (!currentUser) return;
  const { data: acts } = await supabase.from('activities').select('*').eq('user_id', currentUser.id).eq('tipo_actividad', 'running').order('pace_promedio_seg_km', { ascending: true });
  
  const findBest = (minDist, maxDist) => {
    if (!acts) return null;
    return acts.find(a => a.distancia_metros >= minDist && a.distancia_metros <= maxDist && a.duracion_segundos);
  };
  
  const pr5k = findBest(4900, 5100);
  const pr10k = findBest(9900, 10100);
  const prHalf = findBest(21000, 21200);
  const prFull = findBest(42100, 42300);
  
  const fmtTime = secs => { if(!secs) return '--:--'; const h = Math.floor(secs/3600); const m = Math.floor((secs%3600)/60); const s = secs%60; return h > 0 ? h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') : String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0'); };
  
  document.getElementById('pr-5k').textContent = pr5k ? fmtTime(pr5k.duracion_segundos) : '--:--';
  document.getElementById('pr-10k').textContent = pr10k ? fmtTime(pr10k.duracion_segundos) : '--:--';
  document.getElementById('pr-half').textContent = prHalf ? fmtTime(prHalf.duracion_segundos) : '--:--';
  document.getElementById('pr-full').textContent = prFull ? fmtTime(prFull.duracion_segundos) : '--:--';
  
  const { data: allActs } = await supabase.from('activities').select('distancia_metros, velocidad_maxima_ms').eq('user_id', currentUser.id);
  if (allActs?.length) {
    const longest = Math.max(...allActs.map(a => a.distancia_metros || 0));
    const maxSpeed = Math.max(...allActs.map(a => a.velocidad_maxima_ms || 0));
    document.getElementById('pr-longest').textContent = (longest/1000).toFixed(2) + ' km';
    document.getElementById('pr-speed').textContent = (maxSpeed * 3.6).toFixed(1) + ' km/h';
  }
}

// ---- PLANS ----
async function loadPlans() {
  if (!currentUser) return;
  const { data } = await supabase.from('training_plans').select('*').eq('user_id', currentUser.id).order('creado_en', { ascending: false });
  const list = document.getElementById('plans-list');
  if (!data?.length) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No tienes planes. Crea uno!</p></div>'; return; }
  list.innerHTML = data.map(p => `
    <div class="plan-card">
      <div>
        <h4>${p.nombre}</h4>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-top:4px;">${p.descripcion || ''}</p>
        <p style="color:var(--text-muted);font-size:0.8rem;margin-top:4px;">${p.semanas || 0} semanas | Inicio: ${p.fecha_inicio || '--'}</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
        <span class="plan-badge">${p.deporte || 'General'}</span>
        <button class="btn-secondary" style="font-size:0.8rem;padding:6px 12px;" onclick="deletePlan('${p.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function showCreatePlanModal() { document.getElementById('plan-modal').classList.remove('hidden'); }

async function createPlan(e) {
  e.preventDefault();
  const planData = {
    user_id: currentUser.id,
    nombre: document.getElementById('plan-name').value,
    descripcion: document.getElementById('plan-desc').value,
    deporte: document.getElementById('plan-sport').value,
    nivel: document.getElementById('plan-level').value,
    semanas: parseInt(document.getElementById('plan-weeks').value) || null,
    fecha_inicio: document.getElementById('plan-start').value,
    activo: true
  };
  const { error } = await supabase.from('training_plans').insert([planData]);
  if (!error) { closeModal('plan-modal'); loadPlans(); showToast('Plan creado!', 'success'); e.target.reset(); }
  else showToast('Error: ' + error.message, 'error');
}

async function deletePlan(id) {
  if (!confirm('Eliminar este plan?')) return;
  await supabase.from('training_plans').delete().eq('id', id);
  loadPlans(); showToast('Plan eliminado', 'success');
}

// ---- PROFILE ----
async function loadProfile() {
  if (!currentUser) return;
  const { data } = await supabase.from('user_profile').select('*').limit(1).single();
  if (data) {
    document.getElementById('user-name-display').textContent = data.nombre || 'Usuario';
  }
}

async function loadProfilePage() {
  if (!currentUser) return;
  const { data: p } = await supabase.from('user_profile').select('*').limit(1).single();
  if (p) {
    document.getElementById('profile-name').textContent = p.nombre || 'Sebastian Vinueza';
    const age = new Date().getFullYear() - new Date(p.fecha_nacimiento).getFullYear();
    document.getElementById('p-age').textContent = age + ' anos';
    document.getElementById('p-weight').textContent = p.peso_kg + ' kg';
    document.getElementById('p-height').textContent = (p.estatura_cm / 100).toFixed(2) + ' m';
    const bmi = p.peso_kg / Math.pow(p.estatura_cm/100, 2);
    document.getElementById('p-bmi').textContent = bmi.toFixed(1);
    document.getElementById('p-maxhr').textContent = (220 - age) + ' bpm';
    document.getElementById('p-resthr').textContent = (p.frecuencia_cardiaca_reposo || 60) + ' bpm';
  }
}

function connectGarmin() {
  showToast('La integracion Garmin requiere configurar OAuth en el servidor. Proximamente!', 'success');
}

// ---- MODALS ----
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ---- UTILS ----
function sportIcon(type) {
  const icons = { running: '🏃', cycling: '🚴', swimming: '🏊', hiking: '🥾', walking: '🚶', strength: '💪', yoga: '🧘', triathlon: '🏅' };
  return icons[type] || '🏋️';
}

function formatDuration(seconds, compact=false) {
  if (!seconds) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (compact) return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  return h > 0 ? h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') : String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

function formatDate(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPace(secsPerKm) {
  if (!secsPerKm) return '--';
  const m = Math.floor(secsPerKm / 60);
  const s = secsPerKm % 60;
  return m + ':' + String(s).padStart(2,'0');
}

function getWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return d.getUTCFullYear() + '-W' + String(Math.ceil((((d - yearStart) / 86400000) + 1)/7)).padStart(2,'0');
}

function showToast(msg, type='success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  setTimeout(() => toast.className = 'toast hidden', 3500);
}
