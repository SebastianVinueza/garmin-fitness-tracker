// GFT v4.0 - Strava-style UI + FIT parser + VO2Max + Projections + AI advice
const SUPABASE_URL = 'https://snmqnbxmjiivjyeevugd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNubXFuYnhtamlpdmp5ZWV2dWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTI0MDcsImV4cCI6MjA5ODI2ODQwN30.mktcJueyphNdvnpxc6fNf8zYMJJqkpToOa5TVUP5E9g';
let _db, currentUser = null, charts = {}, currentFile = null, parsedData = null;

document.addEventListener('DOMContentLoaded', async () => {
  _db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { session } } = await _db.auth.getSession();
  if (session) { currentUser = session.user; showMainApp(); }
  else showAuthScreen();
  _db.auth.onAuthStateChange((e, s) => {
    if (s) { currentUser = s.user; showMainApp(); }
    else { currentUser = null; showAuthScreen(); }
  });
  const rpe = document.getElementById('activity-rpe');
  if (rpe) rpe.addEventListener('input', () => document.getElementById('rpe-value').textContent = rpe.value);
  document.getElementById('daily-date-picker').value = new Date().toISOString().split('T')[0];
});

function showAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
  event.target.classList.add('active');
  document.getElementById(tab + '-form').classList.remove('hidden');
}
async function handleLogin(e) {
  e.preventDefault();
  var msg = document.getElementById('auth-message');
  msg.textContent = 'Iniciando...'; msg.className = 'message';
  var { error } = await _db.auth.signInWithPassword({ email: document.getElementById('login-email').value, password: document.getElementById('login-password').value });
  if (error) { msg.textContent = error.message; msg.className = 'message error'; }
}
async function handleRegister(e) {
  e.preventDefault();
  var msg = document.getElementById('auth-message');
  msg.textContent = 'Creando cuenta...'; msg.className = 'message';
  var { error } = await _db.auth.signUp({ email: document.getElementById('reg-email').value, password: document.getElementById('reg-password').value });
  if (error) { msg.textContent = error.message; msg.className = 'message error'; }
  else { msg.textContent = 'Revisa tu correo para confirmar.'; msg.className = 'message success'; }
}
async function handleLogout() { await _db.auth.signOut(); }
function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden','active');
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
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => { p.classList.add('hidden'); p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  var el = document.getElementById('page-' + page);
  if (el) { el.classList.remove('hidden'); el.classList.add('active'); }
  document.getElementById('page-title').textContent = { dashboard:'Dashboard', activities:'Actividades', daily:'Metricas Diarias', records:'Records', plans:'Planes', profile:'Perfil' }[page] || page;
  event.currentTarget.classList.add('active');
  if (page === 'activities') loadActivities();
  if (page === 'daily') loadDailyMetrics();
  if (page === 'records') loadRecords();
  if (page === 'plans') loadPlans();
  if (page === 'profile') loadProfilePage();
}
function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); }

async function loadDashboard() {
  if (!currentUser) return;
  var { data: acts } = await _db.from('activities').select('*').eq('user_id', currentUser.id).order('fecha_inicio', { ascending: false });
  if (!acts) acts = [];
  var totalDist = acts.reduce(function(s,a){ return s+(a.distancia_metros||0); }, 0)/1000;
  var totalCal = acts.reduce(function(s,a){ return s+(a.calorias||0); }, 0);
  var totalTime = acts.reduce(function(s,a){ return s+(a.duracion_segundos||0); }, 0);
  document.getElementById('total-activities').textContent = acts.length;
  document.getElementById('total-distance').textContent = totalDist.toFixed(1) + ' km';
  document.getElementById('total-calories').textContent = totalCal.toLocaleString();
  document.getElementById('total-time').textContent = formatDuration(totalTime, true);
  var rl = document.getElementById('recent-list');
  if (!acts.length) { rl.innerHTML = '<div class="empty-state"><p>No hay actividades aun</p></div>'; }
  else {
    rl.innerHTML = acts.slice(0,5).map(function(a) {
      var dist = ((a.distancia_metros||0)/1000).toFixed(2);
      var dur = formatDuration(a.duracion_segundos);
      var icon = sportIcon(a.tipo_actividad);
      return '<div class="activity-row strava-row" onclick="openActivityDetail(' + JSON.stringify(a.id) + ')">' +
        '<div class="activity-sport-icon">' + icon + '</div>' +
        '<div class="activity-info"><div class="activity-name">' + (a.nombre||'Sin nombre') + '</div>' +
        '<div class="activity-meta"><span>' + formatDate(a.fecha_inicio) + '</span><span class="sport-badge">' + (a.tipo_actividad||'general') + '</span></div></div>' +
        '<div class="activity-stats"><span class="stat-pill">' + dist + ' km</span><span class="stat-pill">' + dur + '</span>' +
        (a.frecuencia_cardiaca_promedio ? '<span class="stat-pill heart">' + a.frecuencia_cardiaca_promedio + ' bpm</span>' : '') +
        '</div></div>';
    }).join('');
  }
  renderWeeklyChart(acts);
  renderSportChart(acts);
}

function renderWeeklyChart(acts) {
  var ctx = document.getElementById('weekly-chart');
  if (!ctx) return;
  if (charts.weekly) charts.weekly.destroy();
  var weeks = {};
  acts.forEach(function(a) { var w = getWeekKey(new Date(a.fecha_inicio)); weeks[w] = (weeks[w]||0)+1; });
  var labels = Object.keys(weeks).slice(-8);
  charts.weekly = new Chart(ctx, {
    type:'bar', data:{ labels:labels.map(function(l){return 'Sem '+l.split('-W')[1];}),
    datasets:[{label:'Actividades',data:labels.map(function(k){return weeks[k];}),backgroundColor:'rgba(252,76,2,0.8)',borderRadius:4}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,0.1)'},ticks:{color:'#aaa'}},y:{grid:{color:'rgba(255,255,255,0.1)'},ticks:{color:'#aaa',stepSize:1}}}}
  });
}
function renderSportChart(acts) {
  var ctx = document.getElementById('sport-chart');
  if (!ctx) return;
  if (charts.sport) charts.sport.destroy();
  var sports = {};
  acts.forEach(function(a){ var s=a.tipo_actividad||'other'; sports[s]=(sports[s]||0)+1; });
  charts.sport = new Chart(ctx, {
    type:'doughnut', data:{ labels:Object.keys(sports).map(function(l){return l.charAt(0).toUpperCase()+l.slice(1);}),
    datasets:[{data:Object.values(sports),backgroundColor:['#FC4C02','#E8691C','#FF6B35','#FF8C42','#FFA05A','#FFB97A']}]},
    options:{responsive:true,plugins:{legend:{labels:{color:'#ccc',padding:10}}}}
  });
}

async function loadActivities() {
  if (!currentUser) return;
  var sport = document.getElementById('filter-sport')&&document.getElementById('filter-sport').value;
  var from = document.getElementById('filter-date-from')&&document.getElementById('filter-date-from').value;
  var to = document.getElementById('filter-date-to')&&document.getElementById('filter-date-to').value;
  var list = document.getElementById('activities-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  var query = _db.from('activities').select('*').eq('user_id', currentUser.id).order('fecha_inicio', {ascending:false});
  if (sport) query = query.eq('tipo_actividad', sport);
  if (from) query = query.gte('fecha_inicio', from);
  if (to) query = query.lte('fecha_inicio', to+'T23:59:59');
  var { data, error } = await query;
  if (error || !data || !data.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">&#127939;</div><p>No hay actividades. Sube tu primera!</p></div>';
    return;
  }
  list.innerHTML = data.map(function(a) {
    var dist = ((a.distancia_metros||0)/1000).toFixed(2);
    var dur = formatDuration(a.duracion_segundos);
    var pace = a.pace_promedio_seg_km ? formatPace(a.pace_promedio_seg_km)+'/km' : '';
    var spd = a.velocidad_maxima_ms ? ((a.distancia_metros||0)/1000/(a.duracion_segundos||1)*3600).toFixed(1)+' km/h' : '';
    var isCycling = a.tipo_actividad==='cycling';
    return '<div class="strava-activity-card">' +
      '<div class="sac-header"><div class="sac-sport-icon">' + sportIcon(a.tipo_actividad) + '</div>' +
      '<div class="sac-title-area"><div class="sac-name">' + (a.nombre||'Actividad') + '</div>' +
      '<div class="sac-meta">' + formatDate(a.fecha_inicio) + ' &bull; <span class="sac-type">' + (a.tipo_actividad||'general') + '</span></div></div>' +
      '<div class="sac-actions"><button class="btn-detail" onclick="openActivityDetail(' + JSON.stringify(a.id) + ')">Ver</button>' +
      '<button class="btn-delete" onclick="deleteActivity(' + JSON.stringify(a.id) + ', event)">&#128465;</button></div></div>' +
      '<div class="sac-stats">' +
      '<div class="sac-stat"><div class="sac-stat-val">' + dist + '</div><div class="sac-stat-lbl">km</div></div>' +
      '<div class="sac-stat"><div class="sac-stat-val">' + dur + '</div><div class="sac-stat-lbl">Tiempo</div></div>' +
      (a.frecuencia_cardiaca_promedio ? '<div class="sac-stat"><div class="sac-stat-val">' + a.frecuencia_cardiaca_promedio + '</div><div class="sac-stat-lbl">bpm avg</div></div>' : '') +
      (isCycling ? '<div class="sac-stat"><div class="sac-stat-val">' + spd + '</div><div class="sac-stat-lbl">Velocidad</div></div>' : '') +
      (!isCycling && pace ? '<div class="sac-stat"><div class="sac-stat-val">' + pace + '</div><div class="sac-stat-lbl">Ritmo</div></div>' : '') +
      (a.calorias ? '<div class="sac-stat"><div class="sac-stat-val">' + a.calorias + '</div><div class="sac-stat-lbl">kcal</div></div>' : '') +
      '</div></div>';
  }).join('');
}

async function deleteActivity(id, ev) {
  if (ev) ev.stopPropagation();
  if (!confirm('Eliminar esta actividad?')) return;
  var { error } = await _db.from('activities').delete().eq('id', id);
  if (!error) { showToast('Actividad eliminada', 'success'); loadActivities(); loadDashboard(); }
  else showToast('Error: ' + error.message, 'error');
}

async function openActivityDetail(id) {
  var { data: a } = await _db.from('activities').select('*').eq('id', id).single();
  if (!a) return;
  var modal = document.getElementById('activity-detail-modal');
  document.getElementById('detail-title').textContent = (a.nombre || 'Actividad') + ' - ' + (a.tipo_actividad||'');
  var isCyc = a.tipo_actividad === 'cycling';
  var isRun = a.tipo_actividad === 'running';
  var dist_km = (a.distancia_metros||0)/1000;
  var dur_s = a.duracion_segundos || 0;
  var avg_spd = dur_s>0 ? (dist_km/(dur_s/3600)) : 0;
  var pace = a.pace_promedio_seg_km || (dist_km>0&&dur_s>0 ? Math.round(dur_s/dist_km) : 0);
  var vo2 = calcVO2Max(a);
  var ai = generateAIAdvice(a);
  var projections = isRun ? buildRunProjections(a) : (isCyc ? buildCyclingProjections(a) : '');

  var html = '<div class="detail-strava">';
  // Header stats row (Strava style)
  html += '<div class="detail-main-stats">';
  html += makeStatBlock(dist_km.toFixed(2) + ' km', 'Distancia');
  html += makeStatBlock(formatDuration(dur_s), 'Tiempo');
  if (isCyc) html += makeStatBlock(avg_spd.toFixed(1) + ' km/h', 'Velocidad media');
  if (isRun && pace) html += makeStatBlock(formatPace(pace) + '/km', 'Ritmo medio');
  if (a.elevacion_ganada_m) html += makeStatBlock(a.elevacion_ganada_m.toFixed(0)+' m', 'Desnivel');
  if (a.calorias) html += makeStatBlock(a.calorias, 'Calorias');
  html += '</div>';

  // Secondary stats
  html += '<div class="detail-table"><table><thead><tr><th></th><th>Promedio</th><th>Maximo</th></tr></thead><tbody>';
  if (a.frecuencia_cardiaca_promedio||a.frecuencia_cardiaca_maxima) {
    html += '<tr><td>Ritmo cardiaco</td><td>' + (a.frecuencia_cardiaca_promedio||'--') + ' bpm</td><td>' + (a.frecuencia_cardiaca_maxima||'--') + ' bpm</td></tr>';
  }
  if (a.cadencia_promedio) html += '<tr><td>Cadencia</td><td>' + a.cadencia_promedio + (isRun?' spm':' rpm') + '</td><td>--</td></tr>';
  if (isCyc) {
    html += '<tr><td>Velocidad</td><td>' + avg_spd.toFixed(1) + ' km/h</td><td>' + (a.velocidad_maxima_ms ? (a.velocidad_maxima_ms*3.6).toFixed(1)+' km/h' : '--') + '</td></tr>';
  }
  if (a.training_stress_score) html += '<tr><td>Training Stress Score</td><td>' + a.training_stress_score + '</td><td>--</td></tr>';
  html += '</tbody></table></div>';

  // VO2Max
  if (vo2) {
    html += '<div class="detail-section"><h4>&#128170; VO2 Max estimado</h4>';
    html += '<div class="vo2-block"><span class="vo2-value">' + vo2.value + '</span><span class="vo2-unit">ml/kg/min</span>';
    html += '<span class="vo2-cat ' + vo2.catClass + '">' + vo2.category + '</span></div>';
    html += '<p class="vo2-desc">' + vo2.desc + '</p></div>';
  }

  // AI Advice
  html += '<div class="detail-section ai-section"><h4>&#129302; Analisis IA de tu actividad</h4><div class="ai-advice">' + ai + '</div></div>';

  // Projections
  if (projections) html += '<div class="detail-section"><h4>&#128200; Proyecciones</h4>' + projections + '</div>';

  // Delete button
  html += '<div class="detail-actions"><button class="btn-delete-detail" onclick="deleteActivity(' + JSON.stringify(a.id) + '); closeModal('activity-detail-modal');">&#128465; Eliminar actividad</button></div>';
  html += '</div>';

  document.getElementById('activity-detail-content').innerHTML = html;
  modal.classList.remove('hidden');
}

function makeStatBlock(val, lbl) {
  return '<div class="detail-stat-block"><div class="dsb-val">' + val + '</div><div class="dsb-lbl">' + lbl + '</div></div>';
}

// VO2Max calculation
function calcVO2Max(a) {
  var dist_km = (a.distancia_metros||0)/1000;
  var dur_min = (a.duracion_segundos||0)/60;
  if (dist_km < 1 || dur_min < 5) return null;
  var pace_min_km = dur_min / dist_km;
  // Jack Daniels formula: VO2 = -4.60 + 0.182258*(km/min) + 0.000104*(km/min)^2
  // Using simplified: VO2Max = 15 * (HRmax/HRrest) if we have HR
  var vo2;
  if (a.frecuencia_cardiaca_promedio && a.frecuencia_cardiaca_maxima) {
    // Uth-Sorensen formula
    var hrr = a.frecuencia_cardiaca_maxima / a.frecuencia_cardiaca_promedio;
    vo2 = 15.3 * hrr;
  } else if (a.tipo_actividad === 'running') {
    // Riegel/Daniels from pace
    var spd_m_min = dist_km * 1000 / dur_min;
    var pct = (-0.0004 * spd_m_min * spd_m_min + 0.4295 * spd_m_min - 4.604);
    var oxy = (0.000104 * spd_m_min * spd_m_min + 0.182258 * spd_m_min - 4.604);
    if (oxy > 0) vo2 = oxy / 0.8; else vo2 = null;
  } else {
    return null;
  }
  if (!vo2 || vo2 < 20 || vo2 > 90) return null;
  vo2 = Math.round(vo2 * 10) / 10;
  var cat, catClass, desc;
  if (vo2 >= 60) { cat='Excelente'; catClass='vo2-excellent'; desc='Nivel de atleta de elite. Capacidad cardiovascular excepcional.'; }
  else if (vo2 >= 50) { cat='Muy bueno'; catClass='vo2-great'; desc='Por encima del promedio. Muy buena forma fisica.'; }
  else if (vo2 >= 40) { cat='Bueno'; catClass='vo2-good'; desc='Nivel saludable. Puedes mejorar con entrenamiento constante.'; }
  else if (vo2 >= 30) { cat='Promedio'; catClass='vo2-avg'; desc='Nivel aceptable. Con entrenamiento de Z2 puedes mejorar significativamente.'; }
  else { cat='Por mejorar'; catClass='vo2-low'; desc='Aumenta la frecuencia de entrenamientos aerobicos de baja intensidad.'; }
  return { value: vo2, category: cat, catClass: catClass, desc: desc };
}

// AI Advice generator
function generateAIAdvice(a) {
  var tips = [];
  var dist_km = (a.distancia_metros||0)/1000;
  var dur_min = (a.duracion_segundos||0)/60;
  var avg_hr = a.frecuencia_cardiaca_promedio;
  var max_hr = a.frecuencia_cardiaca_maxima;
  var pace = a.pace_promedio_seg_km;
  var isCyc = a.tipo_actividad==='cycling';
  var isRun = a.tipo_actividad==='running';
  var rpe = a.percepcion_esfuerzo || 5;

  // Performance assessment
  if (dist_km > 10 && isRun) tips.push('<li><b>&#9989; Gran volumen:</b> Corriste ' + dist_km.toFixed(1) + ' km. Excelente para construir base aerobica.</li>');
  else if (dist_km > 30 && isCyc) tips.push('<li><b>&#9989; Buen volumen en bici:</b> ' + dist_km.toFixed(1) + ' km es una sesion solida de resistencia.</li>');

  // Heart rate zones
  if (avg_hr && max_hr) {
    var hrp = Math.round(avg_hr/max_hr*100);
    if (hrp < 65) tips.push('<li><b>&#128153; Zona 1-2 (Recuperacion/Base):</b> FC media al ' + hrp + '% del max. Ideal para entrenamiento de base aerobica y recuperacion activa.</li>');
    else if (hrp < 75) tips.push('<li><b>&#128154; Zona 2-3 (Aerobico):</b> FC al ' + hrp + '% del max. La zona ideal para mejorar el motor aerobico. Bien hecho!</li>');
    else if (hrp < 85) tips.push('<li><b>&#128161; Zona 3-4 (Umbral):</b> FC al ' + hrp + '% del max. Entrenamiento exigente. Asegurate de recuperar bien.</li>');
    else tips.push('<li><b>&#128308; Zona 5 (Maximo):</b> FC al ' + hrp + '% del max. Esfuerzo muy alto. Necesitas 48h de recuperacion.</li>');
  }

  // Pace analysis
  if (isRun && pace) {
    var paceMin = Math.floor(pace/60);
    var paceSec = pace%60;
    if (pace < 300) tips.push('<li><b>&#9889; Ritmo excelente:</b> ' + paceMin + ':' + String(paceSec).padStart(2,'0') + '/km. Ritmo de competicion.</li>');
    else if (pace < 400) tips.push('<li><b>&#128293; Buen ritmo:</b> ' + paceMin + ':' + String(paceSec).padStart(2,'0') + '/km. Ritmo de entrenamiento fuerte.</li>');
    else tips.push('<li><b>&#127939; Ritmo aerobico:</b> ' + paceMin + ':' + String(paceSec).padStart(2,'0') + '/km. Perfecto para rodajes largos.</li>');
  }

  // Recovery advice
  if (dur_min > 90 || rpe >= 8) tips.push('<li><b>&#128564; Recuperacion:</b> Actividad de alta carga. Duerme 8h, hidratate bien y considera un dia de descanso manana.</li>');
  else if (dur_min > 60) tips.push('<li><b>&#128170; Recuperacion moderada:</b> Buena sesion. 6-8h de sueno y hidratacion suficiente para recuperar al 100%.</li>');

  // Training advice
  if (isRun) tips.push('<li><b>&#128202; Mejora sugerida:</b> Incluye 1-2 sesiones de rodaje largo por semana en Zona 2 (conversacional) para mejorar tu base aerobica y bajar tu ritmo.</li>');
  if (isCyc) tips.push('<li><b>&#128202; Mejora sugerida:</b> Alterna sesiones Z2 largas con intervalos de 4-8 minutos al 90% de la FC maxima para aumentar potencia.</li>');

  if (!tips.length) tips.push('<li>Actividad registrada correctamente. Sigue entrenando con consistencia!</li>');
  return '<ul class="ai-tips">' + tips.join('') + '</ul>';
}

// Run projections using Riegel formula
function buildRunProjections(a) {
  var dist_km = (a.distancia_metros||0)/1000;
  var dur_s = a.duracion_segundos || 0;
  if (dist_km < 1 || dur_s < 60) return '';
  var races = [{d:5,name:'5 km'},{d:10,name:'10 km'},{d:15,name:'15 km'},{d:21.0975,name:'Media Maraton'},{d:42.195,name:'Maraton'}];
  var html = '<table class="proj-table"><thead><tr><th>Distancia</th><th>Tiempo proyectado</th><th>Ritmo</th></tr></thead><tbody>';
  races.forEach(function(r) {
    // Riegel: T2 = T1 * (D2/D1)^1.06
    var t2 = dur_s * Math.pow(r.d / dist_km, 1.06);
    var pace2 = Math.round(t2 / r.d);
    var highlight = '';
    // Mark achievable ones (within 3x current distance)
    if (r.d <= dist_km * 3) highlight = ' class="proj-highlight"';
    html += '<tr' + highlight + '><td>' + r.name + '</td><td>' + formatDuration(Math.round(t2)) + '</td><td>' + formatPace(pace2) + '/km</td></tr>';
  });
  html += '</tbody></table><p class="proj-note">* Proyecciones basadas en formula de Riegel. Requiere entrenamiento especifico para distancias mas largas.</p>';
  return html;
}

// Cycling projections
function buildCyclingProjections(a) {
  var dist_km = (a.distancia_metros||0)/1000;
  var dur_h = (a.duracion_segundos||0)/3600;
  if (dist_km < 5 || dur_h < 0.1) return '';
  var avg_spd = dist_km / dur_h;
  var goals = [{d:50,name:'50 km'},{d:100,name:'100 km (Fondo)'},{d:160,name:'160 km (Gran Fondo)'},{d:200,name:'200 km (Ultrafondo)'}];
  var html = '<table class="proj-table"><thead><tr><th>Distancia</th><th>Tiempo estimado</th><th>Velocidad</th></tr></thead><tbody>';
  goals.forEach(function(g) {
    // Assume slight speed reduction for longer distances (fatigue factor)
    var fatigue = Math.pow(0.97, Math.floor(g.d/50));
    var adj_spd = avg_spd * fatigue;
    var t_h = g.d / adj_spd;
    var t_s = Math.round(t_h * 3600);
    html += '<tr><td>' + g.name + '</td><td>' + formatDuration(t_s) + '</td><td>' + adj_spd.toFixed(1) + ' km/h</td></tr>';
  });
  html += '</tbody></table><p class="proj-note">* Proyecciones basadas en tu velocidad actual con factor de fatiga.</p>';
  return html;
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// FILE UPLOAD
function showUploadModal() { document.getElementById('upload-modal').classList.remove('hidden'); }
function handleDrop(e) { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); var f=e.dataTransfer.files[0]; if(f) processFile(f); }
function handleFileSelect(e) { var f=e.target.files[0]; if(f) processFile(f); }
function processFile(file) {
  currentFile = file; parsedData = null;
  var ext = file.name.split('.').pop().toLowerCase();
  if (!['gpx','fit','tcx','csv'].includes(ext)) { showToast('Formato no soportado','error'); return; }
  document.getElementById('file-name-display').textContent = file.name;
  document.getElementById('file-size-display').textContent = (file.size/1024).toFixed(1)+' KB';
  document.getElementById('activity-name').value = file.name.replace(/.[^.]+$/, '');
  document.getElementById('upload-area').classList.add('hidden');
  document.getElementById('upload-preview').classList.remove('hidden');
  var reader = new FileReader();
  if (ext==='gpx') { reader.onload=function(e){parsedData=parseGPX(e.target.result);}; reader.readAsText(file); }
  else if (ext==='tcx') { reader.onload=function(e){parsedData=parseTCX(e.target.result);}; reader.readAsText(file); }
  else if (ext==='fit') { reader.onload=function(e){parsedData=parseFIT(e.target.result);}; reader.readAsArrayBuffer(file); }
}
async function uploadActivity() {
  if (!currentFile || !currentUser) return;
  var name = document.getElementById('activity-name').value || currentFile.name;
  var type = document.getElementById('activity-type').value;
  var notes = document.getElementById('activity-notes').value;
  var rpe = parseInt(document.getElementById('activity-rpe').value)||5;
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-progress').classList.remove('hidden');
  document.getElementById('progress-fill').style.width = '30%';
  document.getElementById('upload-status').textContent = 'Procesando...';
  await new Promise(function(r){setTimeout(r,400);});
  var act = { user_id:currentUser.id, nombre:name, tipo_actividad:type, notas:notes, percepcion_esfuerzo:rpe, sincronizado_en:new Date().toISOString(), fecha_inicio:new Date().toISOString() };
  var p = parsedData;
  if (p) {
    if (p.totalDist>0) act.distancia_metros = parseFloat(p.totalDist.toFixed(2));
    if (p.duration>0) act.duracion_segundos = Math.round(p.duration);
    if (p.startTime) act.fecha_inicio = p.startTime;
    if (p.endTime) act.fecha_fin = p.endTime;
    if (p.avgHr) act.frecuencia_cardiaca_promedio = p.avgHr;
    if (p.maxHr) act.frecuencia_cardiaca_maxima = p.maxHr;
    if (p.elevGain>0) act.elevacion_ganada_m = p.elevGain;
    if (p.calories) act.calorias = p.calories;
    if (p.avgCadence) act.cadencia_promedio = p.avgCadence;
    if (p.maxSpeed>0) act.velocidad_maxima_ms = p.maxSpeed;
    if (act.duracion_segundos>0 && act.distancia_metros>0) act.pace_promedio_seg_km = Math.round(act.duracion_segundos/(act.distancia_metros/1000));
    if (p.sport && p.sport!=='other') act.tipo_actividad = p.sport;
  }
  document.getElementById('progress-fill').style.width = '70%';
  document.getElementById('upload-status').textContent = 'Guardando...';
  var { error } = await _db.from('activities').insert([act]);
  document.getElementById('progress-fill').style.width = '100%';
  if (error) { document.getElementById('upload-status').textContent = 'Error: '+error.message; showToast('Error al guardar','error'); }
  else { document.getElementById('upload-status').textContent = 'Guardado!'; showToast('Actividad subida!','success'); setTimeout(function(){ closeModal('upload-modal'); resetUpload(); loadActivities(); loadDashboard(); }, 1200); }
}
function resetUpload() {
  currentFile=null; parsedData=null;
  document.getElementById('upload-area').classList.remove('hidden');
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-progress').classList.add('hidden');
  document.getElementById('progress-fill').style.width='0';
  document.getElementById('file-input').value='';
}

// GPX PARSER
function parseGPX(xml) {
  var doc = new DOMParser().parseFromString(xml,'text/xml');
  var pts = doc.querySelectorAll('trkpt'), times=[], hrs=[], elevs=[], positions=[], totalDist=0, prev=null;
  pts.forEach(function(pt) {
    var lat=parseFloat(pt.getAttribute('lat')), lon=parseFloat(pt.getAttribute('lon'));
    var ele=parseFloat(pt.querySelector('ele')&&pt.querySelector('ele').textContent||0);
    var t=pt.querySelector('time')&&pt.querySelector('time').textContent;
    var hr=parseInt((pt.querySelector('hr,heartrate,value')&&pt.querySelector('hr,heartrate,value').textContent)||0);
    if (!isNaN(lat)&&!isNaN(lon)) { positions.push([lat,lon]); if(prev) totalDist+=haversine(prev[0],prev[1],lat,lon); prev=[lat,lon]; }
    if(t) times.push(new Date(t));
    if(ele>0) elevs.push(ele);
    if(hr>0) hrs.push(hr);
  });
  var dur=times.length>1?(times[times.length-1]-times[0])/1000:0;
  var eg=0; for(var i=1;i<elevs.length;i++) if(elevs[i]>elevs[i-1]) eg+=elevs[i]-elevs[i-1];
  return { totalDist:totalDist, duration:Math.round(dur), startTime:times[0]&&times[0].toISOString(), endTime:times[times.length-1]&&times[times.length-1].toISOString(),
    avgHr:hrs.length?Math.round(hrs.reduce(function(a,b){return a+b;},0)/hrs.length):null, maxHr:hrs.length?Math.max.apply(null,hrs):null, elevGain:parseFloat(eg.toFixed(1)),
    startCoords:positions[0]?{lat:positions[0][0],lng:positions[0][1]}:null };
}
// TCX PARSER
function parseTCX(xml) {
  var doc = new DOMParser().parseFromString(xml,'text/xml');
  var pts=doc.querySelectorAll('Trackpoint'), times=[],hrs=[],elevs=[],positions=[],totalDist=0;
  pts.forEach(function(tp) {
    var t=tp.querySelector('Time')&&tp.querySelector('Time').textContent;
    var hr=parseInt((tp.querySelector('HeartRateBpm Value')&&tp.querySelector('HeartRateBpm Value').textContent)||(tp.querySelector('HeartRateBpm')&&tp.querySelector('HeartRateBpm').textContent)||0);
    var ele=parseFloat((tp.querySelector('AltitudeMeters')&&tp.querySelector('AltitudeMeters').textContent)||0);
    var dist=parseFloat((tp.querySelector('DistanceMeters')&&tp.querySelector('DistanceMeters').textContent)||0);
    var lat=parseFloat(tp.querySelector('LatitudeDegrees')&&tp.querySelector('LatitudeDegrees').textContent);
    var lon=parseFloat(tp.querySelector('LongitudeDegrees')&&tp.querySelector('LongitudeDegrees').textContent);
    if(t) times.push(new Date(t));
    if(hr>0) hrs.push(hr);
    if(ele>0) elevs.push(ele);
    if(!isNaN(lat)&&!isNaN(lon)) positions.push([lat,lon]);
    if(dist>totalDist) totalDist=dist;
  });
  if(totalDist===0&&positions.length>1){var d=0,pv=null;positions.forEach(function(p){if(pv)d+=haversine(pv[0],pv[1],p[0],p[1]);pv=p;});totalDist=d;}
  var cal=parseInt((doc.querySelector('Calories')&&doc.querySelector('Calories').textContent)||0)||null;
  var dur=times.length>1?(times[times.length-1]-times[0])/1000:0;
  var eg=0; for(var i=1;i<elevs.length;i++) if(elevs[i]>elevs[i-1]) eg+=elevs[i]-elevs[i-1];
  return { totalDist:totalDist, duration:Math.round(dur), startTime:times[0]&&times[0].toISOString(), endTime:times[times.length-1]&&times[times.length-1].toISOString(),
    avgHr:hrs.length?Math.round(hrs.reduce(function(a,b){return a+b;},0)/hrs.length):null, maxHr:hrs.length?Math.max.apply(null,hrs):null, elevGain:parseFloat(eg.toFixed(1)), calories:cal };
}
// FIT BINARY PARSER
function parseFIT(ab) {
  var bytes=new Uint8Array(ab), view=new DataView(ab);
  if(bytes.length<14) return null;
  var hs=bytes[0];
  if(String.fromCharCode(bytes[8],bytes[9],bytes[10],bytes[11])!=='.FIT') return null;
  var defs={}, records=[], session=null, offset=hs, end=bytes.length-2;
  while(offset<end) {
    if(offset>=bytes.length) break;
    var rh=bytes[offset], isComp=(rh&0x80)!==0, isDef=!isComp&&(rh&0x40)!==0, lmn=isComp?(rh>>5)&3:rh&0x0F, hasDev=!isComp&&(rh&0x20)!==0;
    offset++;
    if(isDef) {
      offset++; var arch=bytes[offset++], le=arch===0;
      var gm=le?view.getUint16(offset,true):view.getUint16(offset,false); offset+=2;
      var nf=bytes[offset++], flds=[];
      for(var i=0;i<nf;i++){flds.push({fd:bytes[offset++],fs:bytes[offset++],bt:bytes[offset++]});}
      if(hasDev){var nd=bytes[offset++];for(var j=0;j<nd;j++) offset+=3;}
      defs[lmn]={gm:gm,le:le,flds:flds};
    } else {
      var def=defs[lmn]; if(!def){offset++;continue;}
      var rec={_gm:def.gm};
      def.flds.forEach(function(f){
        var bt=f.bt&0x9F, v=0;
        try{
          if(bt===0x00||bt===0x02||bt===0x0A) v=bytes[offset];
          else if(bt===0x01) v=view.getInt8(offset);
          else if(bt===0x83) v=def.le?view.getInt16(offset,true):view.getInt16(offset,false);
          else if(bt===0x84) v=def.le?view.getUint16(offset,true):view.getUint16(offset,false);
          else if(bt===0x85) v=def.le?view.getInt32(offset,true):view.getInt32(offset,false);
          else if(bt===0x86) v=def.le?view.getUint32(offset,true):view.getUint32(offset,false);
          else v=bytes[offset];
        }catch(e){v=0;}
        rec[f.fd]=v; offset+=f.fs;
      });
      if(def.gm===20) records.push(rec);
      if(def.gm===18) session=rec;
    }
  }
  var SPORTS={0:'other',1:'running',2:'cycling',5:'swimming',4:'hiking',11:'walking',10:'strength'};
  var SC=180/Math.pow(2,31);
  var dist=0,dur=0,cal=null,avgHr=null,maxHr=null,cad=null,maxSpd=0,elev=0,st=null,et=null,sp=0;
  if(session){
    if(session[9]!==undefined&&session[9]<0xFFFFFFFF) dist=session[9]/100;
    if(session[7]!==undefined&&session[7]<0xFFFFFFFF) dur=session[7]/1000;
    if(session[11]!==undefined&&session[11]<0xFFFF) cal=session[11];
    if(session[14]!==undefined&&session[14]<0xFF) avgHr=session[14];
    if(session[15]!==undefined&&session[15]<0xFF) maxHr=session[15];
    if(session[16]!==undefined&&session[16]<0xFF) cad=session[16];
    if(session[19]!==undefined&&session[19]<0xFFFF) maxSpd=session[19]/1000;
    if(session[22]!==undefined&&session[22]<0xFFFF) elev=session[22];
    if(session[5]!==undefined) sp=session[5];
    if(session[2]!==undefined&&session[2]<0xFFFFFFFF){st=new Date((session[2]+631065600)*1000).toISOString();if(dur)et=new Date((session[2]+631065600+Math.round(dur))*1000).toISOString();}
  }
  var sc=null, rHrs=[], rLats=[], rLons=[];
  records.forEach(function(r){
    var lat=r[0],lon=r[1];
    if(lat!==undefined&&lon!==undefined&&lat!==0x7FFFFFFF&&lon!==0x7FFFFFFF&&lat!==0){
      var ld=lat*SC,lo2=lon*SC; if(!sc) sc={lat:ld,lng:lo2}; rLats.push(ld); rLons.push(lo2);
    }
    if(r[3]!==undefined&&r[3]>0&&r[3]<0xFF) rHrs.push(r[3]);
    if(r[253]!==undefined&&r[253]<0xFFFFFFFF&&!st) st=new Date((r[253]+631065600)*1000).toISOString();
  });
  if(!dist&&rLats.length>1){var d2=0;for(var k=1;k<rLats.length;k++) d2+=haversine(rLats[k-1],rLons[k-1],rLats[k],rLons[k]);dist=d2;}
  if(!avgHr&&rHrs.length) avgHr=Math.round(rHrs.reduce(function(a,b){return a+b;},0)/rHrs.length);
  if(!maxHr&&rHrs.length) maxHr=Math.max.apply(null,rHrs);
  return {totalDist:dist,duration:Math.round(dur),startTime:st,endTime:et,avgHr:avgHr,maxHr:maxHr,avgCadence:cad,maxSpeed:maxSpd,elevGain:elev,calories:cal,sport:SPORTS[sp]||'other'};
}
function haversine(la1,lo1,la2,lo2){
  var R=6371000,p1=la1*Math.PI/180,p2=la2*Math.PI/180,dp=(la2-la1)*Math.PI/180,dl=(lo2-lo1)*Math.PI/180;
  var a=Math.sin(dp/2)*Math.sin(dp/2)+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)*Math.sin(dl/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// DAILY METRICS
async function loadDailyMetrics() {
  if (!currentUser) return;
  var date=document.getElementById('daily-date-picker').value||new Date().toISOString().split('T')[0];
  var {data}=await _db.from('daily_metrics').select('*').eq('user_id',currentUser.id).eq('fecha',date).single();
  var set=function(id,val,sfx){var el=document.getElementById(id);if(el)el.textContent=val?val+(sfx||''):'--';};
  set('d-steps',data&&data.pasos&&data.pasos.toLocaleString());
  set('d-hr',data&&data.frecuencia_cardiaca_reposo,' bpm');
  set('d-battery',data&&data.body_battery_max);
  set('d-sleep',data&&data.horas_sueno&&data.horas_sueno.toFixed(1),' h');
  set('d-stress',data&&data.nivel_estres);
  set('d-hrv',data&&data.variabilidad_fc_hrv,' ms');
  set('d-readiness',data&&data.training_readiness);
  set('d-spo2',data&&data.spo2_promedio&&data.spo2_promedio.toFixed(1),'%');
  var sd=new Date(); sd.setDate(sd.getDate()-7);
  var {data:wd}=await _db.from('daily_metrics').select('*').eq('user_id',currentUser.id).gte('fecha',sd.toISOString().split('T')[0]).order('fecha');
  renderWellnessChart(wd||[]);
}
function renderWellnessChart(data) {
  var ctx=document.getElementById('wellness-chart'); if(!ctx) return;
  if(charts.wellness) charts.wellness.destroy();
  charts.wellness=new Chart(ctx,{type:'line',data:{labels:data.map(function(d){return d.fecha&&d.fecha.substring(5);}),
    datasets:[{label:'Body Battery',data:data.map(function(d){return d.body_battery_max;}),borderColor:'#FC4C02',tension:0.4,fill:false},
    {label:'Readiness',data:data.map(function(d){return d.training_readiness;}),borderColor:'#10B981',tension:0.4,fill:false},
    {label:'Estres',data:data.map(function(d){return d.nivel_estres;}),borderColor:'#EF4444',tension:0.4,fill:false}]},
    options:{responsive:true,scales:{x:{grid:{color:'rgba(255,255,255,0.1)'},ticks:{color:'#aaa'}},y:{grid:{color:'rgba(255,255,255,0.1)'},ticks:{color:'#aaa'},min:0,max:100}},plugins:{legend:{labels:{color:'#ccc'}}}}});
}
// RECORDS
async function loadRecords() {
  if (!currentUser) return;
  var {data:acts}=await _db.from('activities').select('*').eq('user_id',currentUser.id).eq('tipo_actividad','running').order('pace_promedio_seg_km',{ascending:true});
  var findBest=function(mn,mx){return acts&&acts.find(function(a){return a.distancia_metros>=mn&&a.distancia_metros<=mx&&a.duracion_segundos;});};
  var ft=function(s){if(!s)return '--:--';var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;return h>0?h+':'+String(m).padStart(2,'0')+':'+String(sc).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(sc).padStart(2,'0');};
  var p5=findBest(4900,5100),p10=findBest(9900,10100),ph=findBest(21000,21200),pf=findBest(42100,42300);
  document.getElementById('pr-5k').textContent=p5?ft(p5.duracion_segundos):'--:--';
  document.getElementById('pr-10k').textContent=p10?ft(p10.duracion_segundos):'--:--';
  document.getElementById('pr-half').textContent=ph?ft(ph.duracion_segundos):'--:--';
  document.getElementById('pr-full').textContent=pf?ft(pf.duracion_segundos):'--:--';
  var {data:all}=await _db.from('activities').select('distancia_metros,velocidad_maxima_ms').eq('user_id',currentUser.id);
  if(all&&all.length){document.getElementById('pr-longest').textContent=(Math.max.apply(null,all.map(function(a){return a.distancia_metros||0;}))/1000).toFixed(2)+' km';document.getElementById('pr-speed').textContent=(Math.max.apply(null,all.map(function(a){return a.velocidad_maxima_ms||0;}))*3.6).toFixed(1)+' km/h';}
}
// PLANS
async function loadPlans() {
  if(!currentUser) return;
  var {data}=await _db.from('training_plans').select('*').eq('user_id',currentUser.id).order('creado_en',{ascending:false});
  var list=document.getElementById('plans-list');
  if(!data||!data.length){list.innerHTML='<div class="empty-state"><p>No tienes planes. Crea uno!</p></div>';return;}
  list.innerHTML=data.map(function(p){
    return '<div class="plan-card"><div><h4>'+p.nombre+'</h4><p style="color:#aaa;font-size:0.85rem;">'+( p.descripcion||'')+'</p><p style="color:#888;font-size:0.8rem;">'+(p.semanas||0)+' semanas</p></div>'+
    '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;"><span class="plan-badge">'+(p.deporte||'General')+'</span>'+
    '<button class="btn-delete" onclick="deletePlan('+JSON.stringify(p.id)+')">&#128465;</button></div></div>';
  }).join('');
}
function showCreatePlanModal(){document.getElementById('plan-modal').classList.remove('hidden');}
async function createPlan(e) {
  e.preventDefault();
  var pd={user_id:currentUser.id,nombre:document.getElementById('plan-name').value,descripcion:document.getElementById('plan-desc').value,deporte:document.getElementById('plan-sport').value,nivel:document.getElementById('plan-level').value,semanas:parseInt(document.getElementById('plan-weeks').value)||null,fecha_inicio:document.getElementById('plan-start').value,activo:true};
  var {error}=await _db.from('training_plans').insert([pd]);
  if(!error){closeModal('plan-modal');loadPlans();showToast('Plan creado!','success');e.target.reset();}else showToast('Error: '+error.message,'error');
}
async function deletePlan(id){if(!confirm('Eliminar plan?'))return;await _db.from('training_plans').delete().eq('id',id);loadPlans();showToast('Plan eliminado','success');}
// PROFILE
async function loadProfile(){if(!currentUser)return;var{data}=await _db.from('user_profile').select('*').eq('user_id',currentUser.id).limit(1).single();if(data)document.getElementById('user-name-display').textContent=data.nombre||'Usuario';}
async function loadProfilePage(){if(!currentUser)return;var{data:p}=await _db.from('user_profile').select('*').eq('user_id',currentUser.id).limit(1).single();if(p){document.getElementById('profile-name').textContent=p.nombre||'Sebastian';var age=new Date().getFullYear()-new Date(p.fecha_nacimiento).getFullYear();document.getElementById('p-age').textContent=age+' anos';document.getElementById('p-weight').textContent=p.peso_kg+' kg';document.getElementById('p-height').textContent=(p.estatura_cm/100).toFixed(2)+' m';var bmi=p.peso_kg/Math.pow(p.estatura_cm/100,2);document.getElementById('p-bmi').textContent=bmi.toFixed(1);document.getElementById('p-maxhr').textContent=(220-age)+' bpm';document.getElementById('p-resthr').textContent=(p.frecuencia_cardiaca_reposo||60)+' bpm';}}
function connectGarmin(){showToast('Integracion Garmin proximamente!','success');}
// UTILS
function sportIcon(t){return {running:'&#127939;',cycling:'&#128692;',swimming:'&#127944;',hiking:'&#129374;',walking:'&#128694;',strength:'&#128170;',yoga:'&#129496;',triathlon:'&#127885;'}[t]||'&#127947;';}
function formatDuration(s,compact){if(!s)return '--';var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;if(compact)return h>0?h+'h '+m+'m':m+'m';return h>0?h+':'+String(m).padStart(2,'0')+':'+String(sc).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(sc).padStart(2,'0');}
function formatDate(iso){if(!iso)return '--';return new Date(iso).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});}
function formatPace(s){if(!s)return '--';return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function getWeekKey(d){var u=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));var dn=u.getUTCDay()||7;u.setUTCDate(u.getUTCDate()+4-dn);var ys=new Date(Date.UTC(u.getUTCFullYear(),0,1));return u.getUTCFullYear()+'-W'+String(Math.ceil((((u-ys)/86400000)+1)/7)).padStart(2,'0');}
function showToast(msg,type){var t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(type||'success');setTimeout(function(){t.className='toast hidden';},3500);}
