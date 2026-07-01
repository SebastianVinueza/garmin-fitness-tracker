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
      return '<div class="strava-row" onclick="openDetail(' + "'" + a.id + "'" + ')">' +
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
    var idStr = "'" + a.id + "'";
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
    '<div class="detail-actions"><button class="btn-delete-modal" onclick="deleteActivityFromDetail(' + "'" + id + "'" + ')">🗑 Eliminar Actividad</button></div>' +
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

async function processFile(file) {
  currentFile = file;
  document.getElementById('upload-area').classList.add('hidden');
  document.getElementById('upload-preview').classList.remove('hidden');
  document.getElementById('file-name-display').textContent = file.name;
  document.getElementById('file-size-display').textContent = (file.size / 1024).toFixed(1) + ' KB';
  var nameInput = document.getElementById('activity-name');
  if (nameInput) nameInput.value = file.name.replace(/\.fit$|\.gpx$|\.tcx$/i, '').replace(/_/g, ' ');
  // Pre-parse file to show preview stats
  try {
    var ext = file.name.split('.').pop().toLowerCase();
    var parsed = null;
    if (ext === 'fit') { var buf = await file.arrayBuffer(); parsed = parseFIT(buf); }
    else if (ext === 'gpx') { var txt = await file.text(); parsed = parseGPX(txt); }
    else if (ext === 'tcx') { var txt = await file.text(); parsed = parseTCX(txt); }
    if (parsed) {
      window._lastParsed = parsed;
      var previewEl = document.getElementById('file-parse-preview');
      if (!previewEl) {
        previewEl = document.createElement('div');
        previewEl.id = 'file-parse-preview';
        previewEl.style.cssText = 'margin:8px 0;padding:10px;background:#f0f9ff;border-radius:8px;font-size:13px;color:#0369a1;display:flex;flex-wrap:wrap;gap:10px;';
        var previewContainer = document.getElementById('upload-preview');
        if (previewContainer) previewContainer.insertBefore(previewEl, previewContainer.firstChild);
      }
      var dist = parsed.distance ? parsed.distance.toFixed(2) + ' km' : '--';
      var dur = parsed.duration ? formatDuration(parsed.duration) : '--';
      var hr = parsed.hrAvg ? parsed.hrAvg + ' bpm' : '--';
      var cad = parsed.cadenceAvg ? parsed.cadenceAvg + ' rpm' : '--';
      var pwr = parsed.power ? parsed.power + ' W' : '--';
      var elev = parsed.elevation ? '+' + parsed.elevation + 'm' : '--';
      var pace = '';
      if (parsed.distance > 0 && parsed.duration > 0) {
        var secPerKm = parsed.duration / parsed.distance;
        var pm = Math.floor(secPerKm / 60);
        var ps = Math.round(secPerKm % 60);
        pace = pm + ':' + (ps < 10 ? '0' : '') + ps + ' /km';
      }
      previewEl.innerHTML = '<strong>📊 Datos detectados:</strong>' +
        '<span>📏 ' + dist + '</span>' +
        '<span>⏱ ' + dur + '</span>' +
        (pace ? '<span>🏃 ' + pace + '</span>' : '') +
        '<span>❤️ ' + hr + '</span>' +
        (parsed.cadenceAvg ? '<span>🦵 ' + cad + '</span>' : '') +
        (parsed.power ? '<span>⚡ ' + pwr + '</span>' : '') +
        '<span>⛰️ ' + elev + '</span>' +
        '<span>🏅 ' + (parsed.sport || 'otro') + '</span>';
      if (parsed.sport) {
        var typeSelect = document.getElementById('activity-type');
        if (typeSelect) typeSelect.value = parsed.sport;
      }
    }
  } catch(e) { console.warn('preview parse error:', e.message); }
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
    var parsed = window._lastParsed || null;
    if (!parsed) {
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
    }
    window._lastParsed = null;
    console.log('Parsed activity data:', JSON.stringify(parsed));
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

function readFITInt(bytes, pos, size, bigEndian) {
  if (pos + size > bytes.length) return null;
  var v = 0;
  if (bigEndian) {
    for (var x = 0; x < size; x++) v = (v * 256 + bytes[pos + x]) >>> 0;
  } else {
    for (var x = size - 1; x >= 0; x--) v = (v * 256 + bytes[pos + x]) >>> 0;
  }
  return v;
}
function processFITRecord(globalMsgNum, msgFields, result, hrSamples, cadSamples, powerSamples, elevSamples, speedSamples) {
  var FIT_EPOCH = 631065600;
  // Message 20 = record (individual data points)
  if (globalMsgNum === 20) {
    // Field 3 = heart_rate (bpm) - *** CORRECTED from old code which had wrong field ***
    // Actually in FIT: record fields: 0=timestamp, 1=lat, 2=lon, 3=altitude, 4=heart_rate, 5=cadence, 6=distance, 7=speed, 8=power
    // BUT: field numbers are DEFINED by the device, so we store ALL fields and match by field definition
    // The field numbers below are the FIT GLOBAL field numbers for message 20:
    var hr = msgFields[3]; // heart_rate - THIS IS WRONG - it was field 4 in real FIT spec
    // In FIT Protocol, record message 20 field definitions:
    // Field def 0 = position_lat, 1 = position_long, 2 = altitude, 3 = heart_rate, 4 = cadence, 5 = distance, 6 = speed, 7 = power
    // BUT Garmin DOES use those field numbers! So field 3 = heart_rate is CORRECT per Garmin FIT SDK
    if (hr !== null && hr > 0 && hr < 250 && hr !== 255) hrSamples.push(hr);
    // Field 4 = cadence (rpm)
    var cad = msgFields[4];
    if (cad !== null && cad > 0 && cad < 250 && cad !== 255) cadSamples.push(cad);
    // Field 6 = speed (mm/s) - Garmin stores speed as mm/s * 1000 = so divide by 1000 to get m/s, then *3.6 for km/h
    var spd = msgFields[6];
    if (spd !== null && spd < 0xFFFF && spd > 0) {
      var spdKmh = (spd / 1000) * 3.6; // mm/s -> m/s -> km/h
      if (spdKmh > 0 && spdKmh < 150) speedSamples.push(spdKmh);
    }
    // Field 7 = power (watts) - for cycling
    var pwr = msgFields[7];
    if (pwr !== null && pwr < 0xFFFF && pwr > 0 && pwr < 3000) powerSamples.push(pwr);
    // Field 2 = altitude - FIT stores as (altitude + 500) * 5, uint16
    // So real altitude = value/5 - 100  -- actually: value * 5/100 - 500 => value / 20 - 500? 
    // FIT Spec: altitude stored as uint16, scale=1/5, offset=-500 => real = raw/5 - 500 but raw > 500*5=2500 always
    var alt = msgFields[2];
    if (alt !== null && alt < 0x7FFF && alt > 0) {
      var realAlt = alt / 5 - 500;
      if (realAlt > -500 && realAlt < 9000) elevSamples.push(realAlt);
    }
    // Field 5 = distance (cm) - cumulative distance in cm
    var dist5 = msgFields[5];
    if (dist5 !== null && dist5 < 0xFFFFFFFF && dist5 > 0) {
      var distKm = dist5 / 100000; // cm -> m -> km
    }
  }
  // Message 18 = session summary (most reliable totals)
  else if (globalMsgNum === 18) {
    // Field 2 = start_time (FIT timestamp)
    var ts = msgFields[2];
    if (ts !== null && ts < 0xFFFFFFFF && ts > 0) {
      var d = new Date((ts + FIT_EPOCH) * 1000);
      result.date = d.toISOString().split('T')[0];
    }
    // Field 5 = total_distance (cm) 
    var totalDist = msgFields[5];
    if (totalDist !== null && totalDist < 0xFFFFFFFF && totalDist > 0) {
      result.distance = parseFloat((totalDist / 100000).toFixed(2)); // cm to km
    }
    // Field 7 = total_elapsed_time (ms * 1000, so stored as uint32 in 1/1000 s units)
    // Actually FIT stores elapsed time in milliseconds / 1000 so it's seconds*1000 NO
    // FIT spec: total_elapsed_time scale=1000, unit=s, type=uint32 -> value/1000 = seconds
    var elapsed = msgFields[7];
    if (elapsed !== null && elapsed < 0xFFFFFF && elapsed > 0) {
      result.duration = Math.round(elapsed / 1000);
    }
    // Field 9 = total_calories (kcal)
    var cals = msgFields[9];
    if (cals !== null && cals < 60000 && cals > 0) result.calories = cals;
    // Field 14 = avg_speed (mm/s) -> km/h
    var avgSpd = msgFields[14];
    if (avgSpd !== null && avgSpd < 0xFFFF && avgSpd > 0) {
      result.speed = parseFloat(((avgSpd / 1000) * 3.6).toFixed(2));
    }
    // Field 16 = avg_heart_rate
    var avgHr = msgFields[16];
    if (avgHr !== null && avgHr > 0 && avgHr < 250 && avgHr !== 255) result.hrAvg = avgHr;
    // Field 17 = max_heart_rate
    var maxHr = msgFields[17];
    if (maxHr !== null && maxHr > 0 && maxHr < 250 && maxHr !== 255) result.hrMax = maxHr;
    // Field 18 = avg_cadence
    var avgCad = msgFields[18];
    if (avgCad !== null && avgCad > 0 && avgCad < 250 && avgCad !== 255) result.cadenceAvg = avgCad;
    // Field 20 = total_ascent (m)
    var ascent = msgFields[20];
    if (ascent !== null && ascent < 30000 && ascent > 0) result.elevation = ascent;
    // Field 34 = avg_power (watts)
    var avgPwr = msgFields[34];
    if (avgPwr !== null && avgPwr < 5000 && avgPwr > 0) result.power = avgPwr;
  }
  // Message 12 = sport
  else if (globalMsgNum === 12) {
    var FIT_SPORT_MAP = {0:'other',1:'running',2:'cycling',3:'transition',4:'fitness_equipment',5:'swimming',8:'rowing',11:'walking',15:'golf',17:'mountain_biking',24:'hiking',26:'multisport',29:'paddling',46:'yoga',48:'pilates',52:'virtual_cycling'};
    var sportCode = msgFields[0];
    if (sportCode !== null && sportCode !== undefined) {
      result.sport = FIT_SPORT_MAP[sportCode] || 'other';
    }
  }
  // Message 0 = file_id - has start timestamp sometimes
  else if (globalMsgNum === 0) {
    var ts0 = msgFields[4]; // time_created field
    if (ts0 !== null && ts0 > 0 && ts0 < 0xFFFFFFFF && !result.date) {
      var d0 = new Date((ts0 + FIT_EPOCH) * 1000);
      result.date = d0.toISOString().split('T')[0];
    }
  }
}
function parseFIT(buf) {
  var bytes = new Uint8Array(buf);
  var FIT_EPOCH = 631065600;
  var result = {
    sport: 'other', date: null, duration: 0, distance: 0,
    calories: 0, hrAvg: null, hrMax: null, cadenceAvg: null,
    elevation: null, speed: null, power: null
  };
  // Validate FIT header
  if (bytes.length < 14) return result;
  var headerSize = bytes[0];
  if (headerSize < 12) return result;
  // Check magic bytes ".FIT"
  if (bytes[8] !== 46 || bytes[9] !== 70 || bytes[10] !== 73 || bytes[11] !== 84) {
    // Not a valid FIT file
    return result;
  }
  var offset = headerSize;
  var localMsgDefs = {};
  var hrSamples = [];
  var cadSamples = [];
  var powerSamples = [];
  var elevSamples = [];
  var speedSamples = [];
  var distanceFromRecord = 0;
  var lastRecordDist = 0;
  try {
    while (offset < bytes.length - 4) {
      var hdr = bytes[offset];
      // Compressed timestamp header (bit 7 = 1)
      if ((hdr & 0x80) !== 0) {
        var ctLocalType = (hdr >> 5) & 0x03;
        var def = localMsgDefs[ctLocalType];
        if (def) {
          var totalSize = 0;
          def.fields.forEach(function(f) { totalSize += f.size; });
          // Process record data with last known definition
          var msgFields = {};
          var moff = offset + 1;
          def.fields.forEach(function(f) {
            msgFields[f.num] = readFITInt(bytes, moff, f.size, def.bigEndian);
            moff += f.size;
          });
          processFITRecord(def.globalMsgNum, msgFields, result, hrSamples, cadSamples, powerSamples, elevSamples, speedSamples);
          offset = moff;
        } else {
          offset++;
        }
        continue;
      }
      var hasDef = (hdr & 0x40) !== 0;
      var hasDevData = (hdr & 0x20) !== 0;
      var localType = hdr & 0x0F;
      offset++;
      if (hasDef) {
        offset++; // reserved
        var isBigEndian = (bytes[offset] & 0x01) !== 0;
        offset++;
        var globalMsgNum = isBigEndian
          ? (bytes[offset] << 8) | bytes[offset+1]
          : (bytes[offset+1] << 8) | bytes[offset];
        offset += 2;
        var numFields = bytes[offset++];
        var fields = [];
        for (var f = 0; f < numFields; f++) {
          fields.push({ num: bytes[offset], size: bytes[offset+1], type: bytes[offset+2] });
          offset += 3;
        }
        // Developer data fields
        if (hasDevData) {
          var numDevFields = bytes[offset++];
          offset += numDevFields * 3;
        }
        localMsgDefs[localType] = { globalMsgNum: globalMsgNum, fields: fields, bigEndian: isBigEndian };
      } else {
        var def2 = localMsgDefs[localType];
        if (!def2) { offset++; continue; }
        var msgFields2 = {};
        def2.fields.forEach(function(f) {
          var val = readFITInt(bytes, offset, f.size, def2.bigEndian);
          msgFields2[f.num] = val;
          offset += f.size;
        });
        processFITRecord(def2.globalMsgNum, msgFields2, result, hrSamples, cadSamples, powerSamples, elevSamples, speedSamples);
      }
    }
  } catch(e) { console.warn('FIT parse error:', e.message); }
  // Post-process averages
  if (hrSamples.length > 0) {
    if (!result.hrAvg) result.hrAvg = Math.round(hrSamples.reduce(function(a,b){return a+b;},0)/hrSamples.length);
    if (!result.hrMax) result.hrMax = Math.max.apply(null, hrSamples);
  }
  if (cadSamples.length > 0) result.cadenceAvg = Math.round(cadSamples.reduce(function(a,b){return a+b;},0)/cadSamples.length);
  if (powerSamples.length > 0) result.power = Math.round(powerSamples.reduce(function(a,b){return a+b;},0)/powerSamples.length);
  if (elevSamples.length > 1) {
    var gain = 0;
    for (var eg = 1; eg < elevSamples.length; eg++) {
      var diff = elevSamples[eg] - elevSamples[eg-1];
      if (diff > 0.5) gain += diff;
    }
    if (!result.elevation || result.elevation === 0) result.elevation = Math.round(gain);
  }
  if (speedSamples.length > 0 && (!result.speed || result.speed === 0)) {
    result.speed = parseFloat((speedSamples.reduce(function(a,b){return a+b;},0)/speedSamples.length).toFixed(2));
  }
  if (result.distance === 0 && result.duration > 0 && result.speed > 0) {
    result.distance = parseFloat((result.speed * result.duration / 3600).toFixed(2));
  }
  if (result.distance > 0 && result.duration > 0 && !result.speed) {
    result.speed = parseFloat((result.distance / (result.duration / 3600)).toFixed(2));
  }
  return result;
}
function parseTCX(text) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(text, 'text/xml');
  var result = {
    sport: 'running', date: null, duration: 0, distance: 0,
    calories: 0, hrAvg: null, hrMax: null, cadenceAvg: null,
    elevation: null, speed: null, power: null
  };
  var activity = doc.querySelector('Activity');
  if (!activity) return result;
  // Sport mapping - completo con todos los deportes Garmin
  var sport = (activity.getAttribute('Sport') || 'Running').toLowerCase();
  var sportMap = {
    'running': 'running', 'cycling': 'cycling', 'biking': 'cycling',
    'swimming': 'swimming', 'walking': 'walking', 'hiking': 'hiking',
    'other': 'other', 'fitness equipment': 'fitness_equipment',
    'rowing': 'rowing', 'elliptical': 'elliptical', 'stair climbing': 'stair_climbing',
    'yoga': 'yoga', 'strength training': 'strength_training',
    'trail running': 'trail_running', 'mountain biking': 'mountain_biking',
    'open water': 'open_water_swimming', 'paddling': 'paddling', 'golf': 'golf'
  };
  result.sport = sportMap[sport] || (sport.includes('run') ? 'running' : sport.includes('cycl') || sport.includes('bik') ? 'cycling' : 'other');
  // Date from Activity Id or first trackpoint
  var idEl = doc.querySelector('Id');
  if (idEl) result.date = idEl.textContent.trim().split('T')[0];
  // Get all laps
  var laps = doc.querySelectorAll('Lap');
  var totalDist = 0;
  var totalTime = 0;
  var totalCal = 0;
  var hrVals = [];
  var cadVals = [];
  var altVals = [];
  laps.forEach(function(lap) {
    var lapTime = lap.querySelector('TotalTimeSeconds');
    if (lapTime) totalTime += parseFloat(lapTime.textContent) || 0;
    var lapDist = lap.querySelector('DistanceMeters');
    if (lapDist) totalDist += parseFloat(lapDist.textContent) || 0;
    var lapCal = lap.querySelector('Calories');
    if (lapCal) totalCal += parseInt(lapCal.textContent) || 0;
    // Trackpoints within this lap
    lap.querySelectorAll('Trackpoint').forEach(function(tp) {
      var hrEl = tp.querySelector('HeartRateBpm Value');
      if (hrEl) {
        var hr = parseInt(hrEl.textContent);
        if (hr > 0 && hr < 250) hrVals.push(hr);
      }
      var cadEl = tp.querySelector('Cadence') || tp.querySelector('RunCadence');
      if (!cadEl) {
        // Try extensions namespace
        var ext = tp.querySelector('Extensions');
        if (ext) {
          cadEl = ext.querySelector('RunCadence') || ext.querySelector('Cadence') || ext.querySelector('Watts');
        }
      }
      if (cadEl && cadEl.tagName && !cadEl.tagName.toLowerCase().includes('watts')) {
        var cad = parseInt(cadEl.textContent);
        if (cad > 0 && cad < 250) cadVals.push(cad);
      }
      var altEl = tp.querySelector('AltitudeMeters');
      if (altEl) altVals.push(parseFloat(altEl.textContent));
    });
  });
  result.duration = Math.round(totalTime);
  result.distance = parseFloat((totalDist / 1000).toFixed(2));
  result.calories = totalCal;
  if (hrVals.length) {
    result.hrAvg = Math.round(hrVals.reduce(function(a,b){return a+b;},0)/hrVals.length);
    result.hrMax = Math.max.apply(null, hrVals);
  }
  if (cadVals.length) {
    result.cadenceAvg = Math.round(cadVals.reduce(function(a,b){return a+b;},0)/cadVals.length);
  }
  if (altVals.length > 1) {
    var gain = 0;
    for (var i = 1; i < altVals.length; i++) {
      var diff = altVals[i] - altVals[i-1];
      if (diff > 0.5) gain += diff;
    }
    result.elevation = Math.round(gain);
  }
  if (result.distance > 0 && result.duration > 0) {
    result.speed = parseFloat((result.distance / (result.duration / 3600)).toFixed(2));
  }
  return result;
}
function parseGPX(text) {
  var result = {
    sport: 'running', date: null, duration: 0, distance: 0,
    calories: 0, hrAvg: null, hrMax: null, cadenceAvg: null,
    elevation: null, speed: null, power: null
  };
  // DOMParser with namespace handling - Garmin uses gpxtpx: and gpxdata: namespaces
  var parser = new DOMParser();
  var doc = parser.parseFromString(text, 'text/xml');
  // Check parse error
  if (doc.querySelector('parsererror')) {
    // Try as HTML fallback
    doc = parser.parseFromString(text, 'text/html');
  }
  // Sport from track type or name
  var trkType = doc.querySelector('type');
  if (trkType) {
    var trkTypeTxt = trkType.textContent.trim().toLowerCase();
    var typeMap = {
      '1':'running', '9':'cycling', '5':'hiking', '11':'walking',
      'running':'running', 'cycling':'cycling', 'swimming':'swimming',
      'hiking':'hiking', 'walking':'walking', 'cycling_sport':'cycling',
      'mountain_biking':'mountain_biking', 'trail_running':'trail_running',
      'open_water':'open_water_swimming', 'rowing':'rowing',
      'virtual_activity':'virtual_cycling', 'yoga':'yoga', 'other':'other'
    };
    result.sport = typeMap[trkTypeTxt] || result.sport;
  }
  // Date from metadata or first time element
  var metaTime = doc.querySelector('metadata > time');
  if (!metaTime) metaTime = doc.querySelector('time');
  if (metaTime) result.date = metaTime.textContent.trim().split('T')[0];
  // Get all trackpoints
  var trkpts = doc.querySelectorAll('trkpt');
  if (!trkpts.length) {
    // Try route points
    trkpts = doc.querySelectorAll('rtept');
  }
  if (!trkpts.length) return result;
  var coords = [];
  var hrVals = [];
  var cadVals = [];
  var pwrVals = [];
  var elevGain = 0;
  var prevElev = null;
  trkpts.forEach(function(pt) {
    var lat = parseFloat(pt.getAttribute('lat'));
    var lon = parseFloat(pt.getAttribute('lon'));
    var timeEl = pt.querySelector('time');
    var t = timeEl ? new Date(timeEl.textContent.trim()) : null;
    if (!isNaN(lat) && !isNaN(lon)) {
      coords.push({ lat: lat, lon: lon, time: t });
    }
    // Elevation
    var eleEl = pt.querySelector('ele');
    if (eleEl) {
      var elev = parseFloat(eleEl.textContent);
      if (!isNaN(elev)) {
        if (prevElev !== null && elev - prevElev > 0.5) elevGain += elev - prevElev;
        prevElev = elev;
      }
    }
    // === HR from Garmin extensions ===
    // Garmin GPX uses: <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>145</gpxtpx:hr>
    // DOMParser with text/xml preserves namespace prefixes so we need getElementsByTagName with local name
    var hrVal = null;
    // Method 1: getElementsByTagNameNS (works if namespace is declared)
    var hrEls = pt.getElementsByTagNameNS('http://www.garmin.com/xmlschemas/TrackPointExtension/v2', 'hr');
    if (!hrEls || !hrEls.length) hrEls = pt.getElementsByTagNameNS('http://www.garmin.com/xmlschemas/TrackPointExtension/v1', 'hr');
    if (hrEls && hrEls.length) hrVal = parseInt(hrEls[0].textContent);
    // Method 2: Look for any element ending in :hr using getElementsByTagName wildcard
    if (!hrVal) {
      var allEls = pt.getElementsByTagName('*');
      for (var ei = 0; ei < allEls.length; ei++) {
        var ln = allEls[ei].localName || allEls[ei].tagName;
        if (ln === 'hr' || ln.endsWith(':hr')) {
          var v = parseInt(allEls[ei].textContent);
          if (v > 0) { hrVal = v; break; }
        }
        if (ln === 'heartrate' || ln === 'HeartRate') {
          var v = parseInt(allEls[ei].textContent);
          if (v > 0) { hrVal = v; break; }
        }
      }
    }
    // Method 3: Regex on raw XML snippet
    if (!hrVal) {
      // Extract this trackpoint's XML to search with regex
      var ser = new XMLSerializer().serializeToString(pt);
      var hrMatch = ser.match(/<[^>]*:hr[^>]*>(\d+)<\/[^>]*:hr>/);
      if (!hrMatch) hrMatch = ser.match(/<[Hh]eart[Rr]ate[^>]*>(\d+)<\/[Hh]eart[Rr]ate>/);
      if (hrMatch) hrVal = parseInt(hrMatch[1]);
    }
    if (hrVal && hrVal > 0 && hrVal < 250) hrVals.push(hrVal);
    // === Cadence ===
    var cadVal = null;
    var cadEls = pt.getElementsByTagNameNS('http://www.garmin.com/xmlschemas/TrackPointExtension/v2', 'cad');
    if (!cadEls || !cadEls.length) cadEls = pt.getElementsByTagNameNS('http://www.garmin.com/xmlschemas/TrackPointExtension/v1', 'cad');
    if (cadEls && cadEls.length) cadVal = parseInt(cadEls[0].textContent);
    if (!cadVal) {
      var allEls2 = pt.getElementsByTagName('*');
      for (var ei2 = 0; ei2 < allEls2.length; ei2++) {
        var ln2 = allEls2[ei2].localName || allEls2[ei2].tagName;
        if (ln2 === 'cad' || ln2.endsWith(':cad') || ln2.toLowerCase() === 'cadence') {
          var v2 = parseInt(allEls2[ei2].textContent);
          if (v2 > 0 && v2 < 300) { cadVal = v2; break; }
        }
      }
    }
    if (!cadVal) {
      var ser2 = new XMLSerializer().serializeToString(pt);
      var cadMatch = ser2.match(/<[^>]*:cad[^>]*>(\d+)<\/[^>]*:cad>/);
      if (!cadMatch) cadMatch = ser2.match(/<[Cc]adence[^>]*>(\d+)<\/[Cc]adence>/);
      if (cadMatch) cadVal = parseInt(cadMatch[1]);
    }
    if (cadVal && cadVal > 0 && cadVal < 300) cadVals.push(cadVal);
    // === Power (for cycling) ===
    var ser3 = new XMLSerializer().serializeToString(pt);
    var pwrMatch = ser3.match(/<[^>]*[Pp]ower[^>]*>(\d+)<\/[^>]*[Pp]ower>/);
    if (!pwrMatch) pwrMatch = ser3.match(/<[Ww]atts[^>]*>(\d+)<\/[Ww]atts>/);
    if (pwrMatch) {
      var pwrVal = parseInt(pwrMatch[1]);
      if (pwrVal > 0 && pwrVal < 3000) pwrVals.push(pwrVal);
    }
  });
  // Calculate distance from GPS coordinates
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
    result.hrAvg = Math.round(hrVals.reduce(function(a,b){return a+b;},0)/hrVals.length);
    result.hrMax = Math.max.apply(null, hrVals);
  }
  if (cadVals.length) result.cadenceAvg = Math.round(cadVals.reduce(function(a,b){return a+b;},0)/cadVals.length);
  if (pwrVals.length) result.power = Math.round(pwrVals.reduce(function(a,b){return a+b;},0)/pwrVals.length);
  if (elevGain > 0) result.elevation = Math.round(elevGain);
  if (result.distance > 0 && result.duration > 0) {
    result.speed = parseFloat((result.distance / (result.duration / 3600)).toFixed(2));
  }
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
