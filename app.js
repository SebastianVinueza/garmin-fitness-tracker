// GFT v6.0 - Garmin Fitness Tracker - Better than Strava Premium
const SUPABASE_URL = 'https://snmqnbxmjiivjyeevugd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNubXFuYnhtamlpdmp5ZWV2dWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTI0MDcsImV4cCI6MjA5ODI2ODQwN30.mktcJueyphNdvnpxc6fNf8zYMJJqkpToOa5TVUP5E9g';

// All Garmin sport types
const SPORT_CONFIG = {
  running:    { icon: '🏃', label: 'Carrera',       color: '#FC4C02', unit: 'pace' },
  cycling:    { icon: '🚴', label: 'Ciclismo',      color: '#0066FF', unit: 'speed' },
  swimming:   { icon: '🏊', label: 'Natacion',      color: '#00B4D8', unit: 'pace' },
  hiking:     { icon: '🥾', label: 'Senderismo',    color: '#10B981', unit: 'pace' },
  walking:    { icon: '🚶', label: 'Caminata',      color: '#84CC16', unit: 'pace' },
  strength:   { icon: '💪', label: 'Fuerza',        color: '#8B5CF6', unit: 'none' },
  yoga:       { icon: '🧘', label: 'Yoga',          color: '#EC4899', unit: 'none' },
  triathlon:  { icon: '🏅', label: 'Triatlon',      color: '#F59E0B', unit: 'pace' },
  indoor_cycling: { icon: '🚴', label: 'Ciclismo Indoor', color: '#0066FF', unit: 'speed' },
  virtual_ride:   { icon: '🖥️', label: 'Ciclismo Virtual', color: '#3B82F6', unit: 'speed' },
  trail_running:  { icon: '🏔️', label: 'Trail',     color: '#D97706', unit: 'pace' },
  open_water:     { icon: '🌊', label: 'Aguas Abiertas', color: '#0EA5E9', unit: 'pace' },
  rowing:     { icon: '🚣', label: 'Remo',          color: '#6366F1', unit: 'pace' },
  skiing:     { icon: '⛷️', label: 'Esqui',         color: '#60A5FA', unit: 'speed' },
  crossfit:   { icon: '🏋️', label: 'CrossFit',      color: '#EF4444', unit: 'none' },
  other:      { icon: '⚡', label: 'Otro',           color: '#6B7280', unit: 'none' }
};

// FIT sport code mapping (extended Garmin codes)
const FIT_SPORT_MAP = {
  0:'other', 1:'running', 2:'cycling', 3:'transition', 4:'fitness_equipment',
  5:'swimming', 6:'basketball', 7:'soccer', 8:'tennis', 9:'american_football',
  10:'training', 11:'walking', 12:'cross_country_skiing', 13:'alpine_skiing',
  14:'snowboarding', 15:'rowing', 16:'mountaineering', 17:'hiking',
  18:'multisport', 19:'paddling', 24:'swimming', 25:'crossfit',
  26:'indoor_rowing', 27:'elliptical', 28:'stand_up_paddleboarding',
  29:'yoga', 34:'inline_skating', 35:'rock_climbing', 37:'sailing',
  38:'ice_skating', 40:'kitesurfing', 44:'wakeboarding', 53:'trail_running',
  56:'virtual_activity', 63:'e_biking'
};

let _db, currentUser = null, charts = {}, currentFile = null, parsedActivityData = null;

document.addEventListener('DOMContentLoaded', async () => {
  _db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  var r = await _db.auth.getSession();
  var session = r.data.session;
  if (session) { currentUser = session.user; showMainApp(); }
  else { showAuthScreen(); }
  _db.auth.onAuthStateChange(function(ev, sess) {
    if (sess) { currentUser = sess.user; showMainApp(); }
    else { currentUser = null; showAuthScreen(); }
  });
  var rpe = document.getElementById('activity-rpe');
  if (rpe) rpe.addEventListener('input', function() { document.getElementById('rpe-value').textContent = rpe.value; });
  var dp = document.getElementById('daily-date-picker');
  if (dp) dp.value = new Date().toISOString().split('T')[0];
});

// AUTH
function showAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('.auth-form').forEach(function(f){f.classList.add('hidden');});
  event.target.classList.add('active');
  document.getElementById(tab+'-form').classList.remove('hidden');
}
async function handleLogin(e) {
  e.preventDefault();
  var msg=document.getElementById('auth-message');
  msg.textContent='Iniciando...'; msg.className='message';
  var r=await _db.auth.signInWithPassword({email:document.getElementById('login-email').value,password:document.getElementById('login-password').value});
  if(r.error){msg.textContent=r.error.message;msg.className='message error';}
}
async function handleRegister(e) {
  e.preventDefault();
  var msg=document.getElementById('auth-message');
  msg.textContent='Creando cuenta...'; msg.className='message';
  var r=await _db.auth.signUp({email:document.getElementById('reg-email').value,password:document.getElementById('reg-password').value});
  if(r.error){msg.textContent=r.error.message;msg.className='message error';}
  else{msg.textContent='Cuenta creada. Revisa tu correo.';msg.className='message success';}
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
  document.getElementById('main-app').style.display='flex';
  await loadProfile();
  await loadDashboard();
}

// NAV
function showPage(page) {
  document.querySelectorAll('.page').forEach(function(p){p.classList.add('hidden');p.classList.remove('active');});
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
  var el=document.getElementById('page-'+page);
  if(el){el.classList.remove('hidden');el.classList.add('active');}
  var titles={dashboard:'Dashboard',activities:'Mis Actividades',daily:'Metricas Diarias',records:'Records Personales',plans:'Planes de Entrenamiento',profile:'Mi Perfil'};
  var t=document.getElementById('page-title');
  if(t) t.textContent=titles[page]||page;
  if(event&&event.currentTarget) event.currentTarget.classList.add('active');
  if(page==='activities') loadActivities();
  if(page==='daily') loadDailyMetrics();
  if(page==='records') loadRecords();
  if(page==='plans') loadPlans();
  if(page==='profile') loadProfilePage();
}
function toggleSidebar(){document.querySelector('.sidebar').classList.toggle('open');}

// DASHBOARD
async function loadDashboard() {
  if(!currentUser) return;
  var r=await _db.from('activities').select('*').eq('user_id',currentUser.id).order('fecha_inicio',{ascending:false});
  var acts=r.data||[];
  var totalDist=acts.reduce(function(s,a){return s+(a.distancia_metros||0);},0)/1000;
  var totalCal=acts.reduce(function(s,a){return s+(a.calorias||0);},0);
  var totalTime=acts.reduce(function(s,a){return s+(a.duracion_segundos||0);},0);
  var avgHr=acts.filter(function(a){return a.frecuencia_cardiaca_promedio;}).reduce(function(s,a,i,arr){return s+a.frecuencia_cardiaca_promedio/arr.length;},0);

  function setText(id,val){var el=document.getElementById(id);if(el)el.textContent=val;}
  setText('total-activities',acts.length);
  setText('total-distance',totalDist.toFixed(1)+' km');
  setText('total-calories',totalCal.toLocaleString());
  setText('total-time',formatDuration(totalTime,true));
  setText('avg-hr',avgHr>0?Math.round(avgHr)+' bpm':'--');

  // Training load (CTL/ATL)
  var ctl=calcCTL(acts), atl=calcATL(acts), tsb=ctl-atl;
  setText('stat-ctl',ctl.toFixed(0));
  setText('stat-atl',atl.toFixed(0));
  setText('stat-tsb',(tsb>=0?'+':'')+tsb.toFixed(0));
  var tsbEl=document.getElementById('stat-tsb');
  if(tsbEl) tsbEl.style.color=tsb>5?'#10B981':tsb<-10?'#EF4444':'#F59E0B';

  // Recent activities
  var rl=document.getElementById('recent-list');
  if(rl){
    if(acts.length===0){
      rl.innerHTML='<div class="empty-state"><p>Sube tu primera actividad GPX/FIT/TCX</p></div>';
    } else {
      rl.innerHTML=acts.slice(0,6).map(function(a){
        var sp=getSportConfig(a.tipo_actividad);
        var id=JSON.stringify(String(a.id));
        return '<div class="activity-row-dash" onclick="openDetail('+id+')" style="cursor:pointer;">'
          +'<div class="act-sport-dot" style="background:'+sp.color+'">'+sp.icon+'</div>'
          +'<div class="act-row-info">'
          +'<div class="act-row-name">'+(a.nombre||'Actividad')+'</div>'
          +'<div class="act-row-meta">'+formatDate(a.fecha_inicio)+' &bull; '+sp.label+'</div>'
          +'</div>'
          +'<div class="act-row-stats">'
          +'<span>'+((a.distancia_metros||0)/1000).toFixed(2)+' km</span>'
          +'<span>'+formatDuration(a.duracion_segundos)+'</span>'
          +'</div></div>';
      }).join('');
    }
  }
  renderWeeklyChart(acts);
  renderSportChart(acts);
  renderProgressChart(acts);
}

// Chronic Training Load (42 day EMA)
function calcCTL(acts) {
  if(!acts.length) return 0;
  var ema=0, k=2/43;
  var sorted=acts.slice().sort(function(a,b){return new Date(a.fecha_inicio)-new Date(b.fecha_inicio);});
  sorted.forEach(function(a){ var tss=calcTSS(a); ema=tss*k+ema*(1-k); });
  return ema;
}
// Acute Training Load (7 day EMA)
function calcATL(acts) {
  if(!acts.length) return 0;
  var ema=0, k=2/8;
  var sorted=acts.slice().sort(function(a,b){return new Date(a.fecha_inicio)-new Date(b.fecha_inicio);});
  sorted.forEach(function(a){ var tss=calcTSS(a); ema=tss*k+ema*(1-k); });
  return ema;
}
// Training Stress Score
function calcTSS(a) {
  if(!a.duracion_segundos||!a.distancia_metros) return 0;
  if(a.frecuencia_cardiaca_promedio&&a.frecuencia_cardiaca_maxima){
    var hrr=(a.frecuencia_cardiaca_promedio-60)/(a.frecuencia_cardiaca_maxima-60);
    return (a.duracion_segundos/3600)*hrr*hrr*100;
  }
  return (a.duracion_segundos/3600)*40;
}

function renderWeeklyChart(acts) {
  var ctx=document.getElementById('weekly-chart'); if(!ctx) return;
  if(charts.weekly) charts.weekly.destroy();
  var weeks={};
  acts.forEach(function(a){
    var d=new Date(a.fecha_inicio), wk=getWeekKey(d);
    if(!weeks[wk]) weeks[wk]={dist:0,count:0};
    weeks[wk].dist+=(a.distancia_metros||0)/1000;
    weeks[wk].count++;
  });
  var labels=Object.keys(weeks).slice(-10);
  charts.weekly=new Chart(ctx,{
    type:'bar',
    data:{labels:labels.map(function(l){return 'S'+l.split('-W')[1];}),
      datasets:[{label:'km',data:labels.map(function(k){return weeks[k].dist.toFixed(1);}),
        backgroundColor:'rgba(252,76,2,0.8)',borderRadius:6,borderSkipped:false}]},
    options:{responsive:true,plugins:{legend:{display:false}},
      scales:{x:{grid:{color:'#1e293b'},ticks:{color:'#64748b'}},
              y:{grid:{color:'#1e293b'},ticks:{color:'#64748b',callback:function(v){return v+'km';}}}}}
  });
}

function renderSportChart(acts) {
  var ctx=document.getElementById('sport-chart'); if(!ctx) return;
  if(charts.sport) charts.sport.destroy();
  var sports={};
  acts.forEach(function(a){var s=a.tipo_actividad||'other'; sports[s]=(sports[s]||0)+1;});
  var labels=Object.keys(sports);
  var colors=labels.map(function(s){return getSportConfig(s).color;});
  charts.sport=new Chart(ctx,{
    type:'doughnut',
    data:{labels:labels.map(function(s){return getSportConfig(s).label;}),
      datasets:[{data:Object.values(sports),backgroundColor:colors,borderWidth:0}]},
    options:{responsive:true,cutout:'65%',
      plugins:{legend:{labels:{color:'#94A3B8',padding:16,font:{size:12}}}}}
  });
}

function renderProgressChart(acts) {
  var ctx=document.getElementById('progress-chart'); if(!ctx) return;
  if(charts.progress) charts.progress.destroy();
  var monthly={};
  acts.forEach(function(a){
    var d=new Date(a.fecha_inicio);
    var key=d.getFullYear()+'-'+(d.getMonth()+1);
    if(!monthly[key]) monthly[key]={dist:0,time:0};
    monthly[key].dist+=(a.distancia_metros||0)/1000;
    monthly[key].time+=(a.duracion_segundos||0)/3600;
  });
  var keys=Object.keys(monthly).sort().slice(-6);
  charts.progress=new Chart(ctx,{
    type:'line',
    data:{labels:keys.map(function(k){var p=k.split('-');return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(p[1])-1]+' '+p[0];}),
      datasets:[
        {label:'Distancia km',data:keys.map(function(k){return monthly[k].dist.toFixed(1);}),borderColor:'#FC4C02',backgroundColor:'rgba(252,76,2,0.1)',fill:true,tension:0.4,yAxisID:'y'},
        {label:'Horas',data:keys.map(function(k){return monthly[k].time.toFixed(1);}),borderColor:'#3B82F6',backgroundColor:'rgba(59,130,246,0.1)',fill:true,tension:0.4,yAxisID:'y1'}
      ]},
    options:{responsive:true,
      plugins:{legend:{labels:{color:'#94A3B8'}}},
      scales:{
        x:{grid:{color:'#1e293b'},ticks:{color:'#64748b'}},
        y:{grid:{color:'#1e293b'},ticks:{color:'#64748b'},position:'left'},
        y1:{grid:{display:false},ticks:{color:'#3B82F6'},position:'right'}
      }}
  });
}

// ACTIVITIES - Full Garmin sport support
async function loadActivities() {
  if(!currentUser) return;
  var sportEl=document.getElementById('filter-sport');
  var fromEl=document.getElementById('filter-date-from');
  var toEl=document.getElementById('filter-date-to');
  var sport=sportEl?sportEl.value:'';
  var from=fromEl?fromEl.value:'';
  var to=toEl?toEl.value:'';
  var list=document.getElementById('activities-list');
  if(!list) return;
  list.innerHTML='<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';
  var query=_db.from('activities').select('*').eq('user_id',currentUser.id).order('fecha_inicio',{ascending:false});
  if(sport) query=query.eq('tipo_actividad',sport);
  if(from) query=query.gte('fecha_inicio',from);
  if(to) query=query.lte('fecha_inicio',to+'T23:59:59');
  var r=await query;
  var data=r.data||[];
  if(data.length===0){
    list.innerHTML='<div class="empty-state"><div class="empty-icon">🏃</div><h3>Sin actividades</h3><p>Sube tu primer archivo .FIT, .GPX o .TCX desde Garmin</p></div>';
    return;
  }
  list.innerHTML=data.map(function(a){
    var sp=getSportConfig(a.tipo_actividad);
    var id=JSON.stringify(String(a.id));
    var dist=((a.distancia_metros||0)/1000).toFixed(2);
    var dur=formatDuration(a.duracion_segundos);
    var fc=a.frecuencia_cardiaca_promedio||'--';
    var kcal=a.calorias||'--';
    var mainStat='';
    if(sp.unit==='pace'&&a.pace_promedio_seg_km){
      mainStat='<div class="act-stat"><div class="act-stat-val">'+formatPace(a.pace_promedio_seg_km)+'</div><div class="act-stat-lbl">Ritmo/km</div></div>';
    } else if(sp.unit==='speed'&&a.velocidad_maxima_ms){
      mainStat='<div class="act-stat"><div class="act-stat-val">'+(a.velocidad_maxima_ms*3.6).toFixed(1)+'</div><div class="act-stat-lbl">km/h max</div></div>';
    }
    return '<div class="activity-card" style="border-left:4px solid '+sp.color+';">'
      +'<div class="activity-card-top">'
      +'<div class="sport-icon-circle" style="background:'+sp.color+'20;color:'+sp.color+'">'+sp.icon+'</div>'
      +'<div class="act-title-block" onclick="openDetail('+id+')" style="cursor:pointer;flex:1;">'
      +'<div class="act-name">'+(a.nombre||sp.label)+'</div>'
      +'<div class="act-meta">'+formatDate(a.fecha_inicio)+' &bull; <span class="sport-pill" style="background:'+sp.color+'20;color:'+sp.color+'">'+sp.label+'</span></div>'
      +'</div>'
      +'<div class="act-card-actions">'
      +'<button class="btn-ver" onclick="openDetail('+id+')">Ver</button>'
      +'<button class="btn-del" onclick="deleteActivity('+id+');event.stopPropagation();">🗑</button>'
      +'</div></div>'
      +'<div class="act-stats-row">'
      +'<div class="act-stat"><div class="act-stat-val">'+dist+'</div><div class="act-stat-lbl">km</div></div>'
      +'<div class="act-stat"><div class="act-stat-val">'+dur+'</div><div class="act-stat-lbl">Tiempo</div></div>'
      +'<div class="act-stat"><div class="act-stat-val">'+fc+'</div><div class="act-stat-lbl">FC avg</div></div>'
      +mainStat
      +'<div class="act-stat"><div class="act-stat-val">'+kcal+'</div><div class="act-stat-lbl">kcal</div></div>'
      +'</div></div>';
  }).join('');
}

// ACTIVITY DETAIL - Advanced metrics better than Strava Premium
function openDetail(id) { setTimeout(function(){showActivityDetail(id);},10); }

async function showActivityDetail(id) {
  if(!_db||!id) return;
  var r=await _db.from('activities').select('*').eq('id',id).single();
  if(r.error||!r.data){showToast('Error cargando actividad','error');return;}
  var a=r.data;
  window._currentDetailId=id;
  var sp=getSportConfig(a.tipo_actividad);
  var modal=document.getElementById('activity-detail-modal');
  var titleEl=document.getElementById('detail-title');
  if(titleEl) titleEl.textContent=a.nombre||sp.label;

  var dist=((a.distancia_metros||0)/1000).toFixed(2);
  var dur=formatDuration(a.duracion_segundos);
  var isCycling=a.tipo_actividad==='cycling'||a.tipo_actividad==='indoor_cycling'||a.tipo_actividad==='virtual_ride';
  var isSwim=a.tipo_actividad==='swimming'||a.tipo_actividad==='open_water';

  // Advanced calculations
  var vo2=calcVO2Max(a);
  var tss=calcTSS(a);
  var aerobicEff=calcAerobicEfficiency(a);
  var recTime=calcRecoveryTime(a);
  var hrDrift=calcHRDrift(a);
  var intensityFactor=calcIntensityFactor(a);

  // Header with sport color
  var html='<div class="detail-header" style="background:linear-gradient(135deg,'+sp.color+'22,'+sp.color+'11);border-left:4px solid '+sp.color+';padding:16px;border-radius:8px;margin-bottom:16px;">'
    +'<div style="display:flex;align-items:center;gap:12px;">'
    +'<span style="font-size:2rem;">'+sp.icon+'</span>'
    +'<div><div style="font-size:1.1rem;font-weight:700;color:#F1F5F9;">'+(a.nombre||sp.label)+'</div>'
    +'<div style="color:#94A3B8;font-size:0.85rem;">'+formatDate(a.fecha_inicio)+' &bull; '+sp.label+'</div></div>'
    +'</div></div>';

  // Primary stats grid
  html+='<div class="detail-stats-grid">';
  html+='<div class="detail-stat"><div class="dsv">'+dist+' km</div><div class="dsl">Distancia</div></div>';
  html+='<div class="detail-stat"><div class="dsv">'+dur+'</div><div class="dsl">Tiempo</div></div>';
  if(!isSwim&&!isCycling&&a.pace_promedio_seg_km){
    html+='<div class="detail-stat"><div class="dsv">'+formatPace(a.pace_promedio_seg_km)+'/km</div><div class="dsl">Ritmo avg</div></div>';
  }
  if(isCycling&&a.velocidad_maxima_ms){
    html+='<div class="detail-stat"><div class="dsv">'+(a.velocidad_maxima_ms*3.6).toFixed(1)+' km/h</div><div class="dsl">Velocidad max</div></div>';
  }
  html+='<div class="detail-stat"><div class="dsv">'+(a.frecuencia_cardiaca_promedio||'--')+' bpm</div><div class="dsl">FC Media</div></div>';
  html+='<div class="detail-stat"><div class="dsv">'+(a.frecuencia_cardiaca_maxima||'--')+' bpm</div><div class="dsl">FC Max</div></div>';
  html+='<div class="detail-stat"><div class="dsv">'+(a.calorias||'--')+' kcal</div><div class="dsl">Calorias</div></div>';
  html+='<div class="detail-stat"><div class="dsv">'+(a.cadencia_promedio||'--')+' spm</div><div class="dsl">Cadencia</div></div>';
  html+='<div class="detail-stat"><div class="dsv">'+(a.elevacion_ganada_m?a.elevacion_ganada_m.toFixed(0)+' m':'--')+'</div><div class="dsl">Elevacion</div></div>';
  html+='<div class="detail-stat"><div class="dsv">'+(a.training_stress_score||tss.toFixed(0))+'</div><div class="dsl">TSS</div></div>';
  html+='</div>';

  // Advanced Metrics Section - Better than Strava Premium
  html+='<div class="detail-section">';
  html+='<div class="section-title">Metricas Avanzadas</div>';
  html+='<div class="advanced-metrics">';

  if(vo2){
    var vo2cat=vo2>=60?'Superior':vo2>=52?'Excelente':vo2>=47?'Muy Bueno':vo2>=42?'Bueno':vo2>=38?'Promedio':'Bajo';
    var vo2color=vo2>=52?'#10B981':vo2>=42?'#F59E0B':'#EF4444';
    html+='<div class="adv-metric" style="border-color:'+vo2color+';">';
    html+='<div class="adv-metric-val" style="color:'+vo2color+';">'+vo2.toFixed(1)+'</div>';
    html+='<div class="adv-metric-lbl">VO2 Max<br><small>ml/kg/min</small></div>';
    html+='<div class="adv-metric-cat" style="color:'+vo2color+';">'+vo2cat+'</div></div>';
  }

  if(tss>0){
    html+='<div class="adv-metric">';
    html+='<div class="adv-metric-val">'+tss.toFixed(0)+'</div>';
    html+='<div class="adv-metric-lbl">TSS<br><small>Stress Score</small></div>';
    html+='<div class="adv-metric-cat">'+(tss<50?'Leve':tss<100?'Moderado':tss<150?'Alto':'Muy Alto')+'</div></div>';
  }

  if(aerobicEff>0){
    html+='<div class="adv-metric">';
    html+='<div class="adv-metric-val">'+aerobicEff.toFixed(1)+'</div>';
    html+='<div class="adv-metric-lbl">Eficiencia<br><small>Aerobica</small></div>';
    html+='<div class="adv-metric-cat">'+(aerobicEff>2?'Optima':aerobicEff>1.5?'Buena':'Mejorable')+'</div></div>';
  }

  if(recTime>0){
    html+='<div class="adv-metric" style="border-color:#F59E0B;">';
    html+='<div class="adv-metric-val" style="color:#F59E0B;">'+recTime+'h</div>';
    html+='<div class="adv-metric-lbl">Recuperacion<br><small>Estimada</small></div>';
    html+='<div class="adv-metric-cat">Descanso</div></div>';
  }

  if(intensityFactor>0){
    var ifColor=intensityFactor>0.85?'#EF4444':intensityFactor>0.75?'#F59E0B':'#10B981';
    html+='<div class="adv-metric" style="border-color:'+ifColor+';">';
    html+='<div class="adv-metric-val" style="color:'+ifColor+';">'+intensityFactor.toFixed(2)+'</div>';
    html+='<div class="adv-metric-lbl">IF<br><small>Intensidad</small></div>';
    html+='<div class="adv-metric-cat">'+(intensityFactor>0.85?'Intensa':intensityFactor>0.75?'Umbral':'Aerobica')+'</div></div>';
  }

  html+='</div></div>';

  // HR Zones breakdown
  if(a.frecuencia_cardiaca_promedio&&a.frecuencia_cardiaca_maxima){
    html+=buildHRZonesDetail(a);
  }

  // Projections
  if(!isCycling&&!isSwim&&a.duracion_segundos>0&&a.distancia_metros>500){
    html+=buildRunProjections(a);
  } else if(isCycling&&a.duracion_segundos>0&&a.distancia_metros>1000){
    html+=buildCyclingProjections(a);
  }

  // AI Analysis
  html+='<div class="detail-section"><div class="section-title">Analisis IA Personalizado</div><div class="ai-advice">'+generateAIAdvice(a,sp)+'</div></div>';

  html+='<div class="detail-actions">';
  html+='<button class="btn-close-modal" onclick="closeModal(&quot;activity-detail-modal&quot;)">Cerrar</button>';
  html+='<button class="btn-delete-modal" onclick="deleteActivityFromDetail()">Eliminar Actividad</button>';
  html+='</div>';

  var content=document.getElementById('activity-detail-content');
  if(content) content.innerHTML=html;
  if(modal) modal.classList.remove('hidden');
}

function deleteActivityFromDetail() { deleteActivity(window._currentDetailId); }

async function deleteActivity(id) {
  // no confirm - direct delete
  showToast('Eliminando actividad...','success');
  var r=await _db.from('activities').delete().eq('id',id);
  if(!r.error){
    closeModal('activity-detail-modal');
    await loadActivities();
    await loadDashboard();
    showToast('Actividad eliminada','success');
  } else {
    showToast('Error: '+r.error.message,'error');
  }
}

// ADVANCED METRIC CALCULATIONS
function calcVO2Max(a) {
  if(a.frecuencia_cardiaca_promedio&&a.frecuencia_cardiaca_maxima&&a.distancia_metros>1000){
    return 15*(a.frecuencia_cardiaca_maxima/a.frecuencia_cardiaca_promedio);
  }
  if(a.duracion_segundos>0&&a.distancia_metros>1000){
    var paceSecKm=a.duracion_segundos/(a.distancia_metros/1000);
    var speedMMin=1000/paceSecKm;
    return 29.54+5.000663*speedMMin-0.007546*speedMMin*speedMMin;
  }
  return null;
}

function calcAerobicEfficiency(a) {
  if(!a.frecuencia_cardiaca_promedio||!a.distancia_metros||!a.duracion_segundos) return 0;
  var paceMinKm=(a.duracion_segundos/60)/(a.distancia_metros/1000);
  var hrPerMile=a.frecuencia_cardiaca_promedio*paceMinKm;
  return hrPerMile>0?100/hrPerMile*10:0;
}

function calcRecoveryTime(a) {
  var tss=calcTSS(a);
  if(tss<50) return 12;
  if(tss<100) return 24;
  if(tss<150) return 36;
  if(tss<200) return 48;
  return 72;
}

function calcHRDrift(a) {
  if(!a.frecuencia_cardiaca_promedio||!a.frecuencia_cardiaca_maxima) return 0;
  return ((a.frecuencia_cardiaca_maxima-a.frecuencia_cardiaca_promedio)/a.frecuencia_cardiaca_promedio*100).toFixed(1);
}

function calcIntensityFactor(a) {
  if(!a.frecuencia_cardiaca_promedio||!a.frecuencia_cardiaca_maxima) return 0;
  return a.frecuencia_cardiaca_promedio/a.frecuencia_cardiaca_maxima;
}

function buildHRZonesDetail(a) {
  var maxHR=a.frecuencia_cardiaca_maxima||190;
  var avgHR=a.frecuencia_cardiaca_promedio||0;
  var zones=[
    {name:'Z1 Recuperacion',min:0.5,max:0.6,color:'#6B7280'},
    {name:'Z2 Aerobico',min:0.6,max:0.7,color:'#3B82F6'},
    {name:'Z3 Tempo',min:0.7,max:0.8,color:'#10B981'},
    {name:'Z4 Umbral',min:0.8,max:0.9,color:'#F59E0B'},
    {name:'Z5 Maximo',min:0.9,max:1.0,color:'#EF4444'}
  ];
  var currentZone=zones.find(function(z){return avgHR>=z.min*maxHR&&avgHR<z.max*maxHR;})||zones[2];
  var html='<div class="detail-section"><div class="section-title">Zonas de Frecuencia Cardiaca</div>';
  html+='<div style="margin-bottom:8px;color:#94A3B8;font-size:0.85rem;">FC Media: <strong style="color:#F1F5F9;">'+avgHR+' bpm</strong> &bull; Zona activa: <strong style="color:'+currentZone.color+';">'+currentZone.name+'</strong></div>';
  html+='<div class="hr-zones">';
  zones.forEach(function(z){
    var lo=Math.round(z.min*maxHR), hi=Math.round(z.max*maxHR);
    var active=avgHR>=lo&&avgHR<hi;
    var pct=active?100:0;
    html+='<div class="hr-zone-bar'+(active?' active':'')+'">'
      +'<div class="hz-label" style="color:'+z.color+';">'+z.name+'</div>'
      +'<div class="hz-range">'+lo+'-'+hi+' bpm</div>'
      +'<div class="hz-bar-bg"><div class="hz-bar-fill" style="width:'+(active?'100':'30')+'%;background:'+z.color+';"></div></div>'
      +'</div>';
  });
  html+='</div></div>';
  return html;
}

function buildRunProjections(a) {
  if(!a.duracion_segundos||!a.distancia_metros||a.distancia_metros<500) return '';
  var t1=a.duracion_segundos, d1=a.distancia_metros;
  var races=[
    {name:'5 km',d:5000,icon:'🏃'},
    {name:'10 km',d:10000,icon:'🏃'},
    {name:'15 km',d:15000,icon:'🏃'},
    {name:'Media Maraton',d:21097,icon:'🏅'},
    {name:'Maraton',d:42195,icon:'🏆'}
  ];
  var html='<div class="detail-section"><div class="section-title">Proyecciones de Carrera (Formula Riegel)</div><div class="projections-grid">';
  races.forEach(function(r){
    var t2=t1*Math.pow(r.d/d1,1.06);
    var h=Math.floor(t2/3600),m=Math.floor((t2%3600)/60),s=Math.round(t2%60);
    var timeStr=h>0?h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    var paceS=t2/(r.d/1000);
    var pm=Math.floor(paceS/60),ps=Math.round(paceS%60);
    html+='<div class="proj-card"><div class="proj-icon">'+r.icon+'</div><div class="proj-name">'+r.name+'</div><div class="proj-time">'+timeStr+'</div><div class="proj-pace">'+pm+':'+String(ps).padStart(2,'0')+'/km</div></div>';
  });
  html+='</div></div>';
  return html;
}

function buildCyclingProjections(a) {
  if(!a.duracion_segundos||!a.distancia_metros||a.distancia_metros<1000) return '';
  var t1=a.duracion_segundos,d1=a.distancia_metros;
  var routes=[{name:'30 km',d:30000},{name:'50 km',d:50000},{name:'100 km',d:100000},{name:'160 km (Century)',d:160000}];
  var html='<div class="detail-section"><div class="section-title">Proyecciones Ciclismo</div><div class="projections-grid">';
  routes.forEach(function(r){
    var fatigue=1+(r.d/d1-1)*0.08;
    var t2=t1*(r.d/d1)*fatigue;
    var h=Math.floor(t2/3600),m=Math.floor((t2%3600)/60);
    var spd=(r.d/1000)/(t2/3600);
    html+='<div class="proj-card"><div class="proj-icon">🚴</div><div class="proj-name">'+r.name+'</div><div class="proj-time">'+h+'h '+String(m).padStart(2,'0')+'m</div><div class="proj-pace">'+spd.toFixed(1)+' km/h</div></div>';
  });
  html+='</div></div>';
  return html;
}

function generateAIAdvice(a, sp) {
  var tips=[];
  var dur=a.duracion_segundos||0;
  var dist=(a.distancia_metros||0)/1000;
  var avgHR=a.frecuencia_cardiaca_promedio||0;
  var maxHR=a.frecuencia_cardiaca_maxima||200;
  var tss=calcTSS(a);

  if(dur>0&&dist>0){
    var isCyc=a.tipo_actividad==='cycling'||a.tipo_actividad==='indoor_cycling';
    if(!isCyc){
      var paceMin=(dur/60)/dist;
      if(paceMin<4) tips.push('<strong>Ritmo elite:</strong> Rendimiento competitivo. Asegurate de tener suficiente recuperacion entre sesiones intensas.');
      else if(paceMin<5) tips.push('<strong>Buen ritmo:</strong> Entrenamiento intenso de calidad. Alterna con dias de zona 2 para maxima adaptacion.');
      else if(paceMin<6) tips.push('<strong>Ritmo aerobico optimo:</strong> Zona 3 ideal para mejorar VO2Max y economia de carrera.');
      else tips.push('<strong>Ritmo recuperacion/base:</strong> Excelente para construir resistencia aerobica sin estres excesivo.');
    } else {
      var spd=dist/(dur/3600);
      if(spd>40) tips.push('<strong>Velocidad alta:</strong> Potencia elevada. Revisa tu FTP y asegurate de no sobreentrenar.');
      else if(spd>28) tips.push('<strong>Buen ritmo ciclista:</strong> Entrena en zona 3-4 para maxima mejora de potencia.');
      else tips.push('<strong>Ciclismo aerobico:</strong> Buena base para resistencia. Considera series de interval training.');
    }
  }

  if(avgHR>0&&maxHR>0){
    var hrPct=(avgHR/maxHR)*100;
    if(hrPct>90) tips.push('<strong>Zona 5 (VO2Max):</strong> Esfuerzo maximo alcanzado. Necesitas 48-72h de recuperacion completa.');
    else if(hrPct>80) tips.push('<strong>Zona 4 (Umbral lactato):</strong> Entrenamiento de alta calidad. Recuperacion de 24-36h recomendada.');
    else if(hrPct>70) tips.push('<strong>Zona 3 (Aerobico intenso):</strong> Estimulo optimo para mejorar VO2Max. Recuperacion de 12-24h.');
    else if(hrPct>60) tips.push('<strong>Zona 2 (Base aerobica):</strong> Zona ideal para quemar grasa y construccion de resistencia. Puedes entrenar mañana.');
    else tips.push('<strong>Zona 1 (Recuperacion activa):</strong> Intensidad perfecta para dias de recuperacion.');
  }

  if(tss>100) tips.push('<strong>Alta carga (TSS '+tss.toFixed(0)+'):</strong> Sesion exigente. Duerme 8h y recarga glucogeno en las proximas 2-3h.');
  if(a.elevacion_ganada_m>200) tips.push('<strong>Trabajo en cuestas ('+a.elevacion_ganada_m.toFixed(0)+'m):</strong> Mejora fuerza especifica y economia de movimiento. Excelente estimulo neuromuscular.');
  if(a.calorias>700) tips.push('<strong>Gasto calorico alto ('+a.calorias+' kcal):</strong> Consume 30-60g de carbohidratos + 20g proteina en los proximos 30 minutos.');
  if(dur>7200) tips.push('<strong>Sesion larga (+2h):</strong> Adaptaciones aerobicas maximas. Hidratacion y nutricion son criticas durante y despues.');
  if(!tips.length) tips.push('<strong>Actividad completada:</strong> Consistencia es la clave del progreso. Sigue tu plan de entrenamiento.');

  return tips.map(function(t){return '<div class="ai-tip">'+t+'</div>';}).join('');
}

// FILE UPLOAD
function showUploadModal(){document.getElementById('upload-modal').classList.remove('hidden');}
function handleDrop(e){e.preventDefault();e.currentTarget.classList.remove('drag-over');var f=e.dataTransfer.files[0];if(f)processFile(f);}
function handleFileSelect(e){var f=e.target.files[0];if(f)processFile(f);}

function processFile(file) {
  currentFile=file; parsedActivityData=null;
  var ext=file.name.split('.').pop().toLowerCase();
  if(!['gpx','fit','tcx'].includes(ext)){showToast('Usa GPX, FIT o TCX','error');return;}
  var nameEl=document.getElementById('file-name-display');
  var sizeEl=document.getElementById('file-size-display');
  var actNameEl=document.getElementById('activity-name');
  if(nameEl) nameEl.textContent=file.name;
  if(sizeEl) sizeEl.textContent=(file.size/1024).toFixed(1)+' KB';
  // Use just the filename without extension as default name
  if(actNameEl) actNameEl.value=file.name.replace(/\.[^\.]+$/,'').replace(/_/g,' ');
  var ua=document.getElementById('upload-area'), up=document.getElementById('upload-preview');
  if(ua) ua.classList.add('hidden'); if(up) up.classList.remove('hidden');
  var reader=new FileReader();
  if(ext==='gpx'){reader.onload=function(e){parsedActivityData=parseGPX(e.target.result);};reader.readAsText(file);}
  else if(ext==='tcx'){reader.onload=function(e){parsedActivityData=parseTCX(e.target.result);};reader.readAsText(file);}
  else if(ext==='fit'){reader.onload=function(e){parsedActivityData=parseFIT(e.target.result);};reader.readAsArrayBuffer(file);}
}

async function uploadActivity() {
  if(!currentFile||!currentUser) return;
  var nombre=document.getElementById('activity-name').value||currentFile.name;
  var type=document.getElementById('activity-type').value;
  var notas=document.getElementById('activity-notes').value;
  var rpe=parseInt(document.getElementById('activity-rpe').value)||5;
  var fillEl=document.getElementById('progress-fill'), statusEl=document.getElementById('upload-status');
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-progress').classList.remove('hidden');
  if(fillEl) fillEl.style.width='30%';
  if(statusEl) statusEl.textContent='Analizando archivo...';
  await new Promise(function(r){setTimeout(r,400);});
  var actData={user_id:currentUser.id,nombre:nombre,tipo_actividad:type,notas:notas,
    percepcion_esfuerzo:rpe,sincronizado_en:new Date().toISOString(),fecha_inicio:new Date().toISOString()};
  var p=parsedActivityData;
  if(p){
    if(p.totalDist>0) actData.distancia_metros=parseFloat(p.totalDist.toFixed(2));
    if(p.duration>0) actData.duracion_segundos=Math.round(p.duration);
    if(p.startTime) actData.fecha_inicio=p.startTime;
    if(p.endTime) actData.fecha_fin=p.endTime;
    if(p.avgHr) actData.frecuencia_cardiaca_promedio=p.avgHr;
    if(p.maxHr) actData.frecuencia_cardiaca_maxima=p.maxHr;
    if(p.elevGain>0) actData.elevacion_ganada_m=p.elevGain;
    if(p.calories) actData.calorias=p.calories;
    if(p.avgCadence) actData.cadencia_promedio=p.avgCadence;
    if(p.maxSpeed>0) actData.velocidad_maxima_ms=p.maxSpeed;
    if(actData.duracion_segundos>0&&actData.distancia_metros>0)
      actData.pace_promedio_seg_km=Math.round(actData.duracion_segundos/(actData.distancia_metros/1000));
    if(p.sport&&p.sport!=='other') actData.tipo_actividad=p.sport;
    actData.training_stress_score=Math.round(calcTSS(actData));
  }
  if(fillEl) fillEl.style.width='80%';
  if(statusEl) statusEl.textContent='Guardando...';
  var r=await _db.from('activities').insert([actData]);
  if(fillEl) fillEl.style.width='100%';
  if(r.error){
    if(statusEl) statusEl.textContent='Error: '+r.error.message;
    showToast('Error: '+r.error.message,'error');
  } else {
    if(statusEl) statusEl.textContent='Actividad guardada!';
    showToast('Actividad subida!','success');
    setTimeout(function(){closeModal('upload-modal');resetUploadModal();loadActivities();loadDashboard();},1500);
  }
}

function resetUploadModal(){
  currentFile=null; parsedActivityData=null;
  var ua=document.getElementById('upload-area'),up=document.getElementById('upload-preview'),
    upg=document.getElementById('upload-progress'),fi=document.getElementById('file-input'),
    pf=document.getElementById('progress-fill');
  if(ua) ua.classList.remove('hidden'); if(up) up.classList.add('hidden');
  if(upg) upg.classList.add('hidden'); if(fi) fi.value=''; if(pf) pf.style.width='0';
}

// FIT BINARY PARSER - Full Garmin support
function parseFIT(ab) {
  var bytes=new Uint8Array(ab), view=new DataView(ab);
  if(bytes.length<14) return null;
  var hdr=bytes[0];
  if(String.fromCharCode(bytes[8],bytes[9],bytes[10],bytes[11])!=='.FIT') return null;
  var localDefs={}, offset=hdr, dataEnd=bytes.length-2;
  var records=[], sessionData=null;

  while(offset<dataEnd){
    if(offset>=bytes.length) break;
    var rh=bytes[offset];
    var isCmp=(rh&0x80)!==0, isDef=!isCmp&&(rh&0x40)!==0;
    var lNum=isCmp?(rh>>5)&0x03:rh&0x0F, hasDev=!isCmp&&(rh&0x20)!==0;
    offset++;
    if(isDef){
      offset++;
      var arch=bytes[offset++], le=arch===0;
      var gNum=le?view.getUint16(offset,true):view.getUint16(offset,false);
      offset+=2;
      var nf=bytes[offset++], flds=[];
      for(var i=0;i<nf;i++){flds.push({fdn:bytes[offset++],fsz:bytes[offset++],fbt:bytes[offset++]});}
      if(hasDev){var nd=bytes[offset++];for(var j=0;j<nd;j++)offset+=3;}
      localDefs[lNum]={gNum:gNum,le:le,flds:flds};
    } else {
      var def=localDefs[lNum];
      if(!def){offset++;continue;}
      var rec={_t:def.gNum};
      for(var fi=0;fi<def.flds.length;fi++){
        var f=def.flds[fi], bt=f.fbt&0x9F, v=0;
        try{
          if(bt===0x00||bt===0x02||bt===0x0A) v=bytes[offset];
          else if(bt===0x01) v=view.getInt8(offset);
          else if(bt===0x83) v=f.le?view.getInt16(offset,true):view.getInt16(offset,false);
          else if(bt===0x84) v=f.le?view.getUint16(offset,true):view.getUint16(offset,false);
          else if(bt===0x85) v=f.le?view.getInt32(offset,true):view.getInt32(offset,false);
          else if(bt===0x86) v=f.le?view.getUint32(offset,true):view.getUint32(offset,false);
          else v=bytes[offset];
        }catch(e){v=0;}
        rec[f.fdn]=v; offset+=f.fsz;
      }
      if(def.gNum===20) records.push(rec);
      if(def.gNum===18) sessionData=rec;
    }
  }

  var SC=180/Math.pow(2,31);
  var totalDist=0,duration=0,calories=null,avgHr=null,maxHr=null;
  var avgCadence=null,maxSpeed=0,elevGain=0,startTime=null,endTime=null,sportCode=0;

  if(sessionData){
    if(sessionData[9]!==undefined&&sessionData[9]<0xFFFFFFFF) totalDist=sessionData[9]/100;
    if(sessionData[7]!==undefined&&sessionData[7]<0xFFFFFFFF) duration=sessionData[7]/1000;
    if(sessionData[11]!==undefined&&sessionData[11]<0xFFFF) calories=sessionData[11];
    if(sessionData[14]!==undefined&&sessionData[14]<0xFF) avgHr=sessionData[14];
    if(sessionData[15]!==undefined&&sessionData[15]<0xFF) maxHr=sessionData[15];
    if(sessionData[16]!==undefined&&sessionData[16]<0xFF) avgCadence=sessionData[16];
    if(sessionData[19]!==undefined&&sessionData[19]<0xFFFF) maxSpeed=sessionData[19]/1000;
    if(sessionData[22]!==undefined&&sessionData[22]<0xFFFF) elevGain=sessionData[22]/5;
    if(sessionData[5]!==undefined) sportCode=sessionData[5];
    if(sessionData[2]!==undefined&&sessionData[2]<0xFFFFFFFF){
      startTime=new Date((sessionData[2]+631065600)*1000).toISOString();
      if(duration) endTime=new Date((sessionData[2]+631065600+Math.round(duration))*1000).toISOString();
    }
  }

  var recHrs=[],recLats=[],recLons=[],startCoords=null;
  records.forEach(function(r){
    var lat=r[0],lon=r[1];
    if(lat!==undefined&&lon!==undefined&&lat!==0x7FFFFFFF&&lat!==0){
      var ld=lat*SC,lnd=lon*SC;
      if(!startCoords) startCoords={lat:ld,lng:lnd};
      recLats.push(ld);recLons.push(lnd);
    }
    if(r[3]!==undefined&&r[3]>0&&r[3]<0xFF) recHrs.push(r[3]);
    if(r[253]!==undefined&&r[253]<0xFFFFFFFF&&!startTime)
      startTime=new Date((r[253]+631065600)*1000).toISOString();
  });

  if(!totalDist&&recLats.length>1){
    var d=0;
    for(var ri=1;ri<recLats.length;ri++) d+=haversine(recLats[ri-1],recLons[ri-1],recLats[ri],recLons[ri]);
    totalDist=d;
  }
  if(!avgHr&&recHrs.length) avgHr=Math.round(recHrs.reduce(function(a,b){return a+b;},0)/recHrs.length);
  if(!maxHr&&recHrs.length) maxHr=Math.max.apply(null,recHrs);

  // Map FIT sport code to our sport types
  var fitSport=FIT_SPORT_MAP[sportCode]||'other';
  // Normalize to our SPORT_CONFIG keys
  var sportMap={'trail_running':'running','indoor_cycling':'cycling','virtual_activity':'cycling',
    'fitness_equipment':'strength','training':'other','multisport':'triathlon'};
  var sport=sportMap[fitSport]||fitSport;
  if(!SPORT_CONFIG[sport]) sport='other';

  return {totalDist:totalDist,duration:Math.round(duration),startTime:startTime,endTime:endTime,
    avgHr:avgHr,maxHr:maxHr,avgCadence:avgCadence,maxSpeed:maxSpeed,elevGain:elevGain,
    calories:calories,startCoords:startCoords,sport:sport};
}

// TCX PARSER
function parseTCX(xml) {
  var parser=new DOMParser(), doc=parser.parseFromString(xml,'text/xml');
  var trkpts=doc.querySelectorAll('Trackpoint');
  var times=[],hrs=[],elevs=[],positions=[],totalDist=0;
  trkpts.forEach(function(tp){
    var t=tp.querySelector('Time');if(t)times.push(new Date(t.textContent));
    var hrEl=tp.querySelector('HeartRateBpm Value')||tp.querySelector('HeartRateBpm');
    if(hrEl){var hr=parseInt(hrEl.textContent);if(hr>0)hrs.push(hr);}
    var ele=tp.querySelector('AltitudeMeters');if(ele){var e=parseFloat(ele.textContent);if(e>0)elevs.push(e);}
    var dist=tp.querySelector('DistanceMeters');if(dist){var d=parseFloat(dist.textContent);if(d>totalDist)totalDist=d;}
    var lat=tp.querySelector('LatitudeDegrees'),lon=tp.querySelector('LongitudeDegrees');
    if(lat&&lon){var la=parseFloat(lat.textContent),lo=parseFloat(lon.textContent);if(!isNaN(la)&&!isNaN(lo))positions.push([la,lo]);}
  });
  if(totalDist===0&&positions.length>1){var d=0,prev=null;positions.forEach(function(p){if(prev)d+=haversine(prev[0],prev[1],p[0],p[1]);prev=p;});totalDist=d;}
  var calEl=doc.querySelector('Calories'), calories=calEl?parseInt(calEl.textContent):null;
  var duration=times.length>1?(times[times.length-1]-times[0])/1000:0;
  var avgHr=hrs.length?Math.round(hrs.reduce(function(a,b){return a+b;},0)/hrs.length):null;
  var maxHr=hrs.length?Math.max.apply(null,hrs):null;
  var elevGain=0;for(var i=1;i<elevs.length;i++)if(elevs[i]>elevs[i-1])elevGain+=elevs[i]-elevs[i-1];
  var sportEl=doc.querySelector('Activity');
  var sport='other';
  if(sportEl){var s=(sportEl.getAttribute('Sport')||'').toLowerCase();
    if(s==='running')sport='running';else if(s==='biking'||s==='cycling')sport='cycling';
    else if(s==='swimming')sport='swimming';}
  return {totalDist:totalDist,duration:Math.round(duration),startTime:times[0]?times[0].toISOString():null,
    endTime:times[times.length-1]?times[times.length-1].toISOString():null,
    avgHr:avgHr,maxHr:maxHr,calories:calories,elevGain:parseFloat(elevGain.toFixed(1)),
    startCoords:positions[0]?{lat:positions[0][0],lng:positions[0][1]}:null,sport:sport};
}

// GPX PARSER
function parseGPX(xml) {
  var parser=new DOMParser(), doc=parser.parseFromString(xml,'text/xml');
  var trkpts=doc.querySelectorAll('trkpt');
  var points=[],times=[],elevs=[],hrs=[],totalDist=0,prev=null;
  trkpts.forEach(function(pt){
    var lat=parseFloat(pt.getAttribute('lat')),lon=parseFloat(pt.getAttribute('lon'));
    var ele=pt.querySelector('ele');var e=ele?parseFloat(ele.textContent):0;
    var time=pt.querySelector('time');if(time)times.push(new Date(time.textContent));
    var hrEl=pt.querySelector('gpxtpx\\:hr')||pt.querySelector('hr')||pt.querySelector('heartrate');
    if(hrEl){var hr=parseInt(hrEl.textContent);if(hr>0)hrs.push(hr);}
    if(!isNaN(lat)&&!isNaN(lon)){
      if(prev)totalDist+=haversine(prev[0],prev[1],lat,lon);
      prev=[lat,lon];points.push([lat,lon]);
    }
    if(e>0)elevs.push(e);
  });
  var typeEl=doc.querySelector('type');
  var sport='running';
  if(typeEl){var s=typeEl.textContent.toLowerCase();if(s.includes('cycl')||s.includes('bik'))sport='cycling';}
  var duration=times.length>1?(times[times.length-1]-times[0])/1000:0;
  var avgHr=hrs.length?Math.round(hrs.reduce(function(a,b){return a+b;},0)/hrs.length):null;
  var maxHr=hrs.length?Math.max.apply(null,hrs):null;
  var elevGain=0;for(var i=1;i<elevs.length;i++)if(elevs[i]>elevs[i-1])elevGain+=elevs[i]-elevs[i-1];
  return {totalDist:totalDist,duration:Math.round(duration),startTime:times[0]?times[0].toISOString():null,
    endTime:times[times.length-1]?times[times.length-1].toISOString():null,
    avgHr:avgHr,maxHr:maxHr,elevGain:parseFloat(elevGain.toFixed(1)),
    startCoords:points[0]?{lat:points[0][0],lng:points[0][1]}:null,sport:sport};
}

function haversine(lat1,lon1,lat2,lon2){
  var R=6371000,phi1=lat1*Math.PI/180,phi2=lat2*Math.PI/180;
  var dp=(lat2-lat1)*Math.PI/180,dl=(lon2-lon1)*Math.PI/180;
  var a=Math.sin(dp/2)*Math.sin(dp/2)+Math.cos(phi1)*Math.cos(phi2)*Math.sin(dl/2)*Math.sin(dl/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// DAILY METRICS
async function loadDailyMetrics(){
  if(!currentUser) return;
  var dpEl=document.getElementById('daily-date-picker');
  var date=dpEl?dpEl.value:new Date().toISOString().split('T')[0];
  var r=await _db.from('daily_metrics').select('*').eq('user_id',currentUser.id).eq('fecha',date).single();
  var data=r.data;
  function set(id,val,suf){var el=document.getElementById(id);if(el)el.textContent=val!=null?val+(suf||')':'--';}
  if(data){
    set('d-steps',data.pasos?data.pasos.toLocaleString():null);
    set('d-hr',data.frecuencia_cardiaca_reposo,') bpm');
    set('d-battery',data.body_battery_max);
    set('d-sleep',data.horas_sueno?data.horas_sueno.toFixed(1):null,' h');
    set('d-stress',data.nivel_estres);
    set('d-hrv',data.variabilidad_fc_hrv,' ms');
    set('d-readiness',data.training_readiness);
    set('d-spo2',data.spo2_promedio?data.spo2_promedio.toFixed(1):null,'%');
  }
  var ago=new Date();ago.setDate(ago.getDate()-7);
  var r2=await _db.from('daily_metrics').select('*').eq('user_id',currentUser.id).gte('fecha',ago.toISOString().split('T')[0]).order('fecha');
  renderWellnessChart(r2.data||[]);
}

function renderWellnessChart(data){
  var ctx=document.getElementById('wellness-chart');if(!ctx)return;
  if(charts.wellness)charts.wellness.destroy();
  charts.wellness=new Chart(ctx,{type:'line',
    data:{labels:data.map(function(d){return d.fecha?d.fecha.substring(5):'';} ),
      datasets:[
        {label:'Body Battery',data:data.map(function(d){return d.body_battery_max;}),borderColor:'#FC4C02',tension:0.4,fill:false},
        {label:'Readiness',data:data.map(function(d){return d.training_readiness;}),borderColor:'#10B981',tension:0.4,fill:false},
        {label:'Estres',data:data.map(function(d){return d.nivel_estres;}),borderColor:'#EF4444',tension:0.4,fill:false}
      ]},
    options:{responsive:true,scales:{x:{grid:{color:'#1e293b'},ticks:{color:'#64748b'}},y:{grid:{color:'#1e293b'},ticks:{color:'#64748b'},min:0,max:100}},plugins:{legend:{labels:{color:'#94A3B8'}}}}
  });
}

// RECORDS
async function loadRecords(){
  if(!currentUser) return;
  var r=await _db.from('activities').select('*').eq('user_id',currentUser.id).order('pace_promedio_seg_km',{ascending:true});
  var acts=r.data||[];
  var running=acts.filter(function(a){return a.tipo_actividad==='running';});
  var cycling=acts.filter(function(a){return a.tipo_actividad==='cycling'||a.tipo_actividad==='indoor_cycling';});
  var findBest=function(arr,min,max){return arr.find(function(a){return a.distancia_metros>=min&&a.distancia_metros<=max&&a.duracion_segundos;});};
  var fmtT=function(s){if(!s)return '--:--';var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h>0?h+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');};
  function setText(id,val){var el=document.getElementById(id);if(el)el.textContent=val;}
  var pr5=findBest(running,4900,5100),pr10=findBest(running,9900,10100),prHalf=findBest(running,21000,21200),prFull=findBest(running,42100,42300);
  setText('pr-5k',fmtT(pr5&&pr5.duracion_segundos));
  setText('pr-10k',fmtT(pr10&&pr10.duracion_segundos));
  setText('pr-half',fmtT(prHalf&&prHalf.duracion_segundos));
  setText('pr-full',fmtT(prFull&&prFull.duracion_segundos));
  var r2=await _db.from('activities').select('distancia_metros,velocidad_maxima_ms').eq('user_id',currentUser.id);
  var all=r2.data||[];
  if(all.length){
    var longest=Math.max.apply(null,all.map(function(a){return a.distancia_metros||0;}));
    var maxSpd=Math.max.apply(null,all.map(function(a){return a.velocidad_maxima_ms||0;}));
    setText('pr-longest',(longest/1000).toFixed(2)+' km');
    setText('pr-speed',(maxSpd*3.6).toFixed(1)+' km/h');
  }
}

// PLANS
async function loadPlans(){
  if(!currentUser) return;
  var r=await _db.from('training_plans').select('*').eq('user_id',currentUser.id).order('creado_en',{ascending:false});
  var data=r.data||[], list=document.getElementById('plans-list');
  if(!list) return;
  if(!data.length){list.innerHTML='<div class="empty-state"><p>No tienes planes. Crea uno!</p></div>';return;}
  list.innerHTML=data.map(function(p){
    var parts=['<div class="plan-card">','<div><h4>'+p.nombre+'</h4>'];
    parts.push('<p style="color:var(--text-muted);font-size:0.85rem;">'+(p.descripcion||'')+'</p>');
    parts.push('<p style="color:var(--text-muted);font-size:0.8rem;">'+(p.semanas||0)+' semanas | Inicio: '+(p.fecha_inicio||'--')+'</p></div>');
    parts.push('<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">');
    parts.push('<span class="plan-badge">'+(p.deporte||'General')+'</span>');
    parts.push('<button class="btn-secondary" onclick="deletePlan('+JSON.stringify(p.id)+')">Eliminar</button></div></div>');
    return parts.join('');
  }).join('');
}
function showCreatePlanModal(){var m=document.getElementById('plan-modal');if(m)m.classList.remove('hidden');}
async function createPlan(e){
  e.preventDefault();
  var pd={user_id:currentUser.id,nombre:document.getElementById('plan-name').value,
    descripcion:document.getElementById('plan-desc').value,deporte:document.getElementById('plan-sport').value,
    nivel:document.getElementById('plan-level').value,semanas:parseInt(document.getElementById('plan-weeks').value)||null,
    fecha_inicio:document.getElementById('plan-start').value,activo:true};
  var r=await _db.from('training_plans').insert([pd]);
  if(!r.error){closeModal('plan-modal');loadPlans();showToast('Plan creado!','success');e.target.reset();}
  else showToast('Error: '+r.error.message,'error');
}
async function deletePlan(id){await _db.from('training_plans').delete().eq('id',id);loadPlans();showToast('Plan eliminado','success');}

// PROFILE
async function loadProfile(){
  if(!currentUser) return;
  var r=await _db.from('user_profile').select('*').eq('user_id',currentUser.id).limit(1).single();
  var el=document.getElementById('user-name-display');
  if(el&&r.data) el.textContent=r.data.nombre||'Sebastian';
}
async function loadProfilePage(){
  if(!currentUser) return;
  var r=await _db.from('user_profile').select('*').eq('user_id',currentUser.id).limit(1).single();
  var p=r.data;
  if(p){
    var nameEl=document.getElementById('profile-name');if(nameEl)nameEl.textContent=p.nombre||'Sebastian Vinueza';
    var edad=new Date().getFullYear()-new Date(p.fecha_nacimiento).getFullYear();
    function setText(id,val){var el=document.getElementById(id);if(el)el.textContent=val;}
    setText('p-age',edad+' anos');setText('p-weight',p.peso_kg+' kg');
    setText('p-height',(p.estatura_cm/100).toFixed(2)+' m');
    var bmi=p.peso_kg/Math.pow(p.estatura_cm/100,2);
    setText('p-bmi',bmi.toFixed(1));setText('p-maxhr',(220-edad)+' bpm');
    setText('p-resthr',(p.frecuencia_cardiaca_reposo||60)+' bpm');
  }
}
function connectGarmin(){showToast('Integracion Garmin proximamente!','success');}

// MODALS & UTILS
function closeModal(id){var el=document.getElementById(id);if(el)el.classList.add('hidden');}

function getSportConfig(type){return SPORT_CONFIG[type]||SPORT_CONFIG.other;}

function formatDuration(seconds,compact){
  if(!seconds||seconds<=0) return '--';
  var s=Math.min(Math.round(Number(seconds)),359999);
  var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  if(compact) return h>0?h+'h '+m+'m':m+'m';
  return h>0?h+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
}

function formatDate(iso){
  if(!iso) return '--';
  return new Date(iso).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
}

function formatPace(spk){
  if(!spk) return '--';
  var m=Math.floor(spk/60),s=Math.round(spk%60);
  return m+':'+String(s).padStart(2,'0');
}

function getWeekKey(d){
  var dt=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  var dn=dt.getUTCDay()||7;
  dt.setUTCDate(dt.getUTCDate()+4-dn);
  var ys=new Date(Date.UTC(dt.getUTCFullYear(),0,1));
  return dt.getUTCFullYear()+'-W'+String(Math.ceil((((dt-ys)/86400000)+1)/7)).padStart(2,'0');
}

function showToast(msg,type){
  var t=document.getElementById('toast');if(!t)return;
  t.textContent=msg;t.className='toast '+(type||'success');
  setTimeout(function(){t.className='toast hidden';},3500);
}
