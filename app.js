// IoT QC Dashboard — Frontend & Simulator Engine (Clean Classic Blue & Emerald)
// ------------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Helper render icons
  function safeRenderIcons() {
    try {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    } catch (e) {}
  }

  safeRenderIcons();

  // --- THEME MANAGEMENT (Light / Dark Mode) ---
  const htmlRoot = document.documentElement;
  const btnToggleTheme = document.getElementById('btn-toggle-theme');
  const themeIcon = document.getElementById('theme-icon');

  function applyTheme(theme) {
    try {
      if (theme === 'dark') {
        htmlRoot.classList.add('dark');
        if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
      } else {
        htmlRoot.classList.remove('dark');
        if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
      }
      localStorage.setItem('iot_qc_theme', theme);
      safeRenderIcons();
      updateChartTheme();
    } catch (e) {}
  }

  const savedTheme = localStorage.getItem('iot_qc_theme') || 'light';
  applyTheme(savedTheme);

  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', () => {
      const isDark = htmlRoot.classList.contains('dark');
      applyTheme(isDark ? 'light' : 'dark');
    });
  }

  // --- AUDIO SYNTHESIS ---
  let audioCtx = null;
  let isSoundEnabled = true;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
  }

  function playTone(freq, type, duration, count = 1) {
    if (!isSoundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start();
            osc.stop(audioCtx.currentTime + duration);
          } catch (err) {}
        }, i * (duration * 1000 + 80));
      }
    } catch (e) {}
  }

  const playPassBeep = () => playTone(880, 'sine', 0.08);
  const playDefectAlarm = () => playTone(350, 'sawtooth', 0.22, 2);
  const playResetBeep = () => playTone(520, 'triangle', 0.1);

  // --- TOAST NOTIFICATIONS ---
  const toastEl = document.getElementById('toast-notification');
  const toastMsg = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');
  let toastTimer = null;

  function showToast(message, type = 'success') {
    if (!toastEl || !toastMsg) return;
    if (toastTimer) clearTimeout(toastTimer);

    toastMsg.textContent = message;
    if (toastIcon) {
      if (type === 'success') {
        toastIcon.setAttribute('data-lucide', 'check-circle');
        toastIcon.className = 'w-4 h-4 text-emerald-400';
      } else if (type === 'warn') {
        toastIcon.setAttribute('data-lucide', 'alert-circle');
        toastIcon.className = 'w-4 h-4 text-red-400';
      } else {
        toastIcon.setAttribute('data-lucide', 'info');
        toastIcon.className = 'w-4 h-4 text-blue-400';
      }
      safeRenderIcons();
    }

    toastEl.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    toastEl.classList.add('translate-y-0', 'opacity-100');

    toastTimer = setTimeout(() => {
      toastEl.classList.remove('translate-y-0', 'opacity-100');
      toastEl.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    }, 2800);
  }

  // --- APPLICATION STATE ---
  const STORAGE_KEY = 'iot_qc_detection_data_v1';
  let state = {
    total: 0,
    pass: 0,
    defect: 0,
    speedHistory: [],
    logs: []
  };

  let currentPage = 1;
  let rowsPerPage = 10;

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        state = JSON.parse(saved);
      }
    } catch (e) {
      state = { total: 0, pass: 0, defect: 0, speedHistory: [], logs: [], minOk: 4.0, maxOk: 7.0 };
    }
    if (state.minOk === undefined) state.minOk = 4.0;
    if (state.maxOk === undefined) state.maxOk = 7.0;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  loadState();

  // --- DYNAMIC THRESHOLD EVALUATION ---
  function evaluateItemQuality(distance, customDefectType) {
    const minOk = state.minOk !== undefined ? state.minOk : 4.0;
    const maxOk = state.maxOk !== undefined ? state.maxOk : 7.0;
    const distNum = parseFloat(distance);

    let status = 'PASS';
    let defectType = customDefectType || `Dimensi Standar (${minOk.toFixed(1)} - ${maxOk.toFixed(1)} cm)`;
    let action = 'Lolos ke Packaging';

    if (distNum < minOk) {
      status = 'DEFECT';
      defectType = customDefectType || `Dimensi Terlalu Tebal / Tonjolan (< ${minOk.toFixed(1)} cm)`;
      action = 'Dorong ke Kotak Reject';
    } else if (distNum > maxOk) {
      status = 'DEFECT';
      defectType = customDefectType || `Dimensi Penyok / Cekung (> ${maxOk.toFixed(1)} cm)`;
      action = 'Dorong ke Kotak Reject';
    }

    return { status, defectType, action };
  }

  // --- DOM ELEMENTS ---
  const elTotal = document.getElementById('metric-total');
  const elPass = document.getElementById('metric-pass');
  const elPassPct = document.getElementById('metric-pass-pct');
  const elDefect = document.getElementById('metric-defect');
  const elDefectPct = document.getElementById('metric-defect-pct');
  const elSpeed = document.getElementById('metric-speed');
  
  const elTableBody = document.getElementById('log-table-body');
  const elSearchInput = document.getElementById('log-search-input');
  const elFilterSelect = document.getElementById('log-filter-select');
  const chartBatchFilter = document.getElementById('chart-batch-filter');
  const paginationInfo = document.getElementById('pagination-info');
  const paginationLimitSelect = document.getElementById('pagination-limit-select');
  const btnPagePrev = document.getElementById('btn-page-prev');
  const btnPageNext = document.getElementById('btn-page-next');
  const paginationNumbers = document.getElementById('pagination-numbers');

  const sliderMinOk = document.getElementById('slider-min-ok');
  const sliderMaxOk = document.getElementById('slider-max-ok');
  const labelMinOk = document.getElementById('label-min-ok');
  const labelMaxOk = document.getElementById('label-max-ok');
  const zoneMinOk = document.getElementById('zone-min-ok');
  const zoneMaxOk = document.getElementById('zone-max-ok');
  const presetSmall = document.getElementById('preset-small');
  const presetMedium = document.getElementById('preset-medium');
  const presetLarge = document.getElementById('preset-large');

  const elSoundBtn = document.getElementById('btn-toggle-sound');
  const elSoundIcon = document.getElementById('sound-icon');
  const elLiveClock = document.getElementById('live-clock');
  const elLiveDate = document.getElementById('live-date');

  const elSensorBeam = document.getElementById('sensor-beam');
  const elSensorState = document.getElementById('ir-sensor-state');
  const elVirtualItem = document.getElementById('virtual-item');
  const elInspectionFeedback = document.getElementById('inspection-feedback');

  const btnSimPass = document.getElementById('btn-sim-pass');
  const btnSimDefect = document.getElementById('btn-sim-defect');
  const btnAutoSim = document.getElementById('btn-auto-sim');
  const autoSimText = document.getElementById('auto-sim-text');
  const autoSimIcon = document.getElementById('auto-sim-icon');
  const autoSimSettings = document.getElementById('auto-sim-settings');
  const simSpeedRange = document.getElementById('sim-speed-range');
  const simSpeedVal = document.getElementById('sim-speed-val');
  const simDefectRange = document.getElementById('sim-defect-range');
  const simDefectVal = document.getElementById('sim-defect-val');
  const btnToggleSimPanel = document.getElementById('btn-toggle-sim-panel');
  const btnCloseSimPanel = document.getElementById('btn-close-sim-panel');
  const simPanelSection = document.getElementById('sim-panel-section');
  const simToggleHeaderIcon = document.getElementById('sim-toggle-header-icon');

  const btnOpenCustomModal = document.getElementById('btn-open-custom-modal');
  const customInputModal = document.getElementById('custom-input-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const customInputForm = document.getElementById('custom-input-form');

  const resetConfirmModal = document.getElementById('reset-confirm-modal');
  const btnCloseResetModal = document.getElementById('btn-close-reset-modal');
  const btnCancelResetModal = document.getElementById('btn-cancel-reset-modal');
  const btnActionResetAll = document.getElementById('btn-action-reset-all');
  const btnActionClearLogs = document.getElementById('btn-action-clear-logs');
  const btnActionLoadDemo = document.getElementById('btn-action-load-demo');
  const btnClearTableOnly = document.getElementById('btn-clear-table-only');
  const resetTriggerBtns = document.querySelectorAll('.btn-trigger-reset');

  // --- LIVE CLOCK ---
  function updateClock() {
    try {
      const now = new Date();
      if (elLiveClock) elLiveClock.textContent = now.toLocaleTimeString('id-ID');
      if (elLiveDate) {
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        elLiveDate.textContent = now.toLocaleDateString('id-ID', options);
      }
    } catch (e) {}
  }
  setInterval(updateClock, 1000);
  updateClock();

  // --- SOUND TOGGLE ---
  if (elSoundBtn) {
    elSoundBtn.addEventListener('click', () => {
      isSoundEnabled = !isSoundEnabled;
      if (elSoundIcon) elSoundIcon.setAttribute('data-lucide', isSoundEnabled ? 'volume-2' : 'volume-x');
      elSoundBtn.classList.toggle('opacity-50', !isSoundEnabled);
      safeRenderIcons();
    });
  }

  // --- THRESHOLD CALIBRATION CONTROLS & SERVER SYNC ---
  async function syncCalibrationToServer(minVal, maxVal) {
    try {
      await fetch('/api/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minOk: minVal, maxOk: maxVal })
      });
    } catch(e) {
      // Offline / standalone mode
    }
  }

  function updateThresholdUI() {
    const minOk = state.minOk !== undefined ? state.minOk : 4.0;
    const maxOk = state.maxOk !== undefined ? state.maxOk : 7.0;

    if (sliderMinOk) sliderMinOk.value = minOk;
    if (sliderMaxOk) sliderMaxOk.value = maxOk;
    if (labelMinOk) labelMinOk.textContent = `${minOk.toFixed(1)} cm`;
    if (labelMaxOk) labelMaxOk.textContent = `${maxOk.toFixed(1)} cm`;
    if (zoneMinOk) zoneMinOk.textContent = `${minOk.toFixed(1)} cm`;
    if (zoneMaxOk) zoneMaxOk.textContent = `${maxOk.toFixed(1)} cm`;
  }

  function setThreshold(minVal, maxVal) {
    if (minVal >= maxVal) return;
    state.minOk = minVal;
    state.maxOk = maxVal;
    saveState();
    updateThresholdUI();
    syncCalibrationToServer(minVal, maxVal);
    showToast(`Batas Mutu Diperbarui: ${minVal.toFixed(1)} cm – ${maxVal.toFixed(1)} cm (OK)`, 'info');
  }

  if (sliderMinOk) {
    sliderMinOk.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (val < (state.maxOk || 7.0)) {
        state.minOk = val;
        saveState();
        updateThresholdUI();
        syncCalibrationToServer(state.minOk, state.maxOk || 7.0);
      }
    });
  }

  if (sliderMaxOk) {
    sliderMaxOk.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (val > (state.minOk || 4.0)) {
        state.maxOk = val;
        saveState();
        updateThresholdUI();
        syncCalibrationToServer(state.minOk || 4.0, state.maxOk);
      }
    });
  }

  if (presetSmall) presetSmall.addEventListener('click', () => setThreshold(3.0, 5.0));
  if (presetMedium) presetMedium.addEventListener('click', () => setThreshold(4.0, 7.0));
  if (presetLarge) presetLarge.addEventListener('click', () => setThreshold(6.0, 10.0));

  // --- CHARTS INITIALIZATION ---
  let doughnutChart = null;
  let trendChart = null;

  function getThemeColors() {
    const isDark = htmlRoot.classList.contains('dark');
    return {
      textColor: isDark ? '#94a3b8' : '#64748b',
      gridColor: isDark ? '#1e293b' : '#f1f5f9',
      doughnutBorder: isDark ? '#0f172a' : '#ffffff'
    };
  }

  function initCharts() {
    if (typeof Chart === 'undefined') return;

    try {
      const colors = getThemeColors();

      // 1. Doughnut Chart
      const canvasDoughnut = document.getElementById('qualityDoughnutChart');
      if (canvasDoughnut) {
        const ctxDoughnut = canvasDoughnut.getContext('2d');
        doughnutChart = new Chart(ctxDoughnut, {
          type: 'doughnut',
          data: {
            labels: ['Barang Lolos (OK)', 'Barang Cacat (Defect)'],
            datasets: [{
              data: [state.pass || 1, state.defect || 0],
              backgroundColor: ['#16a34a', '#dc2626'],
              borderColor: colors.doughnutBorder,
              borderWidth: 3,
              hoverOffset: 5
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: colors.textColor,
                  font: { family: '"Plus Jakarta Sans"', size: 11, weight: '600' },
                  padding: 14
                }
              }
            }
          }
        });
      }

      // 2. Trend Line Chart
      const canvasTrend = document.getElementById('inspectionTrendChart');
      if (canvasTrend) {
        const ctxTrend = canvasTrend.getContext('2d');
        const filterVal = chartBatchFilter ? chartBatchFilter.value : '10';
        let recentLogs;
        if (filterVal === 'ALL') {
          recentLogs = state.logs || [];
        } else {
          const limit = parseInt(filterVal, 10) || 10;
          recentLogs = (state.logs || []).slice(-limit);
        }

        const labels = recentLogs.length ? recentLogs.map(l => (l.timestamp && l.timestamp.split(' ')[1]) || l.timestamp) : ['--:--:--'];
        const distanceValues = recentLogs.length ? recentLogs.map(l => l.distance !== undefined ? l.distance : (l.irVal ? +(l.irVal / 25).toFixed(1) : 5.2)) : [5.2];

        const gradient = ctxTrend.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.2)');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

        trendChart = new Chart(ctxTrend, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Jarak Objek (cm)',
              data: distanceValues,
              borderColor: '#2563eb',
              backgroundColor: gradient,
              fill: true,
              tension: 0.35,
              borderWidth: 2.5,
              pointBackgroundColor: recentLogs.map(l => l.status === 'PASS' ? '#16a34a' : '#dc2626'),
              pointBorderColor: '#ffffff',
              pointBorderWidth: 1.5,
              pointRadius: 4.5,
              pointHoverRadius: 6.5
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                grid: { color: colors.gridColor },
                ticks: { color: colors.textColor, font: { size: 10 } }
              },
              y: {
                grid: { color: colors.gridColor },
                ticks: { 
                  color: colors.textColor, 
                  font: { size: 10 },
                  callback: function(val) { return val + ' cm'; }
                },
                min: 0,
                max: 20
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function(ctx) { return ' Jarak: ' + ctx.parsed.y + ' cm'; }
                }
              }
            }
          }
        });
      }
    } catch (e) {}
  }

  function updateChartTheme() {
    if (!doughnutChart || !trendChart) return;
    try {
      const colors = getThemeColors();

      doughnutChart.options.plugins.legend.labels.color = colors.textColor;
      doughnutChart.data.datasets[0].borderColor = colors.doughnutBorder;
      doughnutChart.update();

      trendChart.options.scales.x.grid.color = colors.gridColor;
      trendChart.options.scales.x.ticks.color = colors.textColor;
      trendChart.options.scales.y.grid.color = colors.gridColor;
      trendChart.options.scales.y.ticks.color = colors.textColor;
      trendChart.update();
    } catch (e) {}
  }

  function updateCharts() {
    if (!doughnutChart || !trendChart) return;
    try {
      if (state.total === 0) {
        doughnutChart.data.datasets[0].data = [1, 0];
      } else {
        doughnutChart.data.datasets[0].data = [state.pass, state.defect];
      }
      doughnutChart.update();

      const filterVal = chartBatchFilter ? chartBatchFilter.value : '10';
      let recent;
      if (filterVal === 'ALL') {
        recent = state.logs || [];
      } else {
        const limit = parseInt(filterVal, 10) || 10;
        recent = (state.logs || []).slice(-limit);
      }
      trendChart.data.labels = recent.length ? recent.map(l => (l.timestamp && l.timestamp.split(' ')[1]) || l.timestamp) : ['--:--:--'];
      trendChart.data.datasets[0].data = recent.length ? recent.map(l => l.distance !== undefined ? l.distance : (l.irVal ? +(l.irVal / 25).toFixed(1) : 5.2)) : [5.2];
      trendChart.data.datasets[0].pointBackgroundColor = recent.length ? recent.map(l => l.status === 'PASS' ? '#16a34a' : '#dc2626') : ['#2563eb'];
      trendChart.update();
    } catch (e) {}
  }

  if (chartBatchFilter) {
    chartBatchFilter.addEventListener('change', () => {
      updateCharts();
      const val = chartBatchFilter.value;
      const label = val === 'ALL' ? 'Semua Data' : `${val} Data Terakhir`;
      showToast(`Grafik menampilkan: ${label}`, 'info');
    });
  }

  // --- METRICS & UI UPDATE ---
  function updateMetricsUI() {
    if (elTotal) elTotal.textContent = state.total;
    if (elPass) elPass.textContent = state.pass;
    if (elDefect) elDefect.textContent = state.defect;

    const passPct = state.total > 0 ? Math.round((state.pass / state.total) * 100) : 100;
    const defectPct = state.total > 0 ? Math.round((state.defect / state.total) * 100) : 0;

    if (elPassPct) elPassPct.textContent = `${passPct}%`;
    if (elDefectPct) elDefectPct.textContent = `${defectPct}%`;

    calculateInspectionSpeed();
    renderTable();
    updateCharts();
    saveState();
  }

  function calculateInspectionSpeed() {
    const now = Date.now();
    state.speedHistory = (state.speedHistory || []).filter(ts => now - ts < 60000);
    const speed = state.speedHistory.length;
    if (elSpeed) elSpeed.textContent = speed;
  }
  setInterval(calculateInspectionSpeed, 5000);

  // --- LOG TABLE RENDERING WITH PAGINATION ---
  function renderTable() {
    if (!elTableBody) return;
    const query = elSearchInput ? elSearchInput.value.toLowerCase().trim() : '';
    const filter = elFilterSelect ? elFilterSelect.value : 'ALL';

    const logs = state.logs || [];
    const filteredLogs = logs.filter(log => {
      const matchQuery = !query || 
                         (log.id && log.id.toLowerCase().includes(query)) ||
                         (log.defectType && log.defectType.toLowerCase().includes(query)) ||
                         (log.status && log.status.toLowerCase().includes(query));
      const matchFilter = filter === 'ALL' || log.status === filter;
      return matchQuery && matchFilter;
    });

    const totalFiltered = filteredLogs.length;

    if (totalFiltered === 0) {
      elTableBody.innerHTML = `
        <tr class="text-center text-slate-400">
          <td colspan="6" class="py-8 font-sans">
            ${logs.length === 0 ? 'Belum ada data inspeksi. Gunakan tombol simulator atau sambungkan ESP32.' : 'Tidak ada data yang cocok dengan pencarian / filter.'}
          </td>
        </tr>
      `;
      if (paginationInfo) paginationInfo.textContent = 'Menampilkan 0 - 0 dari 0 data';
      if (paginationNumbers) paginationNumbers.innerHTML = '';
      if (btnPagePrev) btnPagePrev.disabled = true;
      if (btnPageNext) btnPageNext.disabled = true;
      return;
    }

    const limit = rowsPerPage === 'ALL' ? totalFiltered : rowsPerPage;
    const totalPages = rowsPerPage === 'ALL' ? 1 : Math.max(1, Math.ceil(totalFiltered / limit));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const reversedLogs = [...filteredLogs].reverse();
    const startIndex = (currentPage - 1) * limit;
    const endIndex = rowsPerPage === 'ALL' ? totalFiltered : Math.min(startIndex + limit, totalFiltered);
    const pageLogs = reversedLogs.slice(startIndex, endIndex);

    const rowsHtml = pageLogs.map((log) => {
      const isPass = log.status === 'PASS';
      const distDisplay = log.distance !== undefined ? log.distance : (log.irVal ? (log.irVal / 25).toFixed(1) : '5.2');
      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 font-semibold ${isPass ? 'text-slate-800 dark:text-slate-200' : 'text-red-600 dark:text-red-400'}">
            ${log.id || 'N/A'}
          </td>
          <td class="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">${log.timestamp || '--'}</td>
          <td class="py-3 px-4">
            <span class="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono font-semibold text-[11px]">
              ${distDisplay} cm
            </span>
          </td>
          <td class="py-3 px-4">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
              isPass
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800 animate-pulse'
            }">
              <span class="w-1.5 h-1.5 rounded-full ${isPass ? 'bg-emerald-600' : 'bg-red-600'}"></span>
              ${isPass ? 'LOLOS' : 'CACAT'}
            </span>
          </td>
          <td class="py-3 px-4 text-slate-700 dark:text-slate-300">${log.defectType || '-'}</td>
          <td class="py-3 px-4">
            <span class="text-[11px] ${isPass ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400 font-semibold'}">
              ${log.action || '-'}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    elTableBody.innerHTML = rowsHtml;

    if (paginationInfo) {
      paginationInfo.textContent = `Menampilkan ${startIndex + 1} - ${endIndex} dari ${totalFiltered} data`;
    }

    if (btnPagePrev) btnPagePrev.disabled = currentPage === 1;
    if (btnPageNext) btnPageNext.disabled = currentPage === totalPages;

    renderPaginationButtons(totalPages);
  }

  function renderPaginationButtons(totalPages) {
    if (!paginationNumbers) return;
    if (totalPages <= 1) {
      paginationNumbers.innerHTML = '';
      return;
    }

    let buttonsHtml = '';
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      const isActive = p === currentPage;
      buttonsHtml += `
        <button data-page="${p}" class="pagination-page-btn w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition ${
          isActive 
            ? 'bg-blue-600 text-white' 
            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }">
          ${p}
        </button>
      `;
    }

    paginationNumbers.innerHTML = buttonsHtml;

    paginationNumbers.querySelectorAll('.pagination-page-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(e.currentTarget.getAttribute('data-page'), 10);
        if (page && page !== currentPage) {
          currentPage = page;
          renderTable();
        }
      });
    });
  }

  if (btnPagePrev) {
    btnPagePrev.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });
  }

  if (btnPageNext) {
    btnPageNext.addEventListener('click', () => {
      currentPage++;
      renderTable();
    });
  }

  if (paginationLimitSelect) {
    paginationLimitSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      rowsPerPage = val === 'ALL' ? 'ALL' : parseInt(val, 10);
      currentPage = 1;
      renderTable();
    });
  }

  if (elSearchInput) {
    elSearchInput.addEventListener('input', () => {
      currentPage = 1;
      renderTable();
    });
  }

  if (elFilterSelect) {
    elFilterSelect.addEventListener('change', () => {
      currentPage = 1;
      renderTable();
    });
  }

  // --- CORE INSPECTION EVENT HANDLER ---
  function processInspectionEvent(itemData) {
    const isPass = itemData.status === 'PASS';

    state.speedHistory = state.speedHistory || [];
    state.speedHistory.push(Date.now());
    state.total = (state.total || 0) + 1;
    if (isPass) {
      state.pass = (state.pass || 0) + 1;
    } else {
      state.defect = (state.defect || 0) + 1;
    }

    state.logs = state.logs || [];
    state.logs.push(itemData);
    runConveyorAnimation(itemData);

    if (isPass) {
      playPassBeep();
    } else {
      playDefectAlarm();
    }

    if (typeof forwardToThingsBoard === 'function') {
      forwardToThingsBoard(itemData);
    }

    if (typeof pushToFirebase === 'function') {
      pushToFirebase(itemData);
    }

    updateMetricsUI();
  }

  // --- CONVEYOR & SENSOR ANIMATION ---
  function runConveyorAnimation(itemData) {
    if (!elVirtualItem) return;
    const isPass = itemData.status === 'PASS';

    elVirtualItem.style.transition = 'transform 0.4s ease-out';
    elVirtualItem.style.transform = 'translateX(340px)';
    elVirtualItem.className = `absolute left-[-70px] w-12 h-8 rounded-lg border flex items-center justify-center text-white font-bold text-xs shadow-sm transition-transform ${
      isPass ? 'bg-emerald-600 border-emerald-400' : 'bg-red-600 border-red-400 alert-flash'
    }`;

    setTimeout(() => {
      if (elSensorBeam) {
        elSensorBeam.className = `w-1.5 h-12 transition-all duration-200 mt-1 rounded-full ${
          isPass ? 'beam-pass' : 'beam-defect'
        }`;
      }
      if (elSensorState) {
        elSensorState.textContent = isPass ? 'Barang Normal (OK)' : 'Cacat Terdeteksi!';
        elSensorState.className = `px-3 py-1 rounded-full text-xs font-semibold ${
          isPass ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/60 dark:text-red-300 animate-pulse'
        }`;
      }

      if (elInspectionFeedback) {
        elInspectionFeedback.innerHTML = `
          <span class="w-2 h-2 rounded-full ${isPass ? 'bg-emerald-500' : 'bg-red-500'}"></span>
          <span class="${isPass ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-red-700 dark:text-red-400 font-bold'}">
            ${itemData.id}: ${isPass ? 'Permukaan Normal (Lolos)' : itemData.defectType + ' (Disortir)'}
          </span>
        `;
      }
    }, 400);

    setTimeout(() => {
      elVirtualItem.style.transition = 'transform 0.45s ease-in';
      elVirtualItem.style.transform = 'translateX(720px)';
    }, 850);

    setTimeout(() => {
      if (elSensorBeam) elSensorBeam.className = 'w-1.5 h-12 bg-slate-300 dark:bg-slate-700 transition-all duration-200 mt-1 rounded-full opacity-60';
      if (elSensorState) {
        elSensorState.textContent = 'Menunggu Barang...';
        elSensorState.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      }
      elVirtualItem.style.transition = 'none';
      elVirtualItem.style.transform = 'translateX(0px)';
    }, 1400);
  }

  // --- MANUAL SIMULATION ---
  function generateRandomId() {
    const num = Math.floor(100 + Math.random() * 900);
    return `BRG-${num}`;
  }

  function getFormattedTimestamp(dateOffsetMinutes = 0) {
    const now = new Date(Date.now() - dateOffsetMinutes * 60000);
    return now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }) + ' ' + now.toLocaleTimeString('id-ID');
  }

  if (btnSimPass) {
    btnSimPass.addEventListener('click', () => {
      initAudio();
      const minOk = state.minOk || 4.0;
      const maxOk = state.maxOk || 7.0;
      const range = Math.max(0.5, maxOk - minOk - 0.4);
      const dist = +(minOk + 0.2 + Math.random() * range).toFixed(1);
      const evalRes = evaluateItemQuality(dist);
      const item = {
        id: generateRandomId(),
        timestamp: getFormattedTimestamp(),
        distance: dist,
        irVal: Math.round(dist * 25),
        status: evalRes.status,
        defectType: evalRes.defectType,
        action: evalRes.action
      };
      processInspectionEvent(item);
    });
  }

  if (btnSimDefect) {
    btnSimDefect.addEventListener('click', () => {
      initAudio();
      const minOk = state.minOk || 4.0;
      const maxOk = state.maxOk || 7.0;
      const isTooThick = Math.random() > 0.5;
      const dist = isTooThick 
        ? +(Math.max(0.8, minOk - 0.8 - Math.random() * 1.5)).toFixed(1) 
        : +(maxOk + 1.2 + Math.random() * 4.0).toFixed(1);
      const evalRes = evaluateItemQuality(dist);
      const item = {
        id: generateRandomId(),
        timestamp: getFormattedTimestamp(),
        distance: dist,
        irVal: Math.round(dist * 25),
        status: evalRes.status,
        defectType: evalRes.defectType,
        action: evalRes.action
      };
      processInspectionEvent(item);
    });
  }

  // --- TOGGLE / OPEN-CLOSE SIMULATION PANEL ---
  function toggleSimPanel(forceOpen) {
    if (!simPanelSection) return;
    const isHidden = simPanelSection.classList.contains('hidden');
    const shouldOpen = forceOpen !== undefined ? forceOpen : isHidden;

    if (shouldOpen) {
      simPanelSection.classList.remove('hidden');
      if (btnToggleSimPanel) {
        btnToggleSimPanel.classList.add('bg-blue-50', 'border-blue-300', 'text-blue-700', 'dark:bg-blue-950/60', 'dark:border-blue-800', 'dark:text-blue-300');
      }
      if (simToggleHeaderIcon) {
        simToggleHeaderIcon.classList.add('rotate-180');
      }
      simPanelSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      simPanelSection.classList.add('hidden');
      if (btnToggleSimPanel) {
        btnToggleSimPanel.classList.remove('bg-blue-50', 'border-blue-300', 'text-blue-700', 'dark:bg-blue-950/60', 'dark:border-blue-800', 'dark:text-blue-300');
      }
      if (simToggleHeaderIcon) {
        simToggleHeaderIcon.classList.remove('rotate-180');
      }
    }
    safeRenderIcons();
  }

  if (btnToggleSimPanel) {
    btnToggleSimPanel.addEventListener('click', () => toggleSimPanel());
  }
  if (btnCloseSimPanel) {
    btnCloseSimPanel.addEventListener('click', () => toggleSimPanel(false));
  }

  // --- AUTO SIMULATION ---
  let autoSimInterval = null;
  let isAutoSimActive = false;

  if (btnAutoSim) {
    btnAutoSim.addEventListener('click', () => {
      initAudio();
      isAutoSimActive = !isAutoSimActive;

      if (isAutoSimActive) {
        if (autoSimText) autoSimText.textContent = 'Hentikan Simulasi';
        if (autoSimIcon) autoSimIcon.setAttribute('data-lucide', 'square');
        btnAutoSim.classList.replace('bg-slate-100', 'bg-amber-500');
        btnAutoSim.classList.replace('text-slate-800', 'text-white');
        if (autoSimSettings) {
          autoSimSettings.classList.remove('hidden');
          autoSimSettings.classList.add('grid');
        }
        startAutoSimulation();
      } else {
        if (autoSimText) autoSimText.textContent = 'Mulai Auto Simulasi';
        if (autoSimIcon) autoSimIcon.setAttribute('data-lucide', 'play');
        btnAutoSim.classList.replace('bg-amber-500', 'bg-slate-100');
        btnAutoSim.classList.replace('text-white', 'text-slate-800');
        if (autoSimSettings) {
          autoSimSettings.classList.add('hidden');
          autoSimSettings.classList.remove('grid');
        }
        stopAutoSimulation();
      }
      safeRenderIcons();
    });
  }

  function startAutoSimulation() {
    stopAutoSimulation();
    const speedMs = simSpeedRange ? parseInt(simSpeedRange.value, 10) : 1500;
    autoSimInterval = setInterval(() => {
      const defectChance = simDefectRange ? parseInt(simDefectRange.value, 10) / 100 : 0.25;
      const isDefect = Math.random() < defectChance;

      if (isDefect && btnSimDefect) {
        btnSimDefect.click();
      } else if (btnSimPass) {
        btnSimPass.click();
      }
    }, speedMs);
  }

  function stopAutoSimulation() {
    if (autoSimInterval) {
      clearInterval(autoSimInterval);
      autoSimInterval = null;
    }
  }

  if (simSpeedRange) {
    simSpeedRange.addEventListener('input', (e) => {
      if (simSpeedVal) simSpeedVal.textContent = `${(e.target.value / 1000).toFixed(1)} detik/item`;
      if (isAutoSimActive) startAutoSimulation();
    });
  }

  if (simDefectRange) {
    simDefectRange.addEventListener('input', (e) => {
      if (simDefectVal) simDefectVal.textContent = `${e.target.value}%`;
    });
  }

  // --- CUSTOM DATA MODAL ---
  if (btnOpenCustomModal && customInputModal) {
    btnOpenCustomModal.addEventListener('click', () => {
      const inputEl = document.getElementById('input-item-id');
      if (inputEl) inputEl.value = generateRandomId();
      customInputModal.classList.remove('hidden');
    });
  }

  function closeModal() {
    if (customInputModal) customInputModal.classList.add('hidden');
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

  if (customInputForm) {
    customInputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      initAudio();
      const idEl = document.getElementById('input-item-id');
      const statusEl = document.getElementById('input-status');
      const defectEl = document.getElementById('input-defect-type');
      const distEl = document.getElementById('input-ir-val');

      const id = (idEl && idEl.value) ? idEl.value : generateRandomId();
      const status = (statusEl && statusEl.value) ? statusEl.value : 'PASS';
      const defectType = (defectEl && defectEl.value) ? defectEl.value : 'Dimensi Sesuai Standar (Normal)';
      const dist = distEl ? parseFloat(distEl.value) || 5.2 : 5.2;

      const item = {
        id: id,
        timestamp: getFormattedTimestamp(),
        distance: dist,
        irVal: Math.round(dist * 25),
        status: status,
        defectType: defectType,
        action: status === 'PASS' ? 'Lolos ke Packaging' : 'Dorong ke Kotak Reject'
      };

      processInspectionEvent(item);
      closeModal();
      showToast(`Data ${id} berhasil ditambahkan!`, 'success');
    });
  }

  // --- RESET DATA SYSTEM ---
  function openResetModal() {
    if (resetConfirmModal) resetConfirmModal.classList.remove('hidden');
  }

  function closeResetModal() {
    if (resetConfirmModal) resetConfirmModal.classList.add('hidden');
  }

  resetTriggerBtns.forEach(btn => {
    btn.addEventListener('click', openResetModal);
  });

  if (btnCloseResetModal) btnCloseResetModal.addEventListener('click', closeResetModal);
  if (btnCancelResetModal) btnCancelResetModal.addEventListener('click', closeResetModal);

  if (btnActionResetAll) {
    btnActionResetAll.addEventListener('click', () => {
      stopAutoSimulation();
      if (isAutoSimActive && btnAutoSim) {
        btnAutoSim.click();
      }

      state = {
        total: 0,
        pass: 0,
        defect: 0,
        speedHistory: [],
        logs: []
      };

      currentPage = 1;
      saveState();
      updateMetricsUI();
      playResetBeep();
      closeResetModal();
      showToast('✓ Seluruh data berhasil di-reset!', 'success');
    });
  }

  if (btnActionClearLogs) {
    btnActionClearLogs.addEventListener('click', () => {
      state.logs = [];
      currentPage = 1;
      saveState();
      updateMetricsUI();
      playResetBeep();
      closeResetModal();
      showToast('✓ Tabel riwayat log berhasil dibersihkan!', 'warn');
    });
  }

  if (btnActionLoadDemo) {
    btnActionLoadDemo.addEventListener('click', () => {
      state.total = 10;
      state.pass = 8;
      state.defect = 2;
      state.speedHistory = [Date.now(), Date.now() - 5000, Date.now() - 10000];
      
      state.logs = [
        { id: 'BRG-101', timestamp: getFormattedTimestamp(18), distance: 5.2, irVal: 130, status: 'PASS', defectType: 'Dimensi Normal (5.2 cm)', action: 'Lolos ke Packaging' },
        { id: 'BRG-102', timestamp: getFormattedTimestamp(16), distance: 5.4, irVal: 135, status: 'PASS', defectType: 'Dimensi Normal (5.4 cm)', action: 'Lolos ke Packaging' },
        { id: 'BRG-103', timestamp: getFormattedTimestamp(14), distance: 2.1, irVal: 52, status: 'DEFECT', defectType: 'Dimensi Terlalu Tebal / Tonjolan', action: 'Dorong ke Kotak Reject' },
        { id: 'BRG-104', timestamp: getFormattedTimestamp(12), distance: 5.1, irVal: 128, status: 'PASS', defectType: 'Dimensi Normal (5.1 cm)', action: 'Lolos ke Packaging' },
        { id: 'BRG-105', timestamp: getFormattedTimestamp(10), distance: 5.5, irVal: 138, status: 'PASS', defectType: 'Dimensi Normal (5.5 cm)', action: 'Lolos ke Packaging' },
        { id: 'BRG-106', timestamp: getFormattedTimestamp(8), distance: 5.3, irVal: 132, status: 'PASS', defectType: 'Dimensi Normal (5.3 cm)', action: 'Lolos ke Packaging' },
        { id: 'BRG-107', timestamp: getFormattedTimestamp(6), distance: 11.8, irVal: 295, status: 'DEFECT', defectType: 'Dimensi Penyok / Cekung', action: 'Dorong ke Kotak Reject' },
        { id: 'BRG-108', timestamp: getFormattedTimestamp(4), distance: 5.2, irVal: 130, status: 'PASS', defectType: 'Dimensi Normal (5.2 cm)', action: 'Lolos ke Packaging' },
        { id: 'BRG-109', timestamp: getFormattedTimestamp(2), distance: 5.6, irVal: 140, status: 'PASS', defectType: 'Dimensi Normal (5.6 cm)', action: 'Lolos ke Packaging' },
        { id: 'BRG-110', timestamp: getFormattedTimestamp(0), distance: 5.0, irVal: 125, status: 'PASS', defectType: 'Dimensi Normal (5.0 cm)', action: 'Lolos ke Packaging' }
      ];

      currentPage = 1;
      saveState();
      updateMetricsUI();
      playPassBeep();
      closeResetModal();
      showToast('✨ 10 Data Demo HC-SR04 berhasil dimuat!', 'success');
    });
  }

  // --- HAPUS & KOSONGKAN DATA REAL (FIREBASE CLOUD & SERVER) ---
  const btnActionWipeCloud = document.getElementById('btn-action-wipe-cloud');
  const btnFirebaseWipe = document.getElementById('btn-firebase-wipe');

  async function wipeRealCloudData() {
    initAudio();
    stopAutoSimulation();

    // 1. Kosongkan Firebase Realtime DB via SDK jika terhubung
    if (firebaseDb) {
      try {
        await firebaseDb.ref('inspections').remove();
      } catch (e) {
        console.warn('Firebase SDK wipe warning:', e);
      }
    }

    // 2. Kosongkan Firebase Realtime DB via direct REST API fallback
    const dbUrl = (firebaseDbUrlInput && firebaseDbUrlInput.value.trim()) || 'https://iot-defect-detection-default-rtdb.asia-southeast1.firebasedatabase.app';
    if (dbUrl) {
      try {
        const cleanUrl = dbUrl.replace(/\/$/, '');
        await fetch(`${cleanUrl}/inspections.json`, { method: 'DELETE' });
      } catch (e) {
        console.warn('Firebase REST wipe warning:', e);
      }
    }

    // 3. Reset Server Backend Lokal jika berjalan
    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch(e){}

    // 4. Reset Seluruh State di Web Dashboard
    state.total = 0;
    state.pass = 0;
    state.defect = 0;
    state.speedHistory = [];
    state.logs = [];
    currentPage = 1;
    saveState();
    updateMetricsUI();
    playResetBeep();
    closeResetModal();
    closeFirebaseModal();

    showToast('🔥 Seluruh Data Real di Google Firebase Cloud Berhasil Dikosongkan!', 'success');
  }

  if (btnActionWipeCloud) btnActionWipeCloud.addEventListener('click', wipeRealCloudData);
  if (btnFirebaseWipe) btnFirebaseWipe.addEventListener('click', wipeRealCloudData);

  if (btnClearTableOnly) {
    btnClearTableOnly.addEventListener('click', () => {
      if (confirm('Bersihkan hanya isi tabel log riwayat? (Angka total counter akan tetap disimpan)')) {
        state.logs = [];
        currentPage = 1;
        saveState();
        updateMetricsUI();
        playResetBeep();
        showToast('✓ Tabel riwayat log telah dikosongkan.', 'warn');
      }
    });
  }

  // --- ESP32 HARDWARE BRIDGE ---
  window.onESP32DataReceived = function (hardwarePayload) {
    const badge = document.getElementById('system-status-badge');
    const badgeText = document.getElementById('system-status-text');

    if (badge && badgeText) {
      badge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold';
      badgeText.textContent = 'Hardware ESP32 Terhubung';
    }

    const dist = (hardwarePayload && hardwarePayload.distance !== undefined) 
      ? parseFloat(hardwarePayload.distance)
      : ((hardwarePayload && hardwarePayload.irVal !== undefined) ? +(hardwarePayload.irVal / 25).toFixed(1) : 5.2);

    const evalRes = evaluateItemQuality(dist, hardwarePayload.defectType);

    const item = {
      id: (hardwarePayload && hardwarePayload.id) || generateRandomId(),
      timestamp: getFormattedTimestamp(),
      distance: dist,
      irVal: (hardwarePayload && hardwarePayload.irVal !== undefined) ? hardwarePayload.irVal : Math.round(dist * 25),
      status: evalRes.status,
      defectType: evalRes.defectType,
      action: evalRes.action
    };

    processInspectionEvent(item);
    showToast(`Data Sensor HC-SR04: ${item.id} (${item.distance} cm - ${item.status})`, item.status === 'PASS' ? 'success' : 'warn');
  };

  // --- DIRECT WEB SERIAL API (1-CLICK DIRECT ESP32 TO BROWSER) ---
  let serialPort = null;
  let serialReader = null;
  let isSerialConnected = false;
  const btnConnectWebSerial = document.getElementById('btn-connect-web-serial');
  const webSerialStatusText = document.getElementById('web-serial-status-text');

  async function connectWebSerial() {
    if (!('serial' in navigator)) {
      alert('Browser ini belum mendukung Web Serial API. Silakan gunakan Google Chrome atau Microsoft Edge terbaru di laptop.');
      return;
    }

    try {
      if (isSerialConnected && serialPort) {
        if (serialReader) {
          try { await serialReader.cancel(); } catch(e){}
          serialReader = null;
        }
        try { await serialPort.close(); } catch(e){}
        serialPort = null;
        isSerialConnected = false;
        if (webSerialStatusText) webSerialStatusText.textContent = '🔌 Sambungkan ESP32 USB';
        if (btnConnectWebSerial) {
          btnConnectWebSerial.className = 'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition active:scale-95';
        }
        showToast('Koneksi USB Serial Terputus.', 'info');
        return;
      }

      // Request COM port from user
      serialPort = await navigator.serial.requestPort();
      await serialPort.open({ baudRate: 115200 });
      isSerialConnected = true;

      if (webSerialStatusText) webSerialStatusText.textContent = '✓ ESP32 USB Terhubung';
      if (btnConnectWebSerial) {
        btnConnectWebSerial.className = 'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition active:scale-95';
      }
      showToast('🎉 ESP32 Berhasil Terhubung Langsung ke Web via USB!', 'success');

      const badge = document.getElementById('system-status-badge');
      const badgeText = document.getElementById('system-status-text');
      if (badge && badgeText) {
        badge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold';
        badgeText.textContent = 'Hardware ESP32 Terhubung';
      }

      const textDecoder = new TextDecoderStream();
      serialPort.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      serialReader = reader;

      let lineBuffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          lineBuffer += value;
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop();

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith('{') && cleanLine.endsWith('}')) {
              try {
                const parsed = JSON.parse(cleanLine);
                window.onESP32DataReceived(parsed);
              } catch (err) {
                console.warn('JSON parse error:', err);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Web Serial Error:', e);
      if (e.name !== 'NotFoundError') {
        showToast(`Gagal konek USB: ${e.message || e}`, 'warn');
      }
      isSerialConnected = false;
      if (webSerialStatusText) webSerialStatusText.textContent = '🔌 Sambungkan ESP32 USB';
      if (btnConnectWebSerial) {
        btnConnectWebSerial.className = 'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition active:scale-95';
      }
    }
  }

  if (btnConnectWebSerial) {
    btnConnectWebSerial.addEventListener('click', connectWebSerial);
  }

  // --- FIREBASE CLOUD REALTIME DATABASE INTEGRATION ---
  let firebaseApp = null;
  let firebaseDb = null;
  let isFirebaseConnected = false;

  const btnOpenFirebaseModal = document.getElementById('btn-open-firebase-modal');
  const firebaseConfigModal = document.getElementById('firebase-config-modal');
  const btnCloseFirebaseModal = document.getElementById('btn-close-firebase-modal');
  const btnCancelFirebaseModal = document.getElementById('btn-cancel-firebase-modal');
  const btnFirebaseDemoConnect = document.getElementById('btn-firebase-demo-connect');
  const btnFirebaseDisconnect = document.getElementById('btn-firebase-disconnect');
  const firebaseStatusText = document.getElementById('firebase-status-text');
  const firebaseDbUrlInput = document.getElementById('firebase-db-url');
  const firebaseApiKeyInput = document.getElementById('firebase-api-key');

  function openFirebaseModal() {
    if (firebaseConfigModal) firebaseConfigModal.classList.remove('hidden');
  }

  function closeFirebaseModal() {
    if (firebaseConfigModal) firebaseConfigModal.classList.add('hidden');
  }

  if (btnOpenFirebaseModal) btnOpenFirebaseModal.addEventListener('click', openFirebaseModal);
  if (btnCloseFirebaseModal) btnCloseFirebaseModal.addEventListener('click', closeFirebaseModal);
  if (btnCancelFirebaseModal) btnCancelFirebaseModal.addEventListener('click', closeFirebaseModal);

  function pushToFirebase(itemData) {
    if (firebaseDb && isFirebaseConnected) {
      try {
        firebaseDb.ref('inspections').push({
          id: itemData.id,
          timestamp: itemData.timestamp,
          distance: itemData.distance !== undefined ? itemData.distance : 5.2,
          status: itemData.status,
          defectType: itemData.defectType,
          action: itemData.action,
          createdAt: Date.now()
        });
      } catch (e) {
        console.warn('Firebase push error:', e);
      }
    }
  }

  function connectFirebase(dbUrl, apiKey) {
    try {
      if (window.firebase && dbUrl) {
        if (!firebase.apps.length) {
          firebaseApp = firebase.initializeApp({
            databaseURL: dbUrl,
            apiKey: apiKey || 'demo-api-key'
          });
        }
        firebaseDb = firebase.database();
        isFirebaseConnected = true;

        if (firebaseStatusText) {
          firebaseStatusText.textContent = 'Firebase: Realtime Cloud';
          if (btnOpenFirebaseModal) {
            btnOpenFirebaseModal.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold';
          }
        }
        showToast('🔥 Google Firebase Realtime Cloud Terhubung!', 'success');
        return true;
      }
    } catch(e) {
      console.warn('Firebase connect warning:', e);
      showToast(`Gagal konek Firebase: ${e.message || e}`, 'warn');
    }
    return false;
  }

  if (btnFirebaseDemoConnect) {
    btnFirebaseDemoConnect.addEventListener('click', () => {
      const url = (firebaseDbUrlInput && firebaseDbUrlInput.value.trim()) || 'https://iot-defect-detection-default-rtdb.asia-southeast1.firebasedatabase.app';
      const key = (firebaseApiKeyInput && firebaseApiKeyInput.value.trim()) || '';
      
      connectFirebase(url, key);
      closeFirebaseModal();
    });
  }

  if (btnFirebaseDisconnect) {
    btnFirebaseDisconnect.addEventListener('click', () => {
      if (firebaseStatusText) {
        firebaseStatusText.textContent = 'Firebase: Standalone';
        if (btnOpenFirebaseModal) {
          btnOpenFirebaseModal.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/60 text-orange-700 dark:text-orange-300 text-xs font-semibold';
        }
      }
      closeFirebaseModal();
      showToast('Mode Standalone (Lokal) Aktif.', 'info');
    });
  }

  // --- THINGSBOARD IOT PLATFORM INTEGRATION ---
  let isTbActive = false;
  let tbHost = 'https://thingsboard.cloud';
  let tbToken = '';

  const btnOpenTbModal = document.getElementById('btn-open-tb-modal');
  const tbConfigModal = document.getElementById('tb-config-modal');
  const btnCloseTbModal = document.getElementById('btn-close-tb-modal');
  const btnCancelTbModal = document.getElementById('btn-cancel-tb-modal');
  const btnTbActivate = document.getElementById('btn-tb-activate');
  const btnTbDeactivate = document.getElementById('btn-tb-deactivate');
  const tbStatusText = document.getElementById('tb-status-text');
  const tbHostUrlInput = document.getElementById('tb-host-url');
  const tbAccessTokenInput = document.getElementById('tb-access-token');

  function openTbModal() {
    if (tbConfigModal) tbConfigModal.classList.remove('hidden');
  }

  function closeTbModal() {
    if (tbConfigModal) tbConfigModal.classList.add('hidden');
  }

  if (btnOpenTbModal) btnOpenTbModal.addEventListener('click', openTbModal);
  if (btnCloseTbModal) btnCloseTbModal.addEventListener('click', closeTbModal);
  if (btnCancelTbModal) btnCancelTbModal.addEventListener('click', closeTbModal);

  async function forwardToThingsBoard(itemData) {
    if (!isTbActive || !tbToken) return;
    try {
      const endpoint = `${tbHost.replace(/\/$/, '')}/api/v1/${tbToken}/telemetry`;
      const payload = {
        itemId: itemData.id,
        distance: itemData.distance !== undefined ? itemData.distance : 5.2,
        status: itemData.status,
        defectType: itemData.defectType,
        totalInspected: state.total || 0,
        passCount: state.pass || 0,
        defectCount: state.defect || 0
      };

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.warn('ThingsBoard stream error:', err));
    } catch (e) {
      console.warn('ThingsBoard forward error:', e);
    }
  }

  if (btnTbActivate) {
    btnTbActivate.addEventListener('click', () => {
      tbHost = (tbHostUrlInput && tbHostUrlInput.value.trim()) || 'https://thingsboard.cloud';
      tbToken = (tbAccessTokenInput && tbAccessTokenInput.value.trim()) || 'DEMO_DEVICE_TOKEN';
      isTbActive = true;

      if (tbStatusText) {
        tbStatusText.textContent = 'ThingsBoard: Active';
        if (btnOpenTbModal) {
          btnOpenTbModal.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-300 text-xs font-semibold';
        }
      }
      closeTbModal();
      showToast('🌐 ThingsBoard Telemetry Stream Aktif!', 'success');
    });
  }

  if (btnTbDeactivate) {
    btnTbDeactivate.addEventListener('click', () => {
      isTbActive = false;
      if (tbStatusText) {
        tbStatusText.textContent = 'ThingsBoard: Standalone';
        if (btnOpenTbModal) {
          btnOpenTbModal.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 text-sky-700 dark:text-sky-300 text-xs font-semibold';
        }
      }
      closeTbModal();
      showToast('ThingsBoard dinonaktifkan (Mode Standalone).', 'info');
    });
  }

  // Initial Startup
  initCharts();
  updateThresholdUI();
  syncCalibrationToServer(state.minOk !== undefined ? state.minOk : 4.0, state.maxOk !== undefined ? state.maxOk : 7.0);
  updateMetricsUI();
});
