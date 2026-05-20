'use strict';

/*1. AUTH*/

var currentUser = null;

/*User store*/
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem('hiq_users') || '{}');
  } catch (e) {
    return {};
  }
}

function saveUsers(u) {
  try {
    localStorage.setItem('hiq_users', JSON.stringify(u));
  } catch (e) {
    toast('⚠️ Storage quota exceeded. Try clearing old data.');
  }
}

/*Tab switch*/
function switchTab(t) {
  var isLogin = t === 'login';
  document.getElementById('form-login').style.display  = isLogin ? 'flex' : 'none';
  document.getElementById('form-signup').style.display = isLogin ? 'none' : 'flex';
  document.getElementById('tab-login').classList.toggle('active',  isLogin);
  document.getElementById('tab-signup').classList.toggle('active', !isLogin);
  document.getElementById('tab-login').setAttribute('aria-selected',  String(isLogin));
  document.getElementById('tab-signup').setAttribute('aria-selected', String(!isLogin));
  document.getElementById('login-err').style.display  = 'none';
  document.getElementById('signup-err').style.display = 'none';
}

function showAuthErr(id, msg) {
  var el = document.getElementById(id);
  el.textContent   = msg;
  el.style.display = 'block';
}

/*Login*/
function doLogin() {
  var u     = document.getElementById('login-user').value.trim();
  var p     = document.getElementById('login-pass').value;
  var users = getUsers();

  if (!u || !p) {
    showAuthErr('login-err', 'Please enter both username and password.');
    return;
  }
  if (users[u] && users[u].pass === btoa(p)) {
    document.getElementById('login-err').style.display = 'none';
    launchApp(u);
  } else {
    showAuthErr('login-err', 'Invalid username or password.');
    document.getElementById('login-pass').value = '';
  }
}

/*Sign up*/
function doSignup() {
  var u     = document.getElementById('su-user').value.trim();
  var p     = document.getElementById('su-pass').value;
  var p2    = document.getElementById('su-pass2').value;
  var users = getUsers();

  if (!u)          { showAuthErr('signup-err', 'Username cannot be empty.'); return; }
  if (u.length > 32) { showAuthErr('signup-err', 'Username must be 32 characters or fewer.'); return; }
  if (p.length < 6)  { showAuthErr('signup-err', 'Password must be at least 6 characters.'); return; }
  if (p !== p2)      { showAuthErr('signup-err', "Passwords don't match."); return; }
  if (users[u])      { showAuthErr('signup-err', 'That username is already taken.'); return; }

  users[u] = { pass: btoa(p), created: Date.now() };
  saveUsers(users);
  document.getElementById('signup-err').style.display = 'none';
  launchApp(u);
}

/*app*/
function launchApp(username) {
  currentUser = username;
  document.getElementById('auth-layer').style.display      = 'none';
  document.getElementById('app').style.display             = 'flex';
  document.getElementById('header-username').textContent   = username;
  document.getElementById('avatar-initials').textContent   = username[0].toUpperCase();
  loadUserData();
  document.getElementById('date').value = new Date().toISOString().split('T')[0];
}

/*Logout*/
function doLogout() {
  currentUser = null;
  document.getElementById('auth-layer').style.display = 'flex';
  document.getElementById('app').style.display        = 'none';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  destroyCharts();
}

document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  if (document.getElementById('auth-layer').style.display === 'none') return;
  var loginVisible = document.getElementById('form-login').style.display !== 'none';
  if (loginVisible) doLogin(); else doSignup();
});


/* 2. DATA — storage, entries, filter, math, insights, export*/

var data         = [];
var filteredData = [];
var activeFilter = 'all';

/*storage key */
function userKey(k) {
  return 'hiq_' + currentUser + '_' + k;
}

function safeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      toast('⚠️ Storage full — try deleting old entries.');
    }
    return false;
  }
}

/*Load & save entries */
function loadUserData() {
  try {
    data  = JSON.parse(localStorage.getItem(userKey('data'))  || '[]');
    todos = JSON.parse(localStorage.getItem(userKey('todos')) || '[]');
  } catch (e) {
    data  = [];
    todos = [];
  }
  filteredData = data.slice();
  activeFilter = 'all';
  renderTodos();
  refreshAll();
}

function saveData() {
  safeStore(userKey('data'), data);
}

function inRange(val, min, max) {
  return !isNaN(val) && val >= min && val <= max;
}

/*Add & update entry*/
function addData() {
  var dateVal   = document.getElementById('date').value;
  var studyVal  = parseFloat(document.getElementById('study').value)  || 0;
  var sleepVal  = parseFloat(document.getElementById('sleep').value)  || 0;
  var screenVal = parseFloat(document.getElementById('screen').value) || 0;
  var prodVal   = parseFloat(document.getElementById('productivity').value);

  if (!dateVal)                    { toast('⚠️ Please select a date.'); return; }
  if (!inRange(prodVal, 1, 10))    { toast('⚠️ Productivity score must be 1–10.'); return; }
  if (!inRange(studyVal,  0, 24) ||
      !inRange(sleepVal,  0, 24) ||
      !inRange(screenVal, 0, 24))  { toast('⚠️ Hour values must be 0–24.'); return; }

  var entry = {
    date: dateVal, study: studyVal,
    sleep: sleepVal, screen: screenVal, productivity: prodVal
  };

  var idx = data.findIndex(function(d) { return d.date === dateVal; });
  if (idx >= 0) { data[idx] = entry; toast('✏️ Entry updated for ' + dateVal); }
  else          { data.push(entry);  toast('✅ Entry saved!'); }

  data.sort(function(a, b) { return a.date.localeCompare(b.date); });
  saveData();
  applyFilter(activeFilter);
}

/* Filter*/
function setFilter(f) { applyFilter(f); }

function applyFilter(f) {
  activeFilter = f;
  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
  });
  if (f === 'all') {
    filteredData = data.slice();
    var b = document.getElementById('f-all');
    b.classList.add('active'); b.setAttribute('aria-pressed', 'true');
  } else {
    filteredData = filterDays(f);
    var b2 = document.getElementById('f-' + f);
    if (b2) { b2.classList.add('active'); b2.setAttribute('aria-pressed', 'true'); }
  }
  refreshAll();
}

function filterDays(n) {
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - n);
  cutoff.setHours(0, 0, 0, 0);
  return data.filter(function(d) { return new Date(d.date + 'T00:00:00') >= cutoff; });
}

function refreshAll() {
  updateCharts();
  generateInsights();
  generateHeatmap();
  updateStats();
}

/*MATH UTILITIES*/

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
}

function stdDev(arr) {
  var m  = avg(arr);
  var sq = arr.map(function(v) { return (v - m) * (v - m); });
  return Math.sqrt(avg(sq));
}


function pearson(x, y) {
  var n = x.length;
  if (n < 2) return 0;
  var ax = avg(x), ay = avg(y);
  var num = 0, dx2 = 0, dy2 = 0;
  for (var i = 0; i < n; i++) {
    var xi = x[i] - ax, yi = y[i] - ay;
    num += xi * yi; dx2 += xi * xi; dy2 += yi * yi;
  }
  var den = Math.sqrt(dx2 * dy2);
  return den === 0 ? 0 : parseFloat((num / den).toFixed(2));
}


function corrClass(v) {
  if (v >  0.3) return 'corr-pos';
  if (v < -0.3) return 'corr-neg';
  return 'corr-neu';
}


function trend(arr) {
  if (arr.length < 3) return 0;
  var n  = arr.length;
  var xs = arr.map(function(_, i) { return i; });
  var ax = avg(xs), ay = avg(arr);
  var num = 0, den = 0;
  for (var i = 0; i < n; i++) {
    num += (xs[i] - ax) * (arr[i] - ay);
    den += (xs[i] - ax) * (xs[i] - ax);
  }
  return den === 0 ? 0 : num / den;
}

function maxDay(dataArr, valArr) {
  var idx = 0;
  valArr.forEach(function(v, i) { if (v > valArr[idx]) idx = i; });
  return dataArr[idx];
}

function minDay(dataArr, valArr) {
  var idx = 0;
  valArr.forEach(function(v, i) { if (v < valArr[idx]) idx = i; });
  return dataArr[idx];
}

function ratingLabel(s) {
  if (s >= 8.5) return 'Excellent 🔥';
  if (s >= 7)   return 'Good ✅';
  if (s >= 5)   return 'Average ⚡';
  if (s >= 3)   return 'Below average ⚠️';
  return 'Poor 🔴';
}


function sleepQuality(h) {
  if (h >= 7 && h <= 9) return 'optimal';
  if (h >= 6 && h < 7)  return 'slightly low';
  if (h > 9)            return 'excessive';
  return 'insufficient';
}

/*SMART INSIGHTS*/
function generateInsights() {
  var ids = ['corr-study', 'corr-sleep', 'corr-screen'];

  if (filteredData.length < 3) {
    document.getElementById('insights').textContent =
      'Add at least 3 days of data to unlock your full AI analysis...';
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      el.textContent = '—';
      el.className   = 'corr-val corr-neu';
    });
    return;
  }

  var study  = filteredData.map(function(d) { return d.study; });
  var sleep  = filteredData.map(function(d) { return d.sleep; });
  var screen = filteredData.map(function(d) { return d.screen; });
  var prod   = filteredData.map(function(d) { return d.productivity; });
  var n      = filteredData.length;

  var sc  = pearson(study,  prod);
  var slc = pearson(sleep,  prod);
  var scc = pearson(screen, prod);

  function setCorr(id, val) {
    var el = document.getElementById(id);
    el.textContent = val;
    el.className   = 'corr-val ' + corrClass(val);
  }
  setCorr('corr-study',  sc);
  setCorr('corr-sleep',  slc);
  setCorr('corr-screen', scc);

  var avgProd   = avg(prod);
  var avgStudy  = avg(study);
  var avgSleep  = avg(sleep);
  var avgScreen = avg(screen);

  var prodTrend   = trend(prod);
  var studyTrend  = trend(study);
  var sleepTrend  = trend(sleep);
  var screenTrend = trend(screen);

  var bestDay  = maxDay(filteredData, prod);
  var worstDay = minDay(filteredData, prod);

  var highDays = filteredData.filter(function(d) { return d.productivity >= 7; });
  var lowDays  = filteredData.filter(function(d) { return d.productivity <  5; });

  var hiSleep  = highDays.length ? avg(highDays.map(function(d) { return d.sleep;  })) : null;
  var hiStudy  = highDays.length ? avg(highDays.map(function(d) { return d.study;  })) : null;
  var hiScreen = highDays.length ? avg(highDays.map(function(d) { return d.screen; })) : null;
  var loScreen = lowDays.length  ? avg(lowDays.map( function(d) { return d.screen; })) : null;

  var prodSD     = stdDev(prod);
  var consistent = prodSD < 1.5;

  /* Build report */
  var L = []; 

  /* OVERVIEW */
  L.push('OVERVIEW   (' + n + ' day' + (n !== 1 ? 's' : '') + ' tracked):');
  L.push('Productivity  :  ' + avgProd.toFixed(1)   + ' / 10  —  ' + ratingLabel(avgProd));
  L.push('Study avg     :  ' + avgStudy.toFixed(1)  + ' h / day');
  L.push('Sleep avg     :  ' + avgSleep.toFixed(1)  + ' h / day  (' + sleepQuality(avgSleep) + ')');
  L.push('Screen avg    :  ' + avgScreen.toFixed(1) + ' h / day');
  L.push('Consistency   :  ' + (consistent
    ? 'Stable ✅  (σ = ' + prodSD.toFixed(2) + ')'
    : 'Variable ⚠️  (σ = ' + prodSD.toFixed(2) + ')'));
  L.push(' ');
  L.push('TREND ANALYSIS:');
 
  if      (prodTrend   >  0.15) L.push('Productivity  :  ↑  Rising — you\'re building great momentum!');
  else if (prodTrend   < -0.15) L.push('Productivity  :  ↓  Declining — review your recent habits.');
  else                          L.push('Productivity  :  →  Steady — stable but room to push higher.');

  if      (studyTrend  >  0.10) L.push('Study hours   :  ↑  Increasing — great study discipline.');
  else if (studyTrend  < -0.10) L.push('Study hours   :  ↓  Decreasing — are you losing focus?');
  else                          L.push('Study hours   :  →  Consistent study routine.');

  if      (sleepTrend  >  0.10) L.push('Sleep         :  ↑  Improving — great recovery habit.');
  else if (sleepTrend  < -0.10) L.push('Sleep         :  ↓  Declining — prioritise rest before burnout.');
  else                          L.push('Sleep         :  →  Stable sleep schedule.');

  if      (screenTrend >  0.10) L.push('Screen time   :  ↑  Increasing — watch this closely.');
  else if (screenTrend < -0.10) L.push('Screen time   :  ↓  Reducing — good digital discipline.');
  else                          L.push('Screen time   :  →  Stable screen usage.');

  /*HABIT IMPACT*/
  L.push('');
  L.push('HABIT IMPACT ON PRODUCTIVITY1:');

  if      (sc  >  0.6) L.push('📚 Study  r=' + sc  + '  Very strong positive link. Every extra study hour visibly lifts your score.');
  else if (sc  >  0.3) L.push('📚 Study  r=' + sc  + '  Moderate positive effect. Studying more generally helps your output.');
  else if (sc  < -0.5) L.push('📚 Study  r=' + sc  + '  Strong negative — you may be over-studying and burning out. Try focused shorter sessions.');
  else if (sc  < -0.2) L.push('📚 Study  r=' + sc  + '  Slight negative — quantity isn\'t translating to output. Prioritise study quality over hours.');
  else                 L.push('📚 Study  r=' + sc  + '  Neutral so far. Consistency matters more than raw hours at this stage.');

  if      (slc >  0.6) L.push('😴 Sleep  r=' + slc + '  Sleep is your #1 productivity driver. Protect those hours at all costs.');
  else if (slc >  0.3) L.push('😴 Sleep  r=' + slc + '  Good sleep clearly helps. Aim for 7–9 h consistently for best results.');
  else if (slc < -0.4) L.push('😴 Sleep  r=' + slc + '  Sleeping more seems to reduce output — possible oversleeping. Try capping at 8.5 h.');
  else                 L.push('😴 Sleep  r=' + slc + '  Moderate link. ' + (avgSleep < 7
    ? 'Your avg ' + avgSleep.toFixed(1) + ' h is below the recommended 7 h — try to improve this.'
    : 'Your sleep average looks healthy.'));

  if      (scc < -0.5) L.push('📱 Screen r=' + scc + '  Strong drag on focus. Screen time is robbing your productivity — set a firm daily limit.');
  else if (scc < -0.2) L.push('📱 Screen r=' + scc + '  Mild negative. Cutting even 1 h/day of screen time could meaningfully lift your score.');
  else if (scc >  0.4) L.push('📱 Screen r=' + scc + '  Positive correlation — your screen use is likely productive (coding, research, studying).');
  else                 L.push('📱 Screen r=' + scc + '  Neutral impact. ' + (avgScreen > 5
    ? 'But ' + avgScreen.toFixed(1) + ' h/day is high — monitor the quality of your usage.'
    : 'Screen usage looks well-controlled.'));

  /* DAY*/
  L.push('');
  L.push('');
  L.push('BEST vs WORST DAY');
  L.push('Best   ' + bestDay.date  + '  →  ' +
    'Prod ' + bestDay.productivity  + '/10  · ' +
    'Sleep ' + bestDay.sleep  + 'h  · ' +
    'Study ' + bestDay.study  + 'h  · ' +
    'Screen ' + bestDay.screen  + 'h');
  L.push('Worst  ' + worstDay.date + '  →  ' +
    'Prod ' + worstDay.productivity + '/10  · ' +
    'Sleep ' + worstDay.sleep + 'h  · ' +
    'Study ' + worstDay.study + 'h  · ' +
    'Screen ' + worstDay.screen + 'h');

  if (highDays.length > 0) {
    L.push('');
    L.push('On your ' + highDays.length + ' high-productivity day(s) (score ≥ 7):');
    if (hiSleep  !== null) L.push('  · Avg sleep    ' + hiSleep.toFixed(1)  + ' h  (overall avg ' + avgSleep.toFixed(1)  + ' h)  ' + (hiSleep  > avgSleep  ? '▲ more sleep'   : '▼ less sleep'));
    if (hiStudy  !== null) L.push('  · Avg study    ' + hiStudy.toFixed(1)  + ' h  (overall avg ' + avgStudy.toFixed(1)  + ' h)  ' + (hiStudy  > avgStudy  ? '▲ more study'   : '▼ less study'));
    if (hiScreen !== null) L.push('  · Avg screen   ' + hiScreen.toFixed(1) + ' h  (overall avg ' + avgScreen.toFixed(1) + ' h)  ' + (hiScreen < avgScreen ? '▼ less screen'  : '▲ more screen'));
  }

  if (lowDays.length > 0) {
    L.push('On your ' + lowDays.length + ' low-productivity day(s) (score < 5):');
    if (loScreen !== null) L.push('  · Avg screen   ' + loScreen.toFixed(1) + ' h  (overall avg ' + avgScreen.toFixed(1) + ' h)  ' + (loScreen > avgScreen ? '▲ more screen on bad days' : '▼ less screen on bad days'));
  }

  /*RECOMMENDATIONS */
  L.push('');
  L.push('RECOMMENDATIONS:');

  var recs = [];

  if (avgSleep < 7)
    recs.push('🛌 Sleep more — you\'re averaging only ' + avgSleep.toFixed(1) + ' h. Aim for 7–8 h. Sleep is the cheapest performance boost you have.');
  if (avgSleep > 9.5)
    recs.push('⏰ You may be oversleeping (' + avgSleep.toFixed(1) + ' h avg). Try capping at 9 h and use the extra time for focused study.');

  if (avgScreen > 5)
    recs.push('📵 Screen time is high at ' + avgScreen.toFixed(1) + ' h/day. Try a 1-week phone limit and watch your productivity score climb.');
  if (scc < -0.3 && avgScreen > 3)
    recs.push('🚫 Screen time is negatively correlated (r=' + scc + ') AND high. This is your single biggest drag — cut it first.');

  if (avgStudy < 2 && avgProd < 6)
    recs.push('📖 Low study hours (' + avgStudy.toFixed(1) + ' h) + low productivity — start with just 30 min of focused study daily and build the habit.');
  if (sc > 0.5 && studyTrend < -0.1)
    recs.push('📚 Study is your top productivity driver (r=' + sc + ') but hours are trending down. Re-commit to your study schedule — it\'s working.');

  if (!consistent)
    recs.push('📉 Your productivity swings a lot (σ = ' + prodSD.toFixed(2) + '). Build a fixed daily routine — consistency beats peak intensity every time.');

  if (slc > 0.5 && avgSleep < 7.5)
    recs.push('😴 Sleep is your biggest lever (r=' + slc + ') but you\'re underusing it. Add just 45 min of sleep tonight and track the difference tomorrow.');

  if (prodTrend < -0.15 && screenTrend > 0.1)
    recs.push('⚠️ Productivity is falling while screen time is rising — a clear pattern. Cut 1 h of screen time daily and re-check in a week.');

  if (prodTrend > 0.15 && consistent)
    recs.push('🚀 You\'re on a roll — rising productivity AND consistent habits. Keep the streak alive, even on low-energy days.');

  /* Perfect habits*/
  if (recs.length === 0)
    recs.push('🌟 Your habits look well-balanced! Keep tracking — ' + (n < 14
      ? 'insights sharpen significantly after 14 days of data.'
      : 'you\'re building an excellent long-term data set.'));

  recs.forEach(function(r, i) { L.push((i + 1) + '.  ' + r); });

  /*SCORE FORECAST*/
  L.push('');
  L.push('SCORE FORECAST:');

  var forecastVal = Math.min(10, Math.max(1, avgProd + prodTrend * 7));
  L.push('At your current trend, your 7-day projected score is:');
  L.push('  ' + forecastVal.toFixed(1) + ' / 10  —  ' + ratingLabel(forecastVal));

  if (forecastVal > avgProd + 0.5)
    L.push('  Trajectory looks positive — keep it up! 🔥');
  else if (forecastVal < avgProd - 0.5)
    L.push('  Trajectory is declining — act now before habits slip further. ⚠️');
  else
    L.push('  Trajectory is flat — a small habit change could break you out of the plateau.');

  if (n < 7)
    L.push('  (Forecast improves in accuracy with more data — keep tracking!)');

  document.getElementById('insights').textContent = L.join('\n');
}

function updateStats() {
  var count = filteredData.length;
  document.getElementById('stat-entries').textContent = count;

  if (count > 0) {
    var p = filteredData.map(function(d) { return d.productivity; });
    document.getElementById('stat-avg-prod').textContent = avg(p).toFixed(1);
  } else {
    document.getElementById('stat-avg-prod').textContent = '—';
  }

  document.getElementById('stat-streak').textContent = calcStreak();
}

function calcStreak() {
  if (!data.length) return 0;
  var sorted = data.slice().sort(function(a, b) { return b.date.localeCompare(a.date); });
  var streak = 0;
  var cursor = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00');

  for (var i = 0; i < sorted.length; i++) {
    var d    = new Date(sorted[i].date + 'T00:00:00');
    var diff = Math.round((cursor - d) / 86400000);
    if (diff === 0 || diff === 1) { streak++; cursor = d; }
    else break;
  }
  return streak;
}

/*Export*/
function exportData() {
  if (!data.length) { toast('⚠️ No data to export yet.'); return; }

  var payload = {
    user: currentUser,
    exported: new Date().toISOString(),
    entries: data
  };

  try {
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'habitiq-' + currentUser + '-' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('💾 Exported ' + data.length + ' entries!');
  } catch (e) {
    toast('⚠️ Export failed. Try again.');
  }
}

/*Toast*/
function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.classList.remove('show'); }, 3000);
}


/*3. CHARTS*/

var lineChart = null;
var corrChart = null;
var dualChart = null;

function baseOptions(yMin, yMax) {
  var opts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { family: 'Outfit', size: 11 },
          boxWidth: 10, boxHeight: 10, usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: '#1a2435',
        borderColor: 'rgba(110,231,183,0.2)',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: 'Outfit', size: 12, weight: '600' },
        bodyFont:  { family: 'JetBrains Mono', size: 11 }
      }
    },
    scales: {
      x: {
        ticks: { color: '#475569', font: { family: 'Outfit', size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 12 },
        grid:  { color: 'rgba(255,255,255,0.04)' }
      },
      y: {
        ticks: { color: '#475569', font: { family: 'JetBrains Mono', size: 10 } },
        grid:  { color: 'rgba(255,255,255,0.04)' }
      }
    }
  };
  if (typeof yMin === 'number') opts.scales.y.min = yMin;
  if (typeof yMax === 'number') opts.scales.y.max = yMax;
  return opts;
}

function destroyCharts() {
  if (lineChart) { lineChart.destroy(); lineChart = null; }
  if (corrChart) { corrChart.destroy(); corrChart = null; }
  if (dualChart) { dualChart.destroy(); dualChart = null; }
}

function updateCharts() {
  destroyCharts();
  if (!filteredData.length) return;

  var labels = filteredData.map(function(d) { return d.date.slice(5); });
  var prod   = filteredData.map(function(d) { return d.productivity; });
  var study  = filteredData.map(function(d) { return d.study; });
  var sleep  = filteredData.map(function(d) { return d.sleep; });
  var screen = filteredData.map(function(d) { return d.screen; });

  /* 1.Productivity trend line */
  lineChart = new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Productivity',
        data: prod,
        borderColor: '#6ee7b7',
        backgroundColor: 'rgba(110,231,183,0.07)',
        fill: true,
        tension: 0.45,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#6ee7b7',
        pointBorderColor: '#0d1420',
        pointBorderWidth: 2,
        borderWidth: 2
      }]
    },
    options: baseOptions(0, 10)
  });

  /* 2.Correlation bar chart */
  var sc  = pearson(study,  prod);
  var slc = pearson(sleep,  prod);
  var scc = pearson(screen, prod);

  function barColor(v)  { return v >= 0 ? 'rgba(52,211,153,0.75)' : 'rgba(248,113,113,0.75)'; }
  function barBorder(v) { return v >= 0 ? '#34d399' : '#f87171'; }

  var corrOpts = baseOptions(-1, 1);
  corrOpts.plugins.legend.display = false;

  corrChart = new Chart(document.getElementById('correlationChart'), {
    type: 'bar',
    data: {
      labels: ['Study', 'Sleep', 'Screen'],
      datasets: [{
        label: 'Correlation with Productivity',
        data: [sc, slc, scc],
        backgroundColor: [barColor(sc),  barColor(slc),  barColor(scc)],
        borderColor:     [barBorder(sc), barBorder(slc), barBorder(scc)],
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: corrOpts
  });

  /* 3.Sleep vs Study dual line */
  var dualOpts = baseOptions();
  dualOpts.plugins.legend.display = true;

  dualChart = new Chart(document.getElementById('dualChart'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Sleep (hrs)',
          data: sleep,
          borderColor: '#a78bfa',
          backgroundColor: 'transparent',
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#a78bfa',
          borderWidth: 2
        },
        {
          label: 'Study (hrs)',
          data: study,
          borderColor: '#60a5fa',
          backgroundColor: 'transparent',
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#60a5fa',
          borderWidth: 2,
          borderDash: [5, 3]
        }
      ]
    },
    options: dualOpts
  });
}


/*4. HEATMAP*/

function prodColor(p) {
  if (p >= 9) return '#22c55e';
  if (p >= 7) return '#84cc16';
  if (p >= 5) return '#eab308';
  if (p >= 3) return '#f97316';
  return '#ef4444';
}

function generateHeatmap() {
  var container = document.getElementById('heatmap');
  container.innerHTML = '';

  if (!filteredData.length) {
    var empty = document.createElement('div');
    empty.style.cssText = 'font-size:0.8rem;color:#475569;padding:8px 0;width:100%';
    empty.textContent = 'No data yet — add entries to see your heatmap.';
    container.appendChild(empty);
    return;
  }

  filteredData.forEach(function(d) {
    var cell = document.createElement('div');
    cell.className        = 'hm-cell';
    cell.style.background = prodColor(d.productivity);
    cell.setAttribute('role',       'listitem');
    cell.setAttribute('aria-label', d.date + ', productivity ' + d.productivity + ' out of 10');

    var tip = document.createElement('div');
    tip.className   = 'hm-tooltip';
    tip.textContent = d.date + '  ·  ' + d.productivity + '/10';
    tip.setAttribute('aria-hidden', 'true');

    cell.appendChild(tip);
    container.appendChild(cell);
  });
}


/*5. TODO*/

var todos = [];

function saveTodos() {
  safeStore(userKey('todos'), todos);
}

function addTodo() {
  var input = document.getElementById('todo-input');
  var text  = input.value.trim();
  if (!text) return;
  if (text.length > 120) { toast('⚠️ Task text is too long (max 120 chars).'); return; }

  todos.unshift({ id: Date.now(), text: text, done: false });
  saveTodos();
  renderTodos();
  input.value = '';
  input.focus();
}

function toggleTodo(id) {
  var t = todos.find(function(t) { return t.id === id; });
  if (t) t.done = !t.done;
  saveTodos();
  renderTodos();
}

function deleteTodo(id) {
  todos = todos.filter(function(t) { return t.id !== id; });
  saveTodos();
  renderTodos();
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function renderTodos() {
  var list = document.getElementById('todo-list');
  list.innerHTML = '';

  todos.forEach(function(t) {
    var li = document.createElement('li');
    li.className = 'todo-item' + (t.done ? ' done' : '');

    var cb = document.createElement('input');
    cb.type      = 'checkbox';
    cb.className = 'todo-check';
    cb.checked   = t.done;
    cb.setAttribute('aria-label', (t.done ? 'Mark incomplete: ' : 'Mark complete: ') + t.text);
    cb.addEventListener('change', function() { toggleTodo(t.id); });

    var label = document.createElement('span');
    label.className   = 'todo-label';
    label.textContent = t.text;

    var del = document.createElement('button');
    del.className = 'todo-del';
    del.setAttribute('aria-label', 'Delete task: ' + t.text);
    del.innerHTML = '&times;';
    del.addEventListener('click', function() { deleteTodo(t.id); });

    li.appendChild(cb);
    li.appendChild(label);
    li.appendChild(del);
    list.appendChild(li);
  });

  /* Progress stats */
  var done  = todos.filter(function(t) { return t.done; }).length;
  var total = todos.length;
  var pct   = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('todo-count').textContent      = total + ' task' + (total !== 1 ? 's' : '');
  document.getElementById('todo-done-count').textContent = done + ' done';
  document.getElementById('todo-bar').style.width        = pct + '%';

  var wrapper = document.getElementById('progress-bar-wrapper');
  if (wrapper) wrapper.setAttribute('aria-valuenow', String(pct));
}


/*6. APP */

console.log('%c HabitIQ ✓ ', 'background:#6ee7b7;color:#080c14;font-weight:700;border-radius:4px;padding:2px 6px;');