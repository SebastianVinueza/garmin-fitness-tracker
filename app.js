// GFT v5.0 - Garmin Fitness Tracker
// Fixed: delete, view detail, duration parsing, corrupted code

const SUPABASE_URL = 'https://snmqnbxmjiivjyeevugd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNubXFuYnhtamlpdmp5ZWV2dWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTI0MDcsImV4cCI6MjA5ODI2ODQwN30.mktcJueyphNdvnpxc6fNf8zYMJJqkpToOa5TVUP5E9g';

let _db;
let currentUser = null;
let charts = {};
let currentFile = null;
let parsedActivityData = null;

document.addEventListener('DOMContentLoaded', async () => {
  _db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { session } } = await _db.auth.getSession();
  if (session) { currentUser = session.user; showMainApp(); }
  else { showAuthScreen(); }
  _db.auth.onAuthStateChange((event, sess) => {
    if (sess) { currentUser = sess.user; showMainApp(); }
    else { currentUser = null; showAuthScreen(); }
  });
  const rpeSlider = document.getElementById('activity-rpe');
  if (rpeSlider) rpeSlider.addEventListener('input', () => {
    document.getElementById('rpe-value').textContent = rpeSlider.value;
  });
  const dp = document.getElementById('daily-date-picker');
  if (dp) dp.value = new Date().toISOString().split('T')[0];
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

// ---- NAV ----
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => { p.classList.add('hidden'); p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) { pageEl.classList.remove('hidden'); pageEl.classList.add('active'); }
  const titles = {dashboard:'Dashboard',activities:'Actividades',daily:'Metricas Diarias',records:'Records Personales',plans:'Planes de Entrenamiento',profile:'Mi Perfil'};
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[page] || page;
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
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
  const totalCal = activities.reduce((s,a) => s + (a.calorias||0), 0);
  const totalTime = activities.reduce((s,a) => s + (a.duracion_segundos||0), 0);
  const elTotalActs = document.getElementById('total-activities');
  const elTotalDist = document.getElementById('total-distance');
  const elTotalCal = document.getElementById('total-calories');
  const elTotalTime = document.getElementById('total-time');
  if (elTotalActs) elTotalActs.textContent = activities.length;
  if (elTotalDist) elTotalDist.textContent = totalDist.toFixed(1) + ' km';
  if (elTotalCal) elTotalCal.textContent = totalCal.toLocaleString();
  if (elTotalTime) elTotalTime.textContent = formatDuration(totalTime, true);
  const recentList = document.getElementById('recent-list');
  if (recentList) {
    if (activities.length === 0) {
      recentList.innerHTML = '<div class="empty-state"><p>Sube tu primera actividad</p></div>';
    } else {
      recentList.innerHTML = activities.slice(0,5).map(function(a) {
        var parts = [];
        parts.push('<div class="activity-row" onclick="showActivityDetail(' + JSON.stringify(String(a.id)) + ')">');
        parts.push('<div class="activity-sport-icon">' + sportIcon(a.tipo_actividad) + '</div>');
        parts.push('<div class="activity-info">');
        parts.push('<div class="activity-name">' + (a.nombre||'Sin nombre') + '</div>');
        parts.push('<div class="activity-meta"><span>' + formatDate(a.fecha_inicio) + '</span> &bull; <span>' + (a.tipo_actividad||'Actividad') + '</span></div>');
        parts.push('</div><div class="activity-stats">');
        parts.push('<span>' + ((a.distancia_metros||0)/1000).toFixed(2) + ' km</span>');
        parts.push('<span>' + formatDuration(a.duracion_segundos) + '</span>');
        parts.push('</div></div>');
        return parts.join('');
      }).join('');
    }
  }
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
    const wk = getWeekKey(d);
    weeks[wk] = (weeks[wk] || 0) + 1;
  });
  const labels = Object.keys(weeks).slice(-8);
  const data = labels.map(k => weeks[k]);
  charts.weekly = new Chart(ctx, {
    type: 'bar',
    data: { labels: labels.map(l => 'Sem ' + l.split('-W')[1]), datasets: [{ label: 'Actividades', data, backgroundColor: 'rgba(252,76,2,0.7)', borderRadius: 6 }] },
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
    data: { labels: Object.keys(sports).map(l => l.charAt(0).toUpperCase()+l.slice(1)), datasets: [{ data: Object.values(sports), backgroundColor: ['#FC4C02','#10B981','#F59E0B','#8B5CF6','#EF4444','#00B4D8'] }] },
    options: { responsive: true, plugins: { legend: { labels: { color: '#94A3B8', padding: 12 } } } }
  });
}

// ---- ACTIVITIES ----
async function loadActivities() {
  if (!currentUser) return;
  const sportEl = document.getElementById('filter-sport');
  const fromEl = document.getElementById('filter-date-from');
  const toEl = document.getElementById('filter-date-to');
  const sport = sportEl ? sportEl.value : '';
  const from = fromEl ? fromEl.value : '';
  const to = toEl ? toEl.value : '';
  const list = document.getElementById('activities-list');
  if (!list) return;
  list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  let query = _db.from('activities').select('*').eq('user_id', currentUser.id).order('fecha_inicio', { ascending: false });
  if (sport) query = query.eq('tipo_actividad', sport);
  if (from) query = query.gte('fecha_inicio', from);
  if (to) query = query.lte('fecha_inicio', to + 'T23:59:59');
  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🏃</div><p>No hay actividades. Sube tu primera!</p></div>';
    return;
  }
  list.innerHTML = data.map(function(a) {
    var id = String(a.id);
    var dist = ((a.distancia_metros||0)/1000).toFixed(2);
    var dur = formatDuration(a.duracion_segundos);
    var fc = a.frecuencia_cardiaca_promedio || '--';
    var kcal = a.calorias || '--';
    var badge = '<span class="sport-badge">' + (a.tipo_actividad||'Actividad') + '</span>';
    var parts = [];
    parts.push('<div class="activity-card">');
    parts.push('<div class="activity-card-header">');
    parts.push('<div class="activity-sport-icon">' + sportIcon(a.tipo_actividad) + '</div>');
    parts.push('<div class="activity-info" onclick="showActivityDetail(' + JSON.stringify(id) + ')" style="cursor:pointer;flex:1;">');
    parts.push('<div class="activity-name">' + (a.nombre||'Actividad sin nombre') + '</div>');
    parts.push('<div class="activity-meta">' + formatDate(a.fecha_inicio) + ' &bull; ' + badge + '</div>');
    parts.push('</div>');
    parts.push('<div class="activity-actions">');
    parts.push('<button class="btn-view" onclick="showActivityDetail(' + JSON.stringify(id) + ')">Ver</button>');
    parts.push('<button class="btn-delete" onclick="deleteActivity(' + JSON.stringify(id) + ');event.stopPropagation();">🗑</button>');
    parts.push('</div></div>');
    parts.push('<div class="activity-card-stats">');
    parts.push('<div class="act-stat"><div class="act-stat-value">' + dist + '</div><div class="act-stat-label">km</div></div>');
    parts.push('<div class="act-stat"><div class="act-stat-value">' + dur + '</div><div class="act-stat-label">Tiempo</div></div>');
    parts.push('<div class="act-stat"><div class="act-stat-value">' + fc + '</div><div class="act-stat-label">bpm avg</div></div>');
    if (a.tipo_actividad === 'cycling') {
      var spd = a.velocidad_maxima_ms ? (a.velocidad_maxima_ms * 3.6).toFixed(1) + ' km/h' : '--';
      parts.push('<div class="act-stat"><div class="act-stat-value">' + spd + '</div><div class="act-stat-label">Velocidad</div></div>');
    } else {
      var pace = a.pace_promedio_seg_km ? formatPace(a.pace_promedio_seg_km) + '/km' : '--';
      parts.push('<div class="act-stat"><div class="act-stat-value">' + pace + '</div><div class="act-stat-label">Ritmo</div></div>');
    }
    parts.push('<div class="act-stat"><div class="act-stat-value">' + kcal + '</div><div class="act-stat-label">kcal</div></div>');
    parts.push('</div></div>');
    return parts.join('');
  }).join('');
}

// ---- ACTIVITY DETAIL ----
async function showActivityDetail(id) {
  if (!_db || !id) return;
  const { data: a, error } = await _db.from('activities').select('*').eq('id', id).single();
  if (error || !a) { showToast('Error cargando actividad', 'error'); return; }
  window._currentDetailId = id;
  const modal = document.getElementById('activity-detail-modal');
  const titleEl = document.getElementById('detail-title');
  if (titleEl) titleEl.textContent = a.nombre || 'Detalle de Actividad';
  
  const dist = ((a.distancia_metros||0)/1000).toFixed(2);
  const dur = formatDuration(a.duracion_segundos);
  const pace = a.pace_promedio_seg_km ? formatPace(a.pace_promedio_seg_km) : '--';
  const elev = a.elevacion_ganada_m ? a.elevacion_ganada_m.toFixed(0) + ' m' : '--';
  const isCycling = (a.tipo_actividad === 'cycling');
  
  var vo2 = calcVO2Max(a);
  var vo2html = '';
  if (vo2) {
    var cat = vo2 >= 55 ? 'Excelente' : vo2 >= 47 ? 'Bueno' : vo2 >= 42 ? 'Promedio' : 'Bajo';
    vo2html = '<div class="detail-section"><h4>VO2 Max Estimado</h4><div class="vo2-display"><span class="vo2-value">' + vo2.toFixed(1) + '</span><span class="vo2-unit">ml/kg/min</span><span class="vo2-cat">' + cat + '</span></div></div>';
  }
  
  var projHtml = '';
  if (!isCycling && a.duracion_segundos > 0 && a.distancia_metros > 500) {
    projHtml = buildRunProjections(a);
  } else if (isCycling && a.duracion_segundos > 0) {
    projHtml = buildCyclingProjections(a);
  }
  
  var aiHtml = '<div class="detail-section"><h4>Analisis IA</h4><div class="ai-advice">' + generateAIAdvice(a) + '</div></div>';

  var html = '<div class="detail-stats-grid">';
  html += '<div class="detail-stat"><div class="detail-stat-label">Distancia</div><div class="detail-stat-value">' + dist + ' km</div></div>';
  html += '<div class="detail-stat"><div class="detail-stat-label">Tiempo</div><div class="detail-stat-value">' + dur + '</div></div>';
  if (isCycling) {
    var spd = a.velocidad_maxima_ms ? (a.velocidad_maxima_ms*3.6).toFixed(1) + ' km/h' : '--';
    html += '<div class="detail-stat"><div class="detail-stat-label">Vel. Max</div><div class="detail-stat-value">' + spd + '</div></div>';
  } else {
    html += '<div class="detail-stat"><div class="detail-stat-label">Ritmo Avg</div><div class="detail-stat-value">' + pace + '/km</div></div>';
  }
  html += '<div class="detail-stat"><div class="detail-stat-label">FC Media</div><div class="detail-stat-value">' + (a.frecuencia_cardiaca_promedio||'--') + ' bpm</div></div>';
  html += '<div class="detail-stat"><div class="detail-stat-label">FC Max</div><div class="detail-stat-value">' + (a.frecuencia_cardiaca_maxima||'--') + ' bpm</div></div>';
  html += '<div class="detail-stat"><div class="detail-stat-label">Calorias</div><div class="detail-stat-value">' + (a.calorias||'--') + ' kcal</div></div>';
  html += '<div class="detail-stat"><div class="detail-stat-label">Cadencia</div><div class="detail-stat-value">' + (a.cadencia_promedio||'--') + ' spm</div></div>';
  html += '<div class="detail-stat"><div class="detail-stat-label">Elevacion</div><div class="detail-stat-value">' + elev + '</div></div>';
  html += '</div>';
  html += vo2html;
  html += projHtml;
  html += aiHtml;
  html += '<div style="display:flex;gap:10px;margin-top:16px;">';
html += '<button class="btn-secondary" style="flex:1;" onclick="closeModal(&quot;activity-detail-modal&quot;)">Cerrar</button>';
  html += '<button class="btn-danger" style="flex:1;" onclick="deleteActivityFromDetail()">Eliminar Actividad</button>';
  html += '</div>';

  const content = document.getElementById('activity-detail-content');
  if (content) content.innerHTML = html;
  if (modal) modal.classList.remove('hidden');
}

function deleteActivityFromDetail() {
  var id = window._currentDetailId;
  if (!id) return;
  deleteActivity(id, true);
}

async function deleteActivity(id, fromDetail) {
  if (!confirm('Eliminar esta actividad permanentemente?')) return;
  const { error } = await _db.from('activities').delete().eq('id', id);
  if (!error) {
    closeModal("activity-detail-modal");
    loadActivities();
    loadDashboard();
    showToast('Actividad eliminada', 'success');
  } else {
    showToast('Error al eliminar: ' + error.message, 'error');
  }
}

// ---- VO2MAX ----
function calcVO2Max(a) {
  if (a.frecuencia_cardiaca_promedio && a.frecuencia_cardiaca_maxima && a.distancia_metros > 1000) {
    var hrRatio = a.frecuencia_cardiaca_promedio / a.frecuencia_cardiaca_maxima;
    return 15 * (a.frecuencia_cardiaca_maxima / a.frecuencia_cardiaca_promedio);
  }
  if (a.duracion_segundos > 0 && a.distancia_metros > 1000) {
    var paceSecKm = a.duracion_segundos / (a.distancia_metros / 1000);
    var speedMMin = 1000 / paceSecKm;
    return (29.54 + 5.000663 * speedMMin - 0.007546 * speedMMin * speedMMin);
  }
  return null;
}

// ---- RUN PROJECTIONS ----
function buildRunProjections(a) {
  if (!a.duracion_segundos || !a.distancia_metros || a.distancia_metros < 500) return '';
  var t1 = a.duracion_segundos;
  var d1 = a.distancia_metros;
  var races = [{name:'5 km',d:5000},{name:'10 km',d:10000},{name:'15 km',d:15000},{name:'Media Maraton',d:21097},{name:'Maraton',d:42195}];
  var html = '<div class="detail-section"><h4>Proyecciones de Carrera (Riegel)</h4><div class="projections-grid">';
  races.forEach(function(r) {
    var t2 = t1 * Math.pow(r.d / d1, 1.06);
    var h = Math.floor(t2/3600), m = Math.floor((t2%3600)/60), s = Math.round(t2%60);
    var timeStr = h > 0 ? h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') : String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    var paceS = t2 / (r.d/1000);
    var pm = Math.floor(paceS/60), ps = Math.round(paceS%60);
    html += '<div class="proj-item"><div class="proj-name">' + r.name + '</div><div class="proj-time">' + timeStr + '</div><div class="proj-pace">' + pm + ':' + String(ps).padStart(2,'0') + '/km</div></div>';
  });
  html += '</div></div>';
  return html;
}

// ---- CYCLING PROJECTIONS ----
function buildCyclingProjections(a) {
  if (!a.duracion_segundos || !a.distancia_metros || a.distancia_metros < 1000) return '';
  var t1 = a.duracion_segundos;
  var d1 = a.distancia_metros;
  var routes = [{name:'50 km',d:50000},{name:'100 km',d:100000},{name:'160 km',d:160000},{name:'200 km',d:200000}];
  var html = '<div class="detail-section"><h4>Proyecciones Ciclismo</h4><div class="projections-grid">';
  routes.forEach(function(r) {
    var fatigue = 1 + (r.d/d1 - 1) * 0.08;
    var t2 = t1 * (r.d/d1) * fatigue;
    var h = Math.floor(t2/3600), m = Math.floor((t2%3600)/60);
    var timeStr = h + ':' + String(m).padStart(2,'0') + ' h';
    var speedKmh = (r.d/1000) / (t2/3600);
    html += '<div class="proj-item"><div class="proj-name">' + r.name + '</div><div class="proj-time">' + timeStr + '</div><div class="proj-pace">' + speedKmh.toFixed(1) + ' km/h</div></div>';
  });
  html += '</div></div>';
  return html;
}

// ---- AI ADVICE ----
function generateAIAdvice(a) {
  var tips = [];
  var dur = a.duracion_segundos || 0;
  var dist = (a.distancia_metros||0)/1000;
  var avgHr = a.frecuencia_cardiaca_promedio || 0;
  var maxHr = a.frecuencia_cardiaca_maxima || 200;
  var isCycling = a.tipo_actividad === 'cycling';

  if (dur > 0 && dist > 0) {
    if (!isCycling) {
      var paceMin = (dur/60) / dist;
      if (paceMin < 4) tips.push('Ritmo excelente. Nivel competitivo alto. Mantener consistencia.');
      else if (paceMin < 5) tips.push('Buen ritmo para entrenamiento intenso. Considera alternar con dias de recuperacion.');
      else if (paceMin < 6) tips.push('Ritmo de entrenamiento aerobico optimo. Ideal para construir base.');
      else tips.push('Ritmo conservador. Bueno para recuperacion activa o rodajes largos.');
    } else {
      var speedKmh = dist / (dur/3600);
      if (speedKmh > 35) tips.push('Velocidad alta. Excelente potencia en ciclismo.');
      else if (speedKmh > 25) tips.push('Velocidad solida. Buen entrenamiento de resistencia ciclista.');
      else tips.push('Velocidad moderada. Trabaja en la cadencia para mayor eficiencia.');
    }
  }

  if (avgHr > 0 && maxHr > 0) {
    var hrPct = (avgHr / maxHr) * 100;
    if (hrPct > 90) tips.push('Actividad en zona 5 (FC muy alta). Esfuerzo maximo. Necesitas 48-72h de recuperacion.');
    else if (hrPct > 80) tips.push('Zona 4 (umbral lactato). Entrenamiento intenso. Recupera bien manana.');
    else if (hrPct > 70) tips.push('Zona 3 (aerobico intenso). Buen estimulo para mejorar VO2Max.');
    else if (hrPct > 60) tips.push('Zona 2 (aerobico base). Zona ideal para quemar grasa y construir resistencia.');
    else tips.push('Zona 1 (recuperacion activa). Intensidad baja, buena para dias de recuperacion.');
  }

  if (dur > 3600) {
    tips.push('Actividad larga (mas de 1 hora). Asegurate de hidratarte bien y reponer carbohidratos post-entreno.');
  }
  if (a.calorias > 800) {
    tips.push('Alto gasto calorico (' + a.calorias + ' kcal). Considera una comida rica en proteinas y carbohidratos para recuperar.');
  }
  if (a.elevacion_ganada_m > 200) {
    tips.push('Desnivel significativo (' + a.elevacion_ganada_m.toFixed(0) + ' m). El trabajo en cuestas mejora la fuerza y economia de carrera.');
  }
  if (tips.length === 0) tips.push('Actividad registrada. Sigue entrenando de forma consistente para ver mejoras.');
  return tips.map(function(t) { return '<p>' + t + '</p>'; }).join('');
}

// ---- UPLOAD ----
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
    showToast('Formato no soportado. Usa GPX, FIT o TCX', 'error'); return;
  }
  const nameEl = document.getElementById('file-name-display');
  const sizeEl = document.getElementById('file-size-display');
  const actNameEl = document.getElementById('activity-name');
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = (file.size/1024).toFixed(1) + ' KB';
  if (actNameEl) actNameEl.value = file.name.replace(/\.[^\.]+$/, '');
  const uploadArea = document.getElementById('upload-area');
  const uploadPreview = document.getElementById('upload-preview');
  if (uploadArea) uploadArea.classList.add('hidden');
  if (uploadPreview) uploadPreview.classList.remove('hidden');
  const reader = new FileReader();
  if (ext === 'gpx') {
    reader.onload = function(e) { parsedActivityData = parseGPX(e.target.result); };
    reader.readAsText(file);
  } else if (ext === 'tcx') {
    reader.onload = function(e) { parsedActivityData = parseTCX(e.target.result); };
    reader.readAsText(file);
  } else if (ext === 'fit') {
    reader.onload = function(e) { parsedActivityData = parseFIT(e.target.result); };
    reader.readAsArrayBuffer(file);
  }
}

async function uploadActivity() {
  if (!currentFile || !currentUser) return;
  const nameEl = document.getElementById('activity-name');
  const typeEl = document.getElementById('activity-type');
  const notesEl = document.getElementById('activity-notes');
  const rpeEl = document.getElementById('activity-rpe');
  const nombre = nameEl ? nameEl.value : currentFile.name;
  const type = typeEl ? typeEl.value : 'running';
  const notas = notesEl ? notesEl.value : '';
  const rpe = rpeEl ? parseInt(rpeEl.value) : 5;

  const previewEl = document.getElementById('upload-preview');
  const progressEl = document.getElementById('upload-progress');
  const fillEl = document.getElementById('progress-fill');
  const statusEl = document.getElementById('upload-status');
  if (previewEl) previewEl.classList.add('hidden');
  if (progressEl) progressEl.classList.remove('hidden');
  if (fillEl) fillEl.style.width = '30%';
  if (statusEl) statusEl.textContent = 'Procesando datos...';

  await new Promise(r => setTimeout(r, 300));

  const activityData = {
    user_id: currentUser.id,
    nombre: nombre,
    tipo_actividad: type,
    notas: notas,
    percepcion_esfuerzo: rpe,
    sincronizado_en: new Date().toISOString(),
    fecha_inicio: new Date().toISOString()
  };

  const p = parsedActivityData;
  if (p) {
    if (p.totalDist > 0) activityData.distancia_metros = parseFloat(p.totalDist.toFixed(2));
    if (p.duration > 0) activityData.duracion_segundos = Math.round(p.duration);
    if (p.startTime) activityData.fecha_inicio = p.startTime;
    if (p.endTime) activityData.fecha_fin = p.endTime;
    if (p.avgHr) activityData.frecuencia_cardiaca_promedio = p.avgHr;
    if (p.maxHr) activityData.frecuencia_cardiaca_maxima = p.maxHr;
    if (p.elevGain > 0) activityData.elevacion_ganada_m = p.elevGain;
    if (p.calories) activityData.calorias = p.calories;
    if (p.avgCadence) activityData.cadencia_promedio = p.avgCadence;
    if (p.maxSpeed > 0) activityData.velocidad_maxima_ms = p.maxSpeed;
    if (activityData.duracion_segundos > 0 && activityData.distancia_metros > 0) {
      activityData.pace_promedio_seg_km = Math.round(activityData.duracion_segundos / (activityData.distancia_metros / 1000));
    }
    if (p.sport && p.sport !== 'other' && type === 'running') activityData.tipo_actividad = p.sport;
  }

  if (fillEl) fillEl.style.width = '70%';
  if (statusEl) statusEl.textContent = 'Guardando en base de datos...';

  const { error } = await _db.from('activities').insert([activityData]);
  if (fillEl) fillEl.style.width = '100%';

  if (error) {
    if (statusEl) statusEl.textContent = 'Error: ' + error.message;
    showToast('Error al guardar: ' + error.message, 'error');
  } else {
    if (statusEl) statusEl.textContent = 'Actividad guardada correctamente!';
    showToast('Actividad subida exitosamente!', 'success');
    setTimeout(function() {
      closeModal('upload-modal');
      resetUploadModal();
      loadActivities();
      loadDashboard();
    }, 1500);
  }
}

function resetUploadModal() {
  currentFile = null; parsedActivityData = null;
  const uploadArea = document.getElementById('upload-area');
  const uploadPreview = document.getElementById('upload-preview');
  const uploadProgress = document.getElementById('upload-progress');
  const fillEl = document.getElementById('progress-fill');
  const fileInput = document.getElementById('file-input');
  if (uploadArea) uploadArea.classList.remove('hidden');
  if (uploadPreview) uploadPreview.classList.add('hidden');
  if (uploadProgress) uploadProgress.classList.add('hidden');
  if (fillEl) fillEl.style.width = '0';
  if (fileInput) fileInput.value = '';
}

// ---- FIT PARSER ----
function parseFIT(arrayBuffer) {
  var bytes = new Uint8Array(arrayBuffer);
  var view = new DataView(arrayBuffer);
  if (bytes.length < 14) return null;
  var headerSize = bytes[0];
  var dataType = String.fromCharCode(bytes[8],bytes[9],bytes[10],bytes[11]);
  if (dataType !== '.FIT') return null;

  var localDefs = {};
  var offset = headerSize;
  var dataEnd = bytes.length - 2;
  var records = [];
  var sessionData = null;
  var MESG_SESSION = 18;
  var MESG_RECORD = 20;

  while (offset < dataEnd) {
    if (offset >= bytes.length) break;
    var recHeader = bytes[offset];
    var isCompressed = (recHeader & 0x80) !== 0;
    var isDef = !isCompressed && (recHeader & 0x40) !== 0;
    var localNum = isCompressed ? (recHeader >> 5) & 0x03 : recHeader & 0x0F;
    var hasDev = !isCompressed && (recHeader & 0x20) !== 0;
    offset++;

    if (isDef) {
      offset++;
      var arch = bytes[offset++];
      var le = arch === 0;
      var globalNum = le ? view.getUint16(offset,true) : view.getUint16(offset,false);
      offset += 2;
      var numFields = bytes[offset++];
      var fields = [];
      for (var i = 0; i < numFields; i++) {
        var fdn = bytes[offset++];
        var fsz = bytes[offset++];
        var fbt = bytes[offset++];
        fields.push({ fdn: fdn, fsz: fsz, fbt: fbt });
      }
      if (hasDev) { var nd = bytes[offset++]; for (var j=0;j<nd;j++) offset+=3; }
      localDefs[localNum] = { globalNum: globalNum, le: le, fields: fields };
    } else {
      var def = localDefs[localNum];
      if (!def) { offset++; continue; }
      var rec = { _type: def.globalNum };
      for (var fi = 0; fi < def.fields.length; fi++) {
        var f = def.fields[fi];
        var bt = f.fbt & 0x9F;
        var v = 0;
        try {
          if (bt===0x00||bt===0x02||bt===0x0A) v = bytes[offset];
          else if (bt===0x01) v = view.getInt8(offset);
          else if (bt===0x83) v = f.le ? view.getInt16(offset,true) : view.getInt16(offset,false);
          else if (bt===0x84) v = f.le ? view.getUint16(offset,true) : view.getUint16(offset,false);
          else if (bt===0x85) v = f.le ? view.getInt32(offset,true) : view.getInt32(offset,false);
          else if (bt===0x86) v = f.le ? view.getUint32(offset,true) : view.getUint32(offset,false);
          else v = bytes[offset];
        } catch(e) { v = 0; }
        rec[f.fdn] = v;
        offset += f.fsz;
      }
      if (def.globalNum === MESG_RECORD) records.push(rec);
      if (def.globalNum === MESG_SESSION) sessionData = rec;
    }
  }

  var SPORT_MAP = {0:'other',1:'running',2:'cycling',5:'swimming',4:'hiking',11:'walking',10:'strength'};
  var SC = 180 / Math.pow(2,31);

  var totalDist=0, duration=0, calories=null, avgHr=null, maxHr=null;
  var avgCadence=null, maxSpeed=0, elevGain=0, startTime=null, endTime=null, sportCode=0;

  if (sessionData) {
    if (sessionData[9] !== undefined && sessionData[9] < 0xFFFFFFFF) totalDist = sessionData[9] / 100;
    if (sessionData[7] !== undefined && sessionData[7] < 0xFFFFFFFF) duration = sessionData[7] / 1000;
    if (sessionData[11] !== undefined && sessionData[11] < 0xFFFF) calories = sessionData[11];
    if (sessionData[14] !== undefined && sessionData[14] < 0xFF) avgHr = sessionData[14];
    if (sessionData[15] !== undefined && sessionData[15] < 0xFF) maxHr = sessionData[15];
    if (sessionData[16] !== undefined && sessionData[16] < 0xFF) avgCadence = sessionData[16];
    if (sessionData[19] !== undefined && sessionData[19] < 0xFFFF) maxSpeed = sessionData[19]/1000;
    if (sessionData[22] !== undefined && sessionData[22] < 0xFFFF) elevGain = sessionData[22]/5;
    if (sessionData[5] !== undefined) sportCode = sessionData[5];
    if (sessionData[2] !== undefined && sessionData[2] < 0xFFFFFFFF) {
      startTime = new Date((sessionData[2] + 631065600) * 1000).toISOString();
      if (duration) endTime = new Date((sessionData[2] + 631065600 + Math.round(duration)) * 1000).toISOString();
    }
  }

  var startCoords=null, recHrs=[], recLats=[], recLons=[];
  records.forEach(function(r) {
    var lat = r[0], lon = r[1];
    if (lat !== undefined && lon !== undefined && lat !== 0x7FFFFFFF && lon !== 0x7FFFFFFF && lat !== 0) {
      var latD = lat * SC, lonD = lon * SC;
      if (!startCoords) startCoords = { lat: latD, lng: lonD };
      recLats.push(latD); recLons.push(lonD);
    }
    if (r[3] !== undefined && r[3] > 0 && r[3] < 0xFF) recHrs.push(r[3]);
    if (r[253] !== undefined && r[253] < 0xFFFFFFFF && !startTime)
      startTime = new Date((r[253] + 631065600) * 1000).toISOString();
  });

  if (!totalDist && recLats.length > 1) {
    var d = 0;
    for (var ri=1; ri<recLats.length; ri++) d += haversine(recLats[ri-1],recLons[ri-1],recLats[ri],recLons[ri]);
    totalDist = d;
  }
  if (!avgHr && recHrs.length) avgHr = Math.round(recHrs.reduce(function(a,b){return a+b;},0)/recHrs.length);
  if (!maxHr && recHrs.length) maxHr = Math.max.apply(null, recHrs);

  return {
    totalDist: totalDist,
    duration: Math.round(duration),
    startTime: startTime,
    endTime: endTime,
    avgHr: avgHr,
    maxHr: maxHr,
    avgCadence: avgCadence,
    maxSpeed: maxSpeed,
    elevGain: elevGain,
    calories: calories,
    startCoords: startCoords,
    sport: SPORT_MAP[sportCode] || 'other'
  };
}

// ---- TCX PARSER ----
function parseTCX(xmlString) {
  var parser = new DOMParser();
  var xml = parser.parseFromString(xmlString, 'text/xml');
  var trkpts = xml.querySelectorAll('Trackpoint');
  var times=[], hrs=[], elevs=[], positions=[];
  var totalDist = 0;
  trkpts.forEach(function(tp) {
    var time = tp.querySelector('Time') ? tp.querySelector('Time').textContent : null;
    var hrEl = tp.querySelector('HeartRateBpm Value') || tp.querySelector('HeartRateBpm');
    var hr = hrEl ? parseInt(hrEl.textContent) : 0;
    var eleEl = tp.querySelector('AltitudeMeters');
    var ele = eleEl ? parseFloat(eleEl.textContent) : 0;
    var distEl = tp.querySelector('DistanceMeters');
    var dist = distEl ? parseFloat(distEl.textContent) : 0;
    var latEl = tp.querySelector('LatitudeDegrees');
    var lonEl = tp.querySelector('LongitudeDegrees');
    var lat = latEl ? parseFloat(latEl.textContent) : NaN;
    var lon = lonEl ? parseFloat(lonEl.textContent) : NaN;
    if (time) times.push(new Date(time));
    if (hr > 0) hrs.push(hr);
    if (ele > 0) elevs.push(ele);
    if (!isNaN(lat) && !isNaN(lon)) positions.push([lat,lon]);
    if (dist > totalDist) totalDist = dist;
  });
  if (totalDist === 0 && positions.length > 1) {
    var d=0, prev=null;
    positions.forEach(function(p) { if(prev) d+=haversine(prev[0],prev[1],p[0],p[1]); prev=p; });
    totalDist = d;
  }
  var calEl = xml.querySelector('Calories');
  var calories = calEl ? parseInt(calEl.textContent) : null;
  var duration = times.length > 1 ? (times[times.length-1]-times[0])/1000 : 0;
  var avgHr = hrs.length ? Math.round(hrs.reduce(function(a,b){return a+b;},0)/hrs.length) : null;
  var maxHr = hrs.length ? Math.max.apply(null,hrs) : null;
  var elevGain=0;
  for(var i=1;i<elevs.length;i++) if(elevs[i]>elevs[i-1]) elevGain+=elevs[i]-elevs[i-1];
  return {
    totalDist: totalDist,
    duration: Math.round(duration),
    startTime: times[0] ? times[0].toISOString() : null,
    endTime: times[times.length-1] ? times[times.length-1].toISOString() : null,
    avgHr: avgHr, maxHr: maxHr, calories: calories,
    elevGain: parseFloat(elevGain.toFixed(1)),
    startCoords: positions[0] ? {lat:positions[0][0],lng:positions[0][1]} : null
  };
}

// ---- GPX PARSER ----
function parseGPX(xmlString) {
  var parser = new DOMParser();
  var xml = parser.parseFromString(xmlString, 'text/xml');
  var trkpts = xml.querySelectorAll('trkpt');
  var points=[], times=[], elevs=[], hrs=[];
  var totalDist=0, prevPt=null;
  trkpts.forEach(function(pt) {
    var lat = parseFloat(pt.getAttribute('lat'));
    var lon = parseFloat(pt.getAttribute('lon'));
    var eleEl = pt.querySelector('ele');
    var ele = eleEl ? parseFloat(eleEl.textContent) : 0;
    var timeEl = pt.querySelector('time');
    var time = timeEl ? timeEl.textContent : null;
    var hrEl = pt.querySelector('gpxtpx\\:hr') || pt.querySelector('hr') || pt.querySelector('heartrate');
    var hr = hrEl ? parseInt(hrEl.textContent) : 0;
    if (!isNaN(lat) && !isNaN(lon)) {
      points.push([lat,lon]);
      if (prevPt) totalDist += haversine(prevPt[0],prevPt[1],lat,lon);
      prevPt = [lat,lon];
    }
    if (time) times.push(new Date(time));
    if (ele>0) elevs.push(ele);
    if (hr>0) hrs.push(hr);
  });
  var duration = times.length>1 ? (times[times.length-1]-times[0])/1000 : 0;
  var avgHr = hrs.length ? Math.round(hrs.reduce(function(a,b){return a+b;},0)/hrs.length) : null;
  var maxHr = hrs.length ? Math.max.apply(null,hrs) : null;
  var elevGain=0;
  for(var i=1;i<elevs.length;i++) if(elevs[i]>elevs[i-1]) elevGain+=elevs[i]-elevs[i-1];
  return {
    totalDist: totalDist,
    duration: Math.round(duration),
    startTime: times[0] ? times[0].toISOString() : null,
    endTime: times[times.length-1] ? times[times.length-1].toISOString() : null,
    avgHr: avgHr, maxHr: maxHr,
    elevGain: parseFloat(elevGain.toFixed(1)),
    startCoords: points[0] ? {lat:points[0][0],lng:points[0][1]} : null
  };
}

function haversine(lat1,lon1,lat2,lon2) {
  var R=6371000;
  var phi1=lat1*Math.PI/180, phi2=lat2*Math.PI/180;
  var dphi=(lat2-lat1)*Math.PI/180, dlam=(lon2-lon1)*Math.PI/180;
  var a=Math.sin(dphi/2)*Math.sin(dphi/2)+Math.cos(phi1)*Math.cos(phi2)*Math.sin(dlam/2)*Math.sin(dlam/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ---- DAILY METRICS ----
async function loadDailyMetrics() {
  if (!currentUser) return;
  var dpEl = document.getElementById('daily-date-picker');
  var date = dpEl ? dpEl.value : new Date().toISOString().split('T')[0];
  var { data } = await _db.from('daily_metrics').select('*').eq('user_id',currentUser.id).eq('fecha',date).single();
  function set(id,val,suffix) { var el=document.getElementById(id); if(el) el.textContent=val!=null ? val+(suffix||'') : '--'; }
  set('d-steps', data && data.pasos ? data.pasos.toLocaleString() : null);
  set('d-hr', data ? data.frecuencia_cardiaca_reposo : null,' bpm');
  set('d-battery', data ? data.body_battery_max : null);
  set('d-sleep', data && data.horas_sueno ? data.horas_sueno.toFixed(1) : null,' h');
  set('d-stress', data ? data.nivel_estres : null);
  set('d-hrv', data ? data.variabilidad_fc_hrv : null,' ms');
  set('d-readiness', data ? data.training_readiness : null);
  set('d-spo2', data && data.spo2_promedio ? data.spo2_promedio.toFixed(1) : null,'%');
  var sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate()-7);
  var { data: weekData } = await _db.from('daily_metrics').select('*')
    .eq('user_id',currentUser.id).gte('fecha',sevenDaysAgo.toISOString().split('T')[0]).order('fecha');
  renderWellnessChart(weekData||[]);
}

function renderWellnessChart(data) {
  var ctx = document.getElementById('wellness-chart');
  if (!ctx) return;
  if (charts.wellness) charts.wellness.destroy();
  charts.wellness = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(function(d) { return d.fecha ? d.fecha.substring(5) : ''; }),
      datasets: [
        { label:'Body Battery', data:data.map(function(d){return d.body_battery_max;}), borderColor:'#FC4C02',tension:0.4,fill:false },
        { label:'Readiness', data:data.map(function(d){return d.training_readiness;}), borderColor:'#10B981',tension:0.4,fill:false },
        { label:'Estres', data:data.map(function(d){return d.nivel_estres;}), borderColor:'#EF4444',tension:0.4,fill:false }
      ]
    },
    options: { responsive:true, scales: { x:{grid:{color:'#334155'},ticks:{color:'#94A3B8'}}, y:{grid:{color:'#334155'},ticks:{color:'#94A3B8'},min:0,max:100} }, plugins: { legend:{labels:{color:'#94A3B8'}} } }
  });
}

// ---- RECORDS ----
async function loadRecords() {
  if (!currentUser) return;
  var { data: acts } = await _db.from('activities').select('*').eq('user_id',currentUser.id).eq('tipo_actividad','running').order('pace_promedio_seg_km',{ascending:true});
  var findBest = function(min,max) { return acts && acts.find(function(a){ return a.distancia_metros>=min && a.distancia_metros<=max && a.duracion_segundos; }); };
  var fmtTime = function(secs) {
    if(!secs) return '--:--';
    var h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;
    return h>0 ? h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0') : String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  };
  var pr5k=findBest(4900,5100), pr10k=findBest(9900,10100), prHalf=findBest(21000,21200), prFull=findBest(42100,42300);
  var el5k=document.getElementById('pr-5k'), el10k=document.getElementById('pr-10k');
  var elHalf=document.getElementById('pr-half'), elFull=document.getElementById('pr-full');
  if(el5k) el5k.textContent=fmtTime(pr5k && pr5k.duracion_segundos);
  if(el10k) el10k.textContent=fmtTime(pr10k && pr10k.duracion_segundos);
  if(elHalf) elHalf.textContent=fmtTime(prHalf && prHalf.duracion_segundos);
  if(elFull) elFull.textContent=fmtTime(prFull && prFull.duracion_segundos);
  var { data: allActs } = await _db.from('activities').select('distancia_metros,velocidad_maxima_ms').eq('user_id',currentUser.id);
  if (allActs && allActs.length) {
    var longest = Math.max.apply(null, allActs.map(function(a){return a.distancia_metros||0;}));
    var maxSpd = Math.max.apply(null, allActs.map(function(a){return a.velocidad_maxima_ms||0;}));
    var elLong=document.getElementById('pr-longest'), elSpd=document.getElementById('pr-speed');
    if(elLong) elLong.textContent=(longest/1000).toFixed(2)+' km';
    if(elSpd) elSpd.textContent=(maxSpd*3.6).toFixed(1)+' km/h';
  }
}

// ---- PLANS ----
async function loadPlans() {
  if (!currentUser) return;
  var { data } = await _db.from('training_plans').select('*').eq('user_id',currentUser.id).order('creado_en',{ascending:false});
  var list = document.getElementById('plans-list');
  if (!list) return;
  if (!data || !data.length) { list.innerHTML='<div class="empty-state"><div class="empty-icon">📋</div><p>No tienes planes. Crea uno!</p></div>'; return; }
  list.innerHTML = data.map(function(p) {
    var parts = [];
    parts.push('<div class="plan-card">');
    parts.push('<div><h4>' + p.nombre + '</h4>');
    parts.push('<p style="color:var(--text-muted);font-size:0.85rem;">' + (p.descripcion||'') + '</p>');
    parts.push('<p style="color:var(--text-muted);font-size:0.8rem;">' + (p.semanas||0) + ' semanas | Inicio: ' + (p.fecha_inicio||'--') + '</p></div>');
    parts.push('<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">');
    parts.push('<span class="plan-badge">' + (p.deporte||'General') + '</span>');
    parts.push('<button class="btn-secondary" style="font-size:0.8rem;padding:6px 12px;" onclick="deletePlan(' + JSON.stringify(p.id) + ')">Eliminar</button></div></div>');
    return parts.join('');
  }).join('');
}

function showCreatePlanModal() { var m=document.getElementById('plan-modal'); if(m) m.classList.remove('hidden'); }

async function createPlan(e) {
  e.preventDefault();
  var planData = {
    user_id: currentUser.id,
    nombre: document.getElementById('plan-name').value,
    descripcion: document.getElementById('plan-desc').value,
    deporte: document.getElementById('plan-sport').value,
    nivel: document.getElementById('plan-level').value,
    semanas: parseInt(document.getElementById('plan-weeks').value)||null,
    fecha_inicio: document.getElementById('plan-start').value,
    activo: true
  };
  var { error } = await _db.from('training_plans').insert([planData]);
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
  var { data } = await _db.from('user_profile').select('*').eq('user_id',currentUser.id).limit(1).single();
  var nameEl = document.getElementById('user-name-display');
  if (nameEl && data) nameEl.textContent = data.nombre || 'Usuario';
}

async function loadProfilePage() {
  if (!currentUser) return;
  var { data: p } = await _db.from('user_profile').select('*').eq('user_id',currentUser.id).limit(1).single();
  if (p) {
    var nameEl=document.getElementById('profile-name');
    if(nameEl) nameEl.textContent=p.nombre||'Sebastian Vinueza';
    var edad = new Date().getFullYear() - new Date(p.fecha_nacimiento).getFullYear();
    var ageEl=document.getElementById('p-age'); if(ageEl) ageEl.textContent=edad+' anos';
    var wtEl=document.getElementById('p-weight'); if(wtEl) wtEl.textContent=p.peso_kg+' kg';
    var htEl=document.getElementById('p-height'); if(htEl) htEl.textContent=(p.estatura_cm/100).toFixed(2)+' m';
    var bmi=p.peso_kg/Math.pow(p.estatura_cm/100,2);
    var bmiEl=document.getElementById('p-bmi'); if(bmiEl) bmiEl.textContent=bmi.toFixed(1);
    var mhrEl=document.getElementById('p-maxhr'); if(mhrEl) mhrEl.textContent=(220-edad)+' bpm';
    var rhrEl=document.getElementById('p-resthr'); if(rhrEl) rhrEl.textContent=(p.frecuencia_cardiaca_reposo||60)+' bpm';
  }
}

function connectGarmin() { showToast('Integracion Garmin disponible proximamente!','success'); }

// ---- MODALS ----
function closeModal(id) { var el=document.getElementById(id); if(el) el.classList.add('hidden'); }

// ---- UTILS ----
function sportIcon(type) {
  var icons = {running:'🏃',cycling:'🚴',swimming:'🏊',hiking:'🥾',walking:'🚶',strength:'💪',yoga:'🧘',triathlon:'🏅'};
  return icons[type] || '⚡';
}

function formatDuration(seconds, compact) {
  if (!seconds || seconds <= 0) return '--';
  var s = Math.min(Math.round(Number(seconds)), 359999);
  var h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  if (compact) return h>0 ? h+'h '+m+'m' : m+'m';
  return h>0 ? h+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0') : String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
}

function formatDate(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
}

function formatPace(secsPerKm) {
  if (!secsPerKm) return '--';
  var m=Math.floor(secsPerKm/60), s=Math.round(secsPerKm%60);
  return m+':'+String(s).padStart(2,'0');
}

function getWeekKey(date) {
  var d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  var dayNum=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-dayNum);
  var yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return d.getUTCFullYear()+'-W'+String(Math.ceil((((d-yearStart)/86400000)+1)/7)).padStart(2,'0');
}

function showToast(msg, type) {
  var toast=document.getElementById('toast');
  if (!toast) return;
  toast.textContent=msg;
  toast.className='toast '+(type||'success');
  setTimeout(function(){ toast.className='toast hidden'; },3500);
}
