// GFT v6.1 - Garmin Fitness Tracker - Better than Strava Premium
const SUPABASE_URL = 'https://snmqnbxmjiivjyeevugd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNubXFuYnhtamlpdmp5ZWV2dWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTI0MDcsImV4cCI6MjA5ODI2ODQwN30.mktcJueyphNdvnpxc6fNf8zYMJJqkpToOa5TVUP5E9g';

const SPORT_CONFIG = {
  running:       { icon: '🏃', label: 'Carrera',         color: '#FC4C02', unit: 'pace' },
  cycling:       { icon: '🚴', label: 'Ciclismo',        color: '#0066FF', unit: 'speed' },
  swimming:      { icon: '🏊', label: 'Natacion',        color: '#00B4D8', unit: 'pace' },
  hiking:        { icon: '🥾', label: 'Senderismo',      color: '#10B981', unit: 'pace' },
  walking:       { icon: '🚶', label: 'Caminata',        color: '#84CC16', unit: 'pace' },
  strength:      { icon: '🏋', label: 'Fuerza',          color: '#8B5CF6', unit: 'none' },
  yoga:          { icon: '🧘', label: 'Yoga',            color: '#EC4899', unit: 'none' },
  triathlon:     { icon: '🥇', label: 'Triatlon',        color: '#F59E0B', unit: 'pace' },
  indoor_cycling:{ icon: '🚲', label: 'Ciclismo Indoor', color: '#0066FF', unit: 'speed' },
  virtual_ride:  { icon: '🖥', label: 'Ciclismo Virtual',color: '#3B82F6', unit: 'speed' },
  trail_running: { icon: '⛰',    label: 'Trail',           color: '#D97706', unit: 'pace' },
  open_water:    { icon: '🌊', label: 'Aguas Abiertas',  color: '#0EA5E9', unit: 'pace' },
  rowing:        { icon: '🚣', label: 'Remo',            color: '#6366F1', unit: 'pace' },
  skiing:        { icon: '⛷',    label: 'Esqui',           color: '#60A5FA', unit: 'speed' },
  crossfit:      { icon: '🤸', label: 'CrossFit',        color: '#EF4444', unit: 'none' },
  other:         { icon: '⚡',    label: 'Otro',            color: '#6B7280', unit: 'none' }
};

const FIT_SPORT_MAP = {
  0: 'other', 1: 'running', 2: 'cycling', 3: 'triathlon', 4: 'fitness_equipment',
  5: 'swimming', 6: 'other', 7: 'other', 8: 'other', 9: 'other',
  10: 'strength', 11: 'walking', 12: 'skiing', 13: 'skiing',
  14: 'skiing', 15: 'rowing', 16: 'hiking', 17: 'hiking',
  19: 'yoga', 29: 'yoga', 34: 'other', 35: 'other', 37: 'other',
  40: 'indoor_cycling', 41: 'virtual_ride', 42: 'open_water',
  53: 'trail_running', 58: 'crossfit', 63: 'other'
};

let _db = null;
let currentUser = null;
let currentFile = null;
let charts = {};

window.addEventListener('DOMContentLoaded', function() {
  _db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  var today = new Date().toISOString().split('T')[0];
  var picker = document.getElementById('daily-date-picker');
  if (picker) picker.value = today;
  initAuth();
});

function initAuth() {
  _db.auth.getSession().then(function(r) {
    var s = r.data && r.data.session;
    if (s) {
      currentUser = s.user;
      showApp();
    } else {
      document.getElementById('auth-screen').classList.remove('hidden');
      document.getElementById('auth-screen').classList.add('active');
    }
  });
  _db.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      showApp();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      location.reload();
    }
  });
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  var nameEl = document.getElementById('user-name-display');
  if (nameEl) nameEl.textContent = currentUser.email ? currentUser.email.split('@')[0] : 'Usuario';
  showPage('dashboard');
}

function showAuthTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.querySelectorAll('.auth-tab').forEach(function(btn) {
    btn.classList.toggle('active', btn.textContent.toLowerCase().indexOf(tab === 'login' ? 'iniciar' : 'reg') >= 0);
  });
}

async function handleLogin(e) {
  e.preventDefault();
  var email = document.getElementById('login-email').value;
  var pass = document.getElementById('login-password').value;
  var msg = document.getElementById('auth-message');
  msg.textContent = 'Iniciando sesion...';
  msg.className = 'message';
  var r = await _db.auth.signInWithPassword({ email: email, password: pass });
  if (r.error) {
    msg.textContent = 'Error: ' + r.error.message;
    msg.className = 'message error';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  var email = document.getElementById('reg-email').value;
  var pass = document.getElementById('reg-password').value;
  var msg = document.getElementById('auth-message');
  var r = await _db.auth.signUp({ email: email, password: pass });
  if (r.error) {
    msg.textContent = 'Error: ' + r.error.message;
    msg.className = 'message error';
  } else {
    msg.textContent = 'Cuenta creada. Revisa tu email.';
    msg.className = 'message success';
  }
}

async function handleLogout() {
  await _db.auth.signOut();
}

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); p.classList.add('hidden'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  var el = document.getElementById('page-' + page);
  if (el) { el.classList.remove('hidden'); el.classList.add('active'); }
  var titleMap = { dashboard:'Dashboard', activities:'Actividades', daily:'Metricas Diarias', records:'Records', plans:'Planes', profile:'Perfil' };
  var titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titleMap[page] || page;
  document.querySelectorAll('.nav-item').forEach(function(n) {
    var onclick = n.getAttribute('onclick') || '';
    if (onclick.indexOf("'" + page + "'") >= 0) n.classList.add('active');
  });
  if (page === 'dashboard') loadDashboard();
  else if (page === 'activities') loadActivities();
  else if (page === 'daily') loadDailyMetrics();
  else if (page === 'records') loadRecords();
  else if (page === 'plans') loadPlans();
  else if (page === 'profile') loadProfile();
}

async function loadDashboard() {
  if (!currentUser) return;
  var r = await _db.from('activities').select('*').eq('user_id', currentUser.id).order('fecha_inicio', { ascending: false });
  var acts = r.data || [];
  var totalDist = 0, totalCal = 0, totalSecs = 0, totalHR = 0, hrCount = 0;
  acts.forEach(function(a) {
    totalDist += (parseFloat(a.distancia_metros) / 1000) || 0;
    totalCal += parseInt(a.calorias) || 0;
    totalSecs += parseInt(a.duracion_segundos) || 0;
    if (a.frecuencia_cardiaca_promedio && parseInt(a.frecuencia_cardiaca_promedio) > 0) {
      totalHR += parseInt(a.frecuencia_cardiaca_promedio);
      hrCount++;
    }
  });
  var setEl = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('total-activities', acts.length);
  setEl('total-distance', totalDist.toFixed(1) + ' km');
  setEl('total-calories', totalCal.toLocaleString());
  setEl('total-time', formatDuration(totalSecs));
  setEl('avg-hr', hrCount > 0 ? Math.round(totalHR / hrCount) + ' bpm' : '-- bpm');
  var ctl = calcCTL(acts);
  var atl = calcATL(acts);
  var tsb = Math.round(ctl - atl);
  setEl('stat-ctl', ctl);
  setEl('stat-atl', atl);
  setEl('stat-tsb', (tsb >= 0 ? '+' : '') + tsb);
  renderWeeklyChart(acts);
  renderSportChart(acts);
  renderProgressChart(acts);
  var recentEl = document.getElementById('recent-list');
  if (recentEl) {
    var recent = acts.slice(0, 5);
    recentEl.innerHTML = recent.length ? recent.map(function(a) {
      var sc = getSportConfig(a.tipo_actividad);
      return '<div class="strava-row" onclick="openDetail(' + JSON.stringify(a.id) + ')">' +
        '<div class="activity-sport-icon">' + sc.icon + '</div>' +
        '<div style="flex:1"><div class="activity-name">' + (a.nombre || 'Actividad') + '</div>' +
        '<div class="activity-meta"><span class="sport-badge" style="background:' + sc.color + '22;color:' + sc.color + '">' + sc.label + '</span>' +
        '<span>' + formatDate(a.fecha_inicio) + '</span></div></div>' +
        '<div class="activity-stats">' +
        (a.distancia_metros ? '<span class="stat-pill">' + (parseFloat(a.distancia_metros) / 1000).toFixed(1) + ' km</span>' : '') +
        '<span class="stat-pill">' + formatDuration(a.duracion_segundos) + '</span>' +
        (a.frecuencia_cardiaca_promedio ? '<span class="stat-pill heart">❤ ' + a.frecuencia_cardiaca_promedio + '</span>' : '') +
        '</div></div>';
    }).join('') : '<div class="empty-state"><span class="empty-icon">🏃</span><p>Sin actividades aun</p></div>';
  }
}

function renderWeeklyChart(acts) {
  var ctx = document.getElementById('weekly-chart');
  if (!ctx) return;
  if (charts.weekly) { charts.weekly.destroy(); }
  var weeks = {};
  acts.forEach(function(a) {
    if (!a.fecha_inicio) return;
    var k = getWeekKey(new Date(a.fecha_inicio));
    weeks[k] = (weeks[k] || 0) + 1;
  });
  var keys = Object.keys(weeks).sort().slice(-8);
  charts.weekly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: keys.map(function(k) { return k.slice(5); }),
      datasets: [{ label: 'Actividades', data: keys.map(function(k) { return weeks[k]; }), backgroundColor: '#FC4C02', borderRadius: 6 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true } } }
  });
}

function renderSportChart(acts) {
  var ctx = document.getElementById('sport-chart');
  if (!ctx) return;
  if (charts.sport) { charts.sport.destroy(); }
  var counts = {};
  acts.forEach(function(a) { var t = a.tipo_actividad || 'other'; counts[t] = (counts[t] || 0) + 1; });
  var sports = Object.keys(counts);
  charts.sport = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sports.map(function(s) { return getSportConfig(s).label; }),
      datasets: [{ data: sports.map(function(s) { return counts[s]; }), backgroundColor: sports.map(function(s) { return getSportConfig(s).color; }), borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', boxWidth: 12, padding: 10 } } } }
  });
}

function renderProgressChart(acts) {
  var ctx = document.getElementById('progress-chart');
  if (!ctx) return;
  if (charts.progress) { charts.progress.destroy(); }
  var months = {};
  acts.forEach(function(a) {
    if (!a.fecha_inicio || !a.distancia_metros) return;
    var m = a.fecha_inicio.slice(0, 7);
    months[m] = (months[m] || 0) + (parseFloat(a.distancia_metros) / 1000);
  });
  var keys = Object.keys(months).sort().slice(-6);
  var monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  charts.progress = new Chart(ctx, {
    type: 'line',
    data: {
      labels: keys.map(function(k) { return monthNames[parseInt(k.split('-')[1]) - 1] + ' ' + k.split('-')[0].slice(2); }),
      datasets: [{ label: 'km', data: keys.map(function(k) { return parseFloat(months[k].toFixed(1)); }), borderColor: '#FC4C02', backgroundColor: 'rgba(252,76,2,0.1)', tension: 0.4, fill: true, pointBackgroundColor: '#FC4C02' }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true } } }
  });
}

async function loadActivities() {
  if (!currentUser) return;
  var list = document.getElementById('activities-list');
  if (!list) return;
  list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  var sport = (document.getElementById('filter-sport') || {}).value || '';
  var from = (document.getElementById('filter-date-from') || {}).value || '';
  var to = (document.getElementById('filter-date-to') || {}).value || '';
  var q = _db.from('activities').select('*').eq('user_id', currentUser.id).order('fecha_inicio', { ascending: false });
  if (sport) q = q.eq('tipo_actividad', sport);
  if (from) q = q.gte('fecha_inicio', from);
  if (to) q = q.lte('fecha_inicio', to);
  var r = await q;
  var acts = r.data || [];
  if (!acts.length) {
    list.innerHTML = '<div class="empty-state"><span class="empty-icon">📂</span><p>Sin actividades. Sube un archivo FIT/GPX/TCX.</p></div>';
    return;
  }
  list.innerHTML = acts.map(function(a) {
    var sc = getSportConfig(a.tipo_actividad);
    var dist = (parseFloat(a.distancia_metros) / 1000) || 0;
    var dur = parseInt(a.duracion_segundos) || 0;
    var cal = parseInt(a.calorias) || 0;
    var hr = parseInt(a.frecuencia_cardiaca_promedio) || 0;
    var pace = '';
    if (sc.unit === 'pace' && dist > 0 && dur > 0) pace = formatPace(dur / dist);
    else if (sc.unit === 'speed' && dist > 0 && dur > 0) pace = (dist / (dur / 3600)).toFixed(1) + ' km/h';
    var idStr = JSON.stringify(a.id);
    return '<div class="act-card">' +
      '<div class="act-card-top">' +
      '<div class="act-sport-icon" style="background:' + sc.color + '22;color:' + sc.color + '">' + sc.icon + '</div>' +
      '<div class="act-title-block">' +
      '<div class="act-title">' + (a.nombre || 'Actividad') + '</div>' +
      '<div class="act-subtitle">' +
      '<span class="sport-pill" style="background:' + sc.color + '22;color:' + sc.color + '">' + sc.label + '</span>' +
      '<span>' + formatDate(a.fecha_inicio) + '</span>' +
      '</div></div>' +
      '<div class="act-card-actions">' +
      '<button class="btn-ver" onclick="openDetail(' + idStr + ')">Ver</button>' +
      '<button class="btn-del" onclick="deleteActivity(' + idStr + ')">🗑</button>' +
      '</div></div>' +
      '<div class="act-stats-row">' +
      '<div class="act-stat"><span class="act-stat-val">' + (dist > 0 ? dist.toFixed(2) + ' km' : '--') + '</span><span class="act-stat-lbl">Distancia</span></div>' +
      '<div class="act-stat"><span class="act-stat-val">' + (dur > 0 ? formatDuration(dur) : '--') + '</span><span class="act-stat-lbl">Tiempo</span></div>' +
      '<div class="act-stat"><span class="act-stat-val">' + (pace || '--') + '</span><span class="act-stat-lbl">' + (sc.unit === 'speed' ? 'Velocidad' : 'Ritmo') + '</span></div>' +
      '<div class="act-stat"><span class="act-stat-val">' + (hr > 0 ? hr + ' bpm' : '--') + '</span><span class="act-stat-lbl">FC Media</span></div>' +
      '<div class="act-stat"><span class="act-stat-val">' + (cal > 0 ? cal : '--') + '</span><span class="act-stat-lbl">Cal</span></div>' +
      '</div></div>';
  }).join('');
}

function openDetail(id) {
  setTimeout(function() { showActivityDetail(id); }, 10);
}

async function showActivityDetail(id) {
  var modal = document.getElementById('activity-detail-modal');
  var content = document.getElementById('activity-detail-content');
  if (!modal || !content) return;
  content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  modal.classList.remove('hidden');
  var r = await _db.from('activities').select('*').eq('id', id).single();
  if (r.error || !r.data) {
    content.innerHTML = '<p style="padding:24px;color:#f87171">Error al cargar actividad</p>';
    return;
  }
  var a = r.data;
  var sc = getSportConfig(a.tipo_actividad);
  var dist = (parseFloat(a.distancia_metros) / 1000) || 0;
  var dur = parseInt(a.duracion_segundos) || 0;
  var cal = parseInt(a.calorias) || 0;
  var hr = parseInt(a.frecuencia_cardiaca_promedio) || 0;
  var hrMax = parseInt(null) || 0;
  var elev = parseFloat(a.elevacion_ganada_m) || 0;
  var pace = '';
  if (sc.unit === 'pace' && dist > 0 && dur > 0) pace = formatPace(dur / dist) + '/km';
  else if (sc.unit === 'speed' && dist > 0 && dur > 0) pace = (dist / (dur / 3600)).toFixed(1) + ' km/h';
  var titleEl = document.getElementById('detail-title');
  if (titleEl) titleEl.textContent = a.nombre || 'Detalle';
  var vo2 = (hr > 0 && dist > 0 && dur > 0) ? calcVO2Max(a) : null;
  var tss = calcTSS(a);
  var ae = calcAerobicEfficiency(a);
  var rt = calcRecoveryTime(a);
  var ifact = calcIntensityFactor(a);
  var hrDrift = calcHRDrift(a);
  var vo2Html = '';
  if (vo2) {
    var vo2Cat = vo2 >= 55 ? ['vo2-excellent','Excelente'] : vo2 >= 50 ? ['vo2-great','Muy Bueno'] : vo2 >= 45 ? ['vo2-good','Bueno'] : vo2 >= 40 ? ['vo2-avg','Promedio'] : ['vo2-low','Bajo'];
    vo2Html = '<div class="detail-section"><div class="section-title">💪 VO2 Max Estimado</div>' +
      '<div class="vo2-block"><span class="vo2-value">' + vo2.toFixed(1) + '</span><span class="vo2-unit">ml/kg/min</span></div>' +
      '<span class="vo2-cat ' + vo2Cat[0] + '">' + vo2Cat[1] + '</span>' +
      '<div class="vo2-desc">Capacidad aerobica estimada. Mejor que ' + (vo2 >= 55 ? '95%' : vo2 >= 50 ? '85%' : vo2 >= 45 ? '70%' : vo2 >= 40 ? '50%' : '30%') + ' de personas de tu edad.</div></div>';
  }
  var hrZonesHtml = (hr > 0) ? '<div class="detail-section"><div class="section-title">❤ Zonas de Frecuencia Cardiaca</div>' + buildHRZonesDetail(a) + '</div>' : '';
  var projHtml = '';
  if (a.tipo_actividad === 'running' && dist > 0 && dur > 0) {
    projHtml = '<div class="detail-section"><div class="section-title">🎯 Proyecciones de Carrera</div>' + buildRunProjections(dist, dur) + '</div>';
  } else if ((a.tipo_actividad === 'cycling' || a.tipo_actividad === 'indoor_cycling' || a.tipo_actividad === 'virtual_ride') && dist > 0 && dur > 0) {
    projHtml = '<div class="detail-section"><div class="section-title">🚴 Proyecciones de Ciclismo</div>' + buildCyclingProjections(dist, dur) + '</div>';
  }
  var aiHtml = '<div class="detail-section"><div class="section-title">🤖 Consejo IA</div><div class="ai-section"><ul class="ai-tips">' + generateAIAdvice(a).map(function(t) { return '<li class="ai-tip">' + t + '</li>'; }).join('') + '</ul></div></div>';
  content.innerHTML = '<div style="padding:0">' +
    '<div class="detail-header">' +
    '<div class="detail-sport-icon" style="background:' + sc.color + '22">' + sc.icon + '</div>' +
    '<div class="detail-title-block"><h2>' + (a.nombre || 'Actividad') + '</h2>' +
    '<div class="detail-meta"><span style="background:' + sc.color + '22;color:' + sc.color + ';padding:2px 10px;border-radius:20px;font-size:0.8rem">' + sc.label + '</span>' +
    '<span>' + formatDate(a.fecha_inicio) + '</span></div></div></div>' +
    '<div class="detail-main-stats">' +
    '<div class="detail-stat-block"><div class="dsb-val">' + (dist > 0 ? dist.toFixed(2) + ' km' : '--') + '</div><div class="dsb-lbl">Distancia</div></div>' +
    '<div class="detail-stat-block"><div class="dsb-val">' + (dur > 0 ? formatDuration(dur) : '--') + '</div><div class="dsb-lbl">Tiempo</div></div>' +
    '<div class="detail-stat-block"><div class="dsb-val">' + (pace || '--') + '</div><div class="dsb-lbl">' + (sc.unit === 'speed' ? 'Velocidad' : 'Ritmo') + '</div></div>' +
    '<div class="detail-stat-block"><div class="dsb-val">' + (hr > 0 ? hr + ' bpm' : '--') + '</div><div class="dsb-lbl">FC Media</div></div>' +
    '<div class="detail-stat-block"><div class="dsb-val">' + (cal > 0 ? cal : '--') + '</div><div class="dsb-lbl">Calorias</div></div>' +
    '</div>' +
    '<div class="detail-section"><div class="section-title">📊 Metricas Avanzadas</div>' +
    '<div class="advanced-metrics">' +
    '<div class="adv-metric"><span class="adv-metric-val">' + (tss > 0 ? tss : '--') + '</span><span class="adv-metric-lbl">TSS</span></div>' +
    '<div class="adv-metric"><span class="adv-metric-val">' + (ae > 0 ? ae.toFixed(2) : '--') + '</span><span class="adv-metric-lbl">Ef. Aerobica</span></div>' +
    '<div class="adv-metric"><span class="adv-metric-val">' + (rt > 0 ? rt + 'h' : '--') + '</span><span class="adv-metric-lbl">Recuperacion</span></div>' +
    '<div class="adv-metric"><span class="adv-metric-val">' + (ifact > 0 ? ifact.toFixed(2) : '--') + '</span><span class="adv-metric-lbl">Intensidad</span></div>' +
    '<div class="adv-metric"><span class="adv-metric-val">' + (hrMax > 0 ? hrMax + ' bpm' : '--') + '</span><span class="adv-metric-lbl">FC Max</span></div>' +
    '<div class="adv-metric"><span class="adv-metric-val">' + (elev > 0 ? Math.round(elev) + ' m' : '--') + '</span><span class="adv-metric-lbl">Elevacion</span></div>' +
    '</div></div>' +
    vo2Html + hrZonesHtml + projHtml + aiHtml +
    '<div class="detail-actions"><button class="btn-delete-modal" onclick="deleteActivityFromDetail(' + JSON.stringify(id) + ')">🗑 Eliminar Actividad</button></div>' +
    '</div>';
}

async function deleteActivity(id) {
  var r = await _db.from('activities').delete().eq('id', id).eq('user_id', currentUser.id);
  if (!r.error) { showToast('Actividad eliminada', 'success'); loadActivities(); }
  else showToast('Error al eliminar', 'error');
}

async function deleteActivityFromDetail(id) {
  var r = await _db.from('activities').delete().eq('id', id).eq('user_id', currentUser.id);
  if (!r.error) {
    showToast('Actividad eliminada', 'success');
    closeModal('activity-detail-modal');
    loadActivities();
  } else {
    showToast('Error al eliminar', 'error');
  }
}

function calcVO2Max(a) {
  var hr = parseInt(a.frecuencia_cardiaca_promedio) || 0;
  var dist = (parseFloat(a.distancia_metros) / 1000) || 0;
  var dur = parseInt(a.duracion_segundos) || 0;
  if (hr < 60 || dist < 0.5 || dur < 60) return null;
  var speed = dist / (dur / 3600);
  var vo2 = (speed * 1000 / 60) * 0.2 + 3.5;
  var hrReserve = hr / 182;
  return Math.max(20, Math.min(80, vo2 / hrReserve * 0.85));
}

function calcTSS(a) {
  var dur = parseInt(a.duracion_segundos) || 0;
  var hr = parseInt(a.frecuencia_cardiaca_promedio) || 0;
  if (!dur || !hr) return 0;
  var hrMax = 182;
  var hrThresh = 162;
  var np = hr;
  var if_ = np / hrThresh;
  return Math.round((dur / 3600) * if_ * if_ * 100);
}

function calcCTL(acts) {
  if (!acts || !acts.length) return 0;
  var ctl = 0;
  var sorted = acts.slice().sort(function(a, b) { return new Date(a.fecha_inicio) - new Date(b.fecha_inicio); });
  sorted.forEach(function(a) {
    var tss = calcTSS(a);
    ctl = ctl + (tss - ctl) / 42;
  });
  return Math.round(ctl);
}

function calcATL(acts) {
  if (!acts || !acts.length) return 0;
  var atl = 0;
  var sorted = acts.slice().sort(function(a, b) { return new Date(a.fecha_inicio) - new Date(b.fecha_inicio); });
  sorted.forEach(function(a) {
    var tss = calcTSS(a);
    atl = atl + (tss - atl) / 7;
  });
  return Math.round(atl);
}

function calcAerobicEfficiency(a) {
  var hr = parseInt(a.frecuencia_cardiaca_promedio) || 0;
  var dist = (parseFloat(a.distancia_metros) / 1000) || 0;
  var dur = parseInt(a.duracion_segundos) || 0;
  if (!hr || !dist || !dur) return 0;
  var speed = dist / (dur / 60);
  return speed / hr;
}

function calcRecoveryTime(a) {
  var tss = calcTSS(a);
  if (!tss) return 0;
  return Math.round(tss < 50 ? 12 : tss < 100 ? 24 : tss < 150 ? 36 : tss < 200 ? 48 : 72);
}

function calcIntensityFactor(a) {
  var hr = parseInt(a.frecuencia_cardiaca_promedio) || 0;
  var hrThresh = 162;
  if (!hr) return 0;
  return parseFloat((hr / hrThresh).toFixed(2));
}

function calcHRDrift(a) {
  var hr = parseInt(a.frecuencia_cardiaca_promedio) || 0;
  var hrMax = parseInt(null) || 0;
  if (!hr || !hrMax) return 0;
  return parseFloat(((hrMax - hr) / hr * 100).toFixed(1));
}

function buildHRZonesDetail(a) {
  var hr = parseInt(a.frecuencia_cardiaca_promedio) || 0;
  var hrMax = parseInt(null) || 0;
  var dur = parseInt(a.duracion_segundos) || 0;
  var mhr = 182;
  var zones = [
    { name: 'Z1', min: 0, max: 0.6, color: '#3b82f6' },
    { name: 'Z2', min: 0.6, max: 0.7, color: '#10b981' },
    { name: 'Z3', min: 0.7, max: 0.8, color: '#f59e0b' },
    { name: 'Z4', min: 0.8, max: 0.9, color: '#f97316' },
    { name: 'Z5', min: 0.9, max: 1.0, color: '#ef4444' }
  ];
  if (!hr || !dur) return '<p style="color:#6b7280;font-size:0.85rem">No hay datos de FC disponibles</p>';
  var hrPct = hr / mhr;
  var dominantZ = zones.findIndex(function(z) { return hrPct >= z.min && hrPct < z.max; });
  if (dominantZ < 0) dominantZ = 4;
  var zoneTimesPct = zones.map(function(z, i) {
    if (i === dominantZ) return 55;
    var dist2 = Math.abs(i - dominantZ);
    return Math.max(2, 20 - dist2 * 8);
  });
  var total = zoneTimesPct.reduce(function(a, b) { return a + b; }, 0);
  return '<div class="hr-zones">' + zones.map(function(z, i) {
    var pct = Math.round(zoneTimesPct[i] / total * 100);
    var secs = Math.round(dur * pct / 100);
    return '<div class="hz-row hz-z' + (i+1) + '">' +
      '<span class="hz-label" style="color:' + z.color + '">' + z.name + '</span>' +
      '<div class="hz-bar-bg"><div class="hz-bar-fill" style="width:' + pct + '%;background:' + z.color + '"></div></div>' +
      '<span class="hz-pct">' + pct + '%</span>' +
      '<span class="hz-time">' + Math.floor(secs/60) + 'min</span>' +
      '</div>';
  }).join('') + '</div>';
}

function buildRunProjections(dist, dur) {
  var pace = dur / dist;
  var races = [
    { name: '5 km', dist: 5 },
    { name: '10 km', dist: 10 },
    { name: '15 km', dist: 15 },
    { name: 'Media', dist: 21.097 },
    { name: 'Maraton', dist: 42.195 }
  ];
  var html = '<table class="proj-table"><thead><tr><th>Distancia</th><th>Tiempo Est.</th><th>Ritmo</th></tr></thead><tbody>';
  races.forEach(function(race) {
    var projTime = pace * Math.pow(race.dist / dist, 1.06) * race.dist;
    var isPR = Math.abs(race.dist - dist) < 0.5;
    html += '<tr' + (isPR ? ' class="proj-highlight"' : '') + '>' +
      '<td>' + race.name + (isPR ? ' ★' : '') + '</td>' +
      '<td>' + formatDuration(Math.round(projTime)) + '</td>' +
      '<td>' + formatPace(projTime / race.dist) + '/km</td></tr>';
  });
  html += '</tbody></table><p class="proj-note">Proyeccion basada en formula Riegel (exponente 1.06)</p>';
  return html;
}

function buildCyclingProjections(dist, dur) {
  var speed = dist / (dur / 3600);
  var routes = [
    { name: '30 km', dist: 30 },
    { name: '50 km', dist: 50 },
    { name: '100 km', dist: 100 },
    { name: '160 km', dist: 160 }
  ];
  var html = '<table class="proj-table"><thead><tr><th>Distancia</th><th>Tiempo Est.</th><th>Velocidad</th></tr></thead><tbody>';
  routes.forEach(function(route) {
    var projSpeed = speed * Math.pow(dist / route.dist, 0.04);
    var projTime = route.dist / projSpeed * 3600;
    var isCurrent = Math.abs(route.dist - dist) < 5;
    html += '<tr' + (isCurrent ? ' class="proj-highlight"' : '') + '>' +
      '<td>' + route.name + (isCurrent ? ' ★' : '') + '</td>' +
      '<td>' + formatDuration(Math.round(projTime)) + '</td>' +
      '<td>' + projSpeed.toFixed(1) + ' km/h</td></tr>';
  });
  html += '</tbody></table><p class="proj-note">Proyeccion basada en tu velocidad actual con ajuste por fatiga</p>';
  return html;
}

function generateAIAdvice(a) {
  var tips = [];
  var hr = parseInt(a.frecuencia_cardiaca_promedio) || 0;
  var dist = (parseFloat(a.distancia_metros) / 1000) || 0;
  var dur = parseInt(a.duracion_segundos) || 0;
  var hrPct = hr > 0 ? hr / 182 : 0;
  var sport = a.tipo_actividad || 'other';
  if (hrPct > 0.9) {
    tips.push('<b>Alta intensidad:</b> Esta sesion fue muy intensa. Asegurate de incluir al menos 48h de recuperacion antes de tu proxima sesion de alta intensidad.');
  } else if (hrPct > 0.8) {
    tips.push('<b>Zona 4:</b> Entrenaste en zona 4, excelente para mejorar tu umbral lactico. Alterna con sesiones de zona 2 para optimizar adaptaciones.');
  } else if (hrPct > 0.7) {
    tips.push('<b>Zona 3:</b> Intensidad moderada-alta. Esta zona es efectiva pero puede acumular fatiga rapidamente. Monitorea tu recuperacion.');
  } else if (hrPct > 0.6) {
    tips.push('<b>Zona 2:</b> Excelente sesion de base aerobica. Este tipo de trabajo mejora la eficiencia mitocondrial y la quema de grasa como combustible.');
  } else if (hrPct > 0) {
    tips.push('<b>Zona 1:</b> Sesion de recuperacion activa. Perfecta para dias despues de esfuerzos intensos.');
  }
  if (dist > 0 && dur > 0) {
    var tss = calcTSS(a);
    if (tss > 150) tips.push('<b>Carga alta (' + tss + ' TSS):</b> Esta sesion fue muy exigente. Prioriza el sueno y la nutricion post-entrenamiento para maximizar las adaptaciones.');
    else if (tss > 100) tips.push('<b>Carga moderada (' + tss + ' TSS):</b> Buena sesion de trabajo. Asegurate de hidratarte bien y consumir carbohidratos en la ventana de 30min post-ejercicio.');
    else tips.push('<b>Carga baja (' + tss + ' TSS):</b> Sesion de mantenimiento. Puedes entrenar de nuevo manana sin problemas.');
  }
  if (sport === 'running') {
    if (dist > 15) tips.push('<b>Larga distancia:</b> Despues de correr mas de 15km, considera un bano de contraste (3min frio / 1min caliente x3) para acelerar la recuperacion muscular.');
    else tips.push('<b>Consejo de carrera:</b> Trabaja en mantener una cadencia de 170-180 pasos/min para mejorar eficiencia y reducir el riesgo de lesiones.');
  } else if (sport === 'cycling' || sport === 'virtual_ride' || sport === 'indoor_cycling') {
    tips.push('<b>Ciclismo:</b> Asegurate de mantener una cadencia optima de 85-95 rpm. Pedalear en cadencias bajas aumenta el estres en las rodillas.');
  } else if (sport === 'swimming') {
    tips.push('<b>Natacion:</b> Enfocate en la tecnica del giro de cabeza para respirar - esto marca la diferencia en la eficiencia a largas distancias.');
  } else if (sport === 'strength') {
    tips.push('<b>Fuerza:</b> Asegurate de consumir proteinas dentro de los 30 minutos post-entrenamiento para optimizar la sintesis muscular.');
  }
  if (!tips.length) tips.push('<b>Sigue adelante:</b> Cada sesion cuenta. La consistencia es la clave del progreso a largo plazo.');
  return tips.slice(0, 3);
}

function showUploadModal() {
  document.getElementById('upload-modal').classList.remove('hidden');
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-area').classList.remove('drag-over');
  var file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

function handleFileSelect(e) {
  var file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  currentFile = file;
  document.getElementById('upload-area').classList.add('hidden');
  document.getElementById('upload-preview').classList.remove('hidden');
  document.getElementById('file-name-display').textContent = file.name;
  document.getElementById('file-size-display').textContent = (file.size / 1024).toFixed(1) + ' KB';
  var nameInput = document.getElementById('activity-name');
  if (nameInput) nameInput.value = file.name.replace(/\.fit$|\.gpx$|\.tcx$/i, '').replace(/_/g, ' ');
}

function resetUploadModal() {
  currentFile = null;
  document.getElementById('upload-area').classList.remove('hidden');
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-progress').classList.add('hidden');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('upload-status').textContent = 'Procesando archivo...';
  var fi = document.getElementById('file-input');
  if (fi) fi.value = '';
}

async function uploadActivity() {
  if (!currentFile || !currentUser) return;
  var name = document.getElementById('activity-name').value || currentFile.name;
  var type = document.getElementById('activity-type').value;
  var notes = document.getElementById('activity-notes').value;
  var rpe = document.getElementById('activity-rpe').value;
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-progress').classList.remove('hidden');
  var setProgress = function(p, msg) {
    document.getElementById('progress-fill').style.width = p + '%';
    document.getElementById('upload-status').textContent = msg;
  };
  setProgress(10, 'Leyendo archivo...');
  try {
    var ext = currentFile.name.split('.').pop().toLowerCase();
    var parsed = null;
    if (ext === 'fit') {
      var buf = await currentFile.arrayBuffer();
      parsed = parseFIT(buf);
    } else if (ext === 'gpx') {
      var text = await currentFile.text();
      parsed = parseGPX(text);
    } else if (ext === 'tcx') {
      var text = await currentFile.text();
      parsed = parseTCX(text);
    } else {
      throw new Error('Formato no soportado: ' + ext);
    }
    setProgress(50, 'Guardando actividad...');
    if (!parsed) throw new Error('No se pudo parsear el archivo');
    var actType = parsed.sport || type;
    var data = {
      user_id: currentUser.id,
      nombre: name,
      tipo_actividad: actType,
      fecha_inicio: parsed.date || new Date().toISOString().split('T')[0],
      duracion_segundos: parsed.duration || 0,
      distancia_metros: Math.round((parsed.distance || 0) * 1000),
      calorias: parsed.calories || 0,
      frecuencia_cardiaca_promedio: parsed.hrAvg || null,
            elevacion_ganada_m: parsed.elevation || null,
            notas: notes || null,
      percepcion_esfuerzo: parseInt(rpe) || 5,
          };
    var r = await _db.from('activities').insert([data]);
    if (r.error) throw new Error(r.error.message);
    setProgress(100, '✓ Actividad guardada!');
    setTimeout(function() {
      closeModal('upload-modal');
      resetUploadModal();
      showPage('activities');
    }, 1200);
  } catch(err) {
    setProgress(0, 'Error: ' + err.message);
    document.getElementById('progress-fill').style.background = '#ef4444';
  }
}

function parseFIT(buf) {
  var bytes = new Uint8Array(buf);
  var FIT_EPOCH = 631065600;
  var result = { sport: 'other', date: null, duration: 0, distance: 0, calories: 0, hrAvg: null, hrMax: null, elevation: null, speed: null };
  var offset = 12;
  var hrSamples = [];
  var hrMaxFound = 0;
  var elevSamples = [];
  var localMsgDefs = {};
  var i = 0;
  try {
    while (offset < bytes.length - 4) {
      var hdr = bytes[offset];
      var isCompressedTs = (hdr & 0x80) !== 0;
      if (isCompressedTs) { offset++; continue; }
      var hasDef = (hdr & 0x40) !== 0;
      var localType = hdr & 0x0F;
      offset++;
      if (hasDef) {
        offset++;
        var isBigEndian = bytes[offset] & 0x01;
        offset++;
        var globalMsgNum = isBigEndian ? (bytes[offset] << 8) | bytes[offset+1] : (bytes[offset+1] << 8) | bytes[offset];
        offset += 2;
        var numFields = bytes[offset++];
        var fields = [];
        for (var f = 0; f < numFields; f++) {
          var fNum = bytes[offset];
          var fSize = bytes[offset+1];
          var fType = bytes[offset+2];
          fields.push({ num: fNum, size: fSize, type: fType });
          offset += 3;
        }
        if (bytes[offset] !== undefined) {
          var devFields = 0;
          try { devFields = bytes[offset]; } catch(e) {}
          if ((hdr & 0x20) !== 0 && devFields !== undefined) {
            offset++;
            for (var d = 0; d < devFields; d++) offset += 3;
          }
        }
        localMsgDefs[localType] = { globalMsgNum: globalMsgNum, fields: fields, bigEndian: isBigEndian };
      } else {
        var def = localMsgDefs[localType];
        if (!def) { offset++; continue; }
        var msgStart = offset;
        var readInt = function(pos, size, bigEndian) {
          if (pos + size > bytes.length) return null;
          var v = 0;
          if (bigEndian) { for (var x = 0; x < size; x++) v = (v << 8) | bytes[pos + x]; }
          else { for (var x = size - 1; x >= 0; x--) v = (v << 8) | bytes[pos + x]; }
          return v;
        };
        var msgFields = {};
        def.fields.forEach(function(f) {
          msgFields[f.num] = readInt(offset, f.size, def.bigEndian);
          offset += f.size;
        });
        if (def.globalMsgNum === 20) {
          var hr = msgFields[3];
          if (hr && hr > 0 && hr < 230) {
            hrSamples.push(hr);
            if (hr > hrMaxFound) hrMaxFound = hr;
          }
          var alt = msgFields[2];
          if (alt && alt < 0x7FFFFFFF) elevSamples.push(alt / 5 - 500);
        } else if (def.globalMsgNum === 18) {
          if (msgFields[5] !== undefined && msgFields[5] < 0xFFFFFFF) {
            result.distance = parseFloat((msgFields[5] / 100000).toFixed(2));
          }
          if (msgFields[7] !== undefined && msgFields[7] < 0xFFFFFF) {
            result.duration = Math.round(msgFields[7] / 1000);
          }
          if (msgFields[11] !== undefined && msgFields[11] < 10000) {
            result.calories = msgFields[11];
          }
          if (msgFields[1] !== undefined && msgFields[1] < 0xFFFFFFFF) {
            var ts = msgFields[1] + FIT_EPOCH;
            var d = new Date(ts * 1000);
            result.date = d.toISOString().split('T')[0];
          }
          if (msgFields[4] !== undefined) {
            var hrAvgVal = msgFields[4];
            if (hrAvgVal > 0 && hrAvgVal < 230) result.hrAvg = hrAvgVal;
          }
          if (msgFields[5] !== undefined) {
            var hrMaxVal = msgFields[5];
            if (hrMaxVal > 0 && hrMaxVal < 230) result.hrMax = hrMaxVal;
          }
        } else if (def.globalMsgNum === 12) {
          if (msgFields[0] !== undefined) {
            var sportCode = msgFields[0];
            result.sport = FIT_SPORT_MAP[sportCode] || 'other';
          }
        }
      }
    }
  } catch(e) {}
  if (hrSamples.length > 0) {
    if (!result.hrAvg || result.hrAvg === 0) {
      result.hrAvg = Math.round(hrSamples.reduce(function(a, b) { return a + b; }, 0) / hrSamples.length);
    }
    if (!result.hrMax || result.hrMax === 0) result.hrMax = hrMaxFound;
  }
  if (elevSamples.length > 1) {
    var gain = 0;
    for (var eg = 1; eg < elevSamples.length; eg++) {
      var diff = elevSamples[eg] - elevSamples[eg-1];
      if (diff > 0) gain += diff;
    }
    result.elevation = Math.round(gain);
  }
  if (result.distance > 0 && result.duration > 0) {
    result.speed = parseFloat((result.distance / (result.duration / 3600)).toFixed(2));
  }
  return result;
}

function parseTCX(text) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(text, 'text/xml');
  var result = { sport: 'running', date: null, duration: 0, distance: 0, calories: 0, hrAvg: null, hrMax: null, elevation: null, speed: null };
  var activity = doc.querySelector('Activity');
  if (!activity) return result;
  var sport = activity.getAttribute('Sport') || 'Running';
  var sportMap = { Running: 'running', Cycling: 'cycling', Biking: 'cycling', Swimming: 'swimming', Walking: 'walking', Hiking: 'hiking', Other: 'other' };
  result.sport = sportMap[sport] || 'running';
  var startTime = doc.querySelector('Id');
  if (startTime) result.date = startTime.textContent.split('T')[0];
  var totalTime = doc.querySelector('TotalTimeSeconds');
  if (totalTime) result.duration = Math.round(parseFloat(totalTime.textContent));
  var distM = doc.querySelector('DistanceMeters');
  if (distM) result.distance = parseFloat((parseFloat(distM.textContent) / 1000).toFixed(2));
  var cal = doc.querySelector('Calories');
  if (cal) result.calories = parseInt(cal.textContent) || 0;
  var hrVals = doc.querySelectorAll('HeartRateBpm Value');
  if (hrVals.length) {
    var hrs = Array.from(hrVals).map(function(h) { return parseInt(h.textContent); }).filter(function(h) { return h > 0 && h < 250; });
    if (hrs.length) {
      result.hrAvg = Math.round(hrs.reduce(function(a, b) { return a + b; }, 0) / hrs.length);
      result.hrMax = Math.max.apply(null, hrs);
    }
  }
  var altVals = doc.querySelectorAll('AltitudeMeters');
  if (altVals.length > 1) {
    var gain = 0;
    var prev = parseFloat(altVals[0].textContent);
    for (var ag = 1; ag < altVals.length; ag++) {
      var cur = parseFloat(altVals[ag].textContent);
      if (cur - prev > 0) gain += cur - prev;
      prev = cur;
    }
    result.elevation = Math.round(gain);
  }
  if (result.distance > 0 && result.duration > 0) result.speed = parseFloat((result.distance / (result.duration / 3600)).toFixed(2));
  return result;
}

function parseGPX(text) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(text, 'text/xml');
  var result = { sport: 'running', date: null, duration: 0, distance: 0, calories: 0, hrAvg: null, hrMax: null, elevation: null, speed: null };
  var trkName = doc.querySelector('name');
  var metaTime = doc.querySelector('metadata time') || doc.querySelector('time');
  if (metaTime) result.date = metaTime.textContent.split('T')[0];
  var trkpts = doc.querySelectorAll('trkpt');
  if (!trkpts.length) return result;
  var coords = [];
  var hrVals = [];
  var elevGain = 0;
  var prevElev = null;
  trkpts.forEach(function(pt) {
    var lat = parseFloat(pt.getAttribute('lat'));
    var lon = parseFloat(pt.getAttribute('lon'));
    var elevEl = pt.querySelector('ele');
    var timeEl = pt.querySelector('time');
    var hrEl = pt.querySelector('hr') || pt.querySelector('[localName="hr"]');
    if (!isNaN(lat) && !isNaN(lon)) coords.push({ lat: lat, lon: lon, time: timeEl ? new Date(timeEl.textContent) : null });
    if (elevEl) {
      var elev = parseFloat(elevEl.textContent);
      if (prevElev !== null && elev - prevElev > 0) elevGain += elev - prevElev;
      prevElev = elev;
    }
    if (hrEl) {
      var hr = parseInt(hrEl.textContent);
      if (hr > 0 && hr < 250) hrVals.push(hr);
    }
  });
  if (coords.length > 1) {
    var totalDist = 0;
    for (var ci = 1; ci < coords.length; ci++) {
      totalDist += haversine(coords[ci-1].lat, coords[ci-1].lon, coords[ci].lat, coords[ci].lon);
    }
    result.distance = parseFloat(totalDist.toFixed(2));
    if (coords[0].time && coords[coords.length-1].time) {
      result.duration = Math.round((coords[coords.length-1].time - coords[0].time) / 1000);
      if (!result.date) result.date = coords[0].time.toISOString().split('T')[0];
    }
  }
  if (hrVals.length) {
    result.hrAvg = Math.round(hrVals.reduce(function(a, b) { return a + b; }, 0) / hrVals.length);
    result.hrMax = Math.max.apply(null, hrVals);
  }
  if (elevGain > 0) result.elevation = Math.round(elevGain);
  if (result.distance > 0 && result.duration > 0) result.speed = parseFloat((result.distance / (result.duration / 3600)).toFixed(2));
  return result;
}

function haversine(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function loadDailyMetrics() {
  var date = (document.getElementById('daily-date-picker') || {}).value || new Date().toISOString().split('T')[0];
  var setEl = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v !== null && v !== undefined ? v : '-'; };
  if (!currentUser) return;
  var r = await _db.from('daily_metrics').select('*').eq('user_id', currentUser.id).eq('fecha_inicio', date).maybeSingle();
  var d = r.data;
  setEl('d-steps', d && d.pasos ? d.pasos.toLocaleString() : '-');
  setEl('d-hr', d && d.fc_reposo ? d.fc_reposo + ' bpm' : '-');
  setEl('d-battery', d && d.body_battery ? d.body_battery + '%' : '-');
  setEl('d-sleep', d && d.horas_sueno ? d.horas_sueno + 'h' : '-');
  setEl('d-stress', d && d.estres ? d.estres : '-');
  setEl('d-hrv', d && d.hrv ? d.hrv + ' ms' : '-');
  setEl('d-readiness', d && d.training_readiness ? d.training_readiness : '-');
  setEl('d-spo2', d && d.spo2 ? d.spo2 + '%' : '-');
  renderWellnessChart(date);
}

async function renderWellnessChart(date) {
  var ctx = document.getElementById('wellness-chart');
  if (!ctx || !currentUser) return;
  if (charts.wellness) { charts.wellness.destroy(); }
  var end = new Date(date);
  var start = new Date(end); start.setDate(start.getDate() - 6);
  var r = await _db.from('daily_metrics').select('fecha,fc_reposo,body_battery,pasos').eq('user_id', currentUser.id).gte('fecha_inicio', start.toISOString().split('T')[0]).lte('fecha_inicio', date).order('fecha_inicio', { ascending: true });
  var data = r.data || [];
  var labels = data.map(function(d) { return d.fecha_inicio.slice(5); });
  var hrData = data.map(function(d) { return d.fc_reposo || null; });
  var battData = data.map(function(d) { return d.body_battery || null; });
  charts.wellness = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'FC Reposo', data: hrData, borderColor: '#f87171', tension: 0.3, fill: false, pointBackgroundColor: '#f87171' },
        { label: 'Body Battery', data: battData, borderColor: '#34d399', tension: 0.3, fill: false, pointBackgroundColor: '#34d399' }
      ]
    },
    options: { responsive: true, plugins: { legend: { labels: { color: '#9ca3af' } } }, scales: { x: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
  });
}

async function loadRecords() {
  if (!currentUser) return;
  var r = await _db.from('activities').select('*').eq('user_id', currentUser.id);
  var acts = r.data || [];
  var runActs = acts.filter(function(a) { return a.tipo_actividad === 'running' && (parseFloat(a.distancia_metros) / 1000) > 0 && parseInt(a.duracion_segundos) > 0; });
  var setRec = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
  var findPR = function(targetDist) {
    var best = null;
    runActs.forEach(function(a) {
      var dist = (parseFloat(a.distancia_metros) / 1000);
      var dur = parseInt(a.duracion_segundos);
      if (dist >= targetDist) {
        var projTime = dur * (targetDist / dist);
        if (!best || projTime < best) best = projTime;
      }
    });
    return best ? formatDuration(Math.round(best)) : '--:--';
  };
  setRec('pr-5k', findPR(5));
  setRec('pr-10k', findPR(10));
  setRec('pr-half', findPR(21.097));
  setRec('pr-full', findPR(42.195));
  var longestAct = acts.reduce(function(best, a) {
    return (parseFloat(a.distancia_metros) / 1000) > parseFloat((best.distancia_metros || 0) / 1000) ? a : best;
  }, {});
  setRec('pr-longest', longestAct.distancia_metros ? parseFloat(longestAct.distancia_metros).toFixed(1) + ' km' : '-- km');
  var maxSpeed = acts.reduce(function(m, a) {
    var s = parseFloat(null) || 0;
    return s > m ? s : m;
  }, 0);
  setRec('pr-speed', maxSpeed > 0 ? maxSpeed.toFixed(1) + ' km/h' : '-- km/h');
}

async function loadPlans() {
  if (!currentUser) return;
  var list = document.getElementById('plans-list');
  if (!list) return;
  var r = await _db.from('plans').select('*').eq('user_id', currentUser.id);
  var plans = r.data || [];
  if (!plans.length) {
    list.innerHTML = '<div class="empty-state"><span class="empty-icon">📋</span><p>Sin planes. Crea tu primer plan.</p></div>';
    return;
  }
  list.innerHTML = plans.map(function(p) {
    return '<div class="plan-card">' +
      '<div><h4>' + (p.nombre || 'Plan') + '</h4>' +
      '<p style="font-size:0.85rem;color:#6b7280;margin-top:4px">' + (p.descripcion || '') + '</p></div>' +
      '<span class="plan-badge">' + (p.deporte || p.sport || '') + '</span></div>';
  }).join('');
}

function showCreatePlanModal() {
  document.getElementById('plan-modal').classList.remove('hidden');
}

async function createPlan(e) {
  e.preventDefault();
  var name = document.getElementById('plan-name').value;
  var desc = document.getElementById('plan-desc').value;
  var sport = document.getElementById('plan-sport').value;
  var level = document.getElementById('plan-level').value;
  var weeks = document.getElementById('plan-weeks').value;
  var start = document.getElementById('plan-start').value;
  var r = await _db.from('plans').insert([{ user_id: currentUser.id, nombre: name, descripcion: desc, deporte: sport, nivel: level, semanas: parseInt(weeks), fecha_inicio: start }]);
  if (!r.error) { showToast('Plan creado', 'success'); closeModal('plan-modal'); loadPlans(); }
  else showToast('Error: ' + r.error.message, 'error');
}

async function deletePlan(id) {
  var r = await _db.from('plans').delete().eq('id', id).eq('user_id', currentUser.id);
  if (!r.error) { showToast('Plan eliminado', 'success'); loadPlans(); }
}

function loadProfile() {
  loadProfilePage();
}

async function loadProfilePage() {
  if (!currentUser) return;
  var dob = new Date('1988-02-20');
  var age = Math.floor((new Date() - dob) / (365.25 * 24 * 3600 * 1000));
  var setEl = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('p-age', age + ' anos');
  setEl('p-weight', '73 kg');
  setEl('p-height', '1.72 m');
  setEl('p-bmi', '24.7');
  setEl('p-maxhr', '182 bpm');
  setEl('p-resthr', '60 bpm');
  var profileName = document.getElementById('profile-name');
  if (profileName) profileName.textContent = currentUser.email ? currentUser.email.split('@')[0] : 'Sebastian';
}

function connectGarmin() {
  showToast('Conexion con Garmin Connect proximamente', 'success');
}

function getSportConfig(sport) {
  return SPORT_CONFIG[sport] || SPORT_CONFIG['other'];
}

function formatDuration(secs) {
  if (!secs || secs <= 0) return '0:00:00';
  var s = Math.min(Math.abs(Math.round(secs)), 359999);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  return h + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPace(secsPerKm) {
  if (!secsPerKm || secsPerKm <= 0 || secsPerKm > 1800) return '--';
  var m = Math.floor(secsPerKm / 60);
  var s = Math.round(secsPerKm % 60);
  return m + ':' + String(s).padStart(2,'0');
}

function getWeekKey(date) {
  var d = new Date(date);
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function showToast(msg, type) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + (type || 'success');
  setTimeout(function() { t.className = 'toast hidden'; }, 3000);
}
