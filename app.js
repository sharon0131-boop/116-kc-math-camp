const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxk64iJINxZ21vFKfmANXc4OUUgLuR2VKAogFkuf8c18jchJXEgUHzOTN7Hlym0rhrm/exec"; // 請填入您的網頁應用程式 URL

const STORE_KEY = "zhuoyue-project-desk-2027-v1";
let seed = [], tasks = [], activeTeam = "", editId = null, activeView = "overview", page = 1;
let optionData = { types: [], teams: [], statuses: [] };
const pageSize = 12;
const $ = id => document.getElementById(id);

// 增強版日期處理函式：確保轉為純 YYYY-MM-DD，避免帶入時間或解析失敗
function isoDate(v) { 
  if (!v) return ""; 
  const str = String(v).trim();
  
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.match(/^\d{4}-\d{2}-\d{2}/)[0];
  }
  
  if (str.includes("T")) {
    return str.split("T")[0];
  }
  
  let cleanedStr = str.replace(" GM", " GMT").replace("gm", "gmt");
  let d = new Date(cleanedStr);
  
  if (Number.isNaN(d.getTime())) {
    d = new Date(str);
  }
  
  if (!Number.isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return ""; 
}

function fmtDate(v) { const s = isoDate(v); if (!s) return "未排日期"; const p = s.split("-"); return Number(p[1]) + "/" + Number(p[2]); }
function normalizeTeamNames(items) { return items.map(t => ({ ...t, "協作區塊": t["協作區塊"] === "康橋" ? "康橋秀岡校區" : t["協作區塊"] })); }

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(tasks));
  $("saveState").textContent = "已更新至 Google Sheet";
}

async function syncToGAS(action, task) {
  if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.includes("YOUR_GAS_WEB_APP_URL_HERE")) return;
  $("saveState").textContent = "同步至 Google Sheet 中…";
  try {
    await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, task })
    });
    $("saveState").textContent = "已同步至 Google Sheet";
  } catch (e) {
    $("saveState").textContent = "同步失敗，已存於本機";
  }
}

function countStatus(s) { return tasks.filter(t => t["進度"] === s).length; }
function isDone(t) { return t["進度"] === "已完成"; }
function isDate(t) { return isoDate(t["預估開始日"]); }
function dueDays(t) { const d = isoDate(t["預估開始日"]); if (!d) return null; return Math.ceil((new Date(d + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime()) / 86400000); }

function setView(view) {
  activeView = view;
  document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  $(view + "Panel").classList.add("active");
  $("pageTitle").textContent = view === "overview" ? "全案狀況" : view === "tasks" ? "任務盤點" : "時程盤點";
  $("pageSubtitle").textContent = view === "overview" ? "先看需要決策與推進的事項，再進入任務明細。" : view === "tasks" ? "依協作區塊、狀態與關鍵字篩選任務。" : "依來源月份檢視工作節點與日期缺口。";
}

function renderMetrics() {
  const overdue = tasks.filter(t => !isDone(t) && dueDays(t) !== null && dueDays(t) < 0).length;
  const next = tasks.filter(t => !isDone(t) && dueDays(t) !== null && dueDays(t) >= 0 && dueDays(t) <= 7).length;
  const unassigned = tasks.filter(t => !String(t["執行負責人"] || "").trim() && !isDone(t)).length;
  const noDate = tasks.filter(t => !isDate(t) && !isDone(t)).length;
  const rows = [
    ["未完成任務", tasks.filter(t => !isDone(t)).length, "總任務 " + tasks.length, ""],
    ["逾期未完成", overdue, "已填預估開始日", "urgent"],
    ["七天內到期", next, "已填日期的任務", "warn"],
    ["待指派負責人", unassigned, "尚未完成的工作", "warn"],
    ["待補預計日期", noDate, "尚未完成的工作", "warn"]
  ];
  $("metrics").innerHTML = rows.map(x => '<div class="metric ' + x[3] + '"><div class="label">' + x[0] + '</div><div class="value">' + x[1] + '</div><div class="hint">' + x[2] + '</div></div>').join("");
}

function renderTeams() {
  const teamsList = optionData.teams.length ? optionData.teams : ["康軒", "北市大", "康橋秀岡校區"];
  const html = teamsList.map(team => {
    const list = tasks.filter(t => t["協作區塊"] === team), done = list.filter(isDone).length, percent = list.length ? Math.round(done / list.length * 100) : 0;
    const due = list.filter(t => !isDone(t) && dueDays(t) !== null && dueDays(t) < 0).length;
    const assigned = list.filter(t => String(t["執行負責人"] || "").trim()).length;
    return '<article class="team-card"><div class="team-top"><span class="team-name">' + team + '</span><span class="team-count">' + list.length + ' 項工作</span></div><div class="team-numbers"><b>' + done + '</b><span>／' + list.length + ' 項完成</span></div><div class="progress"><i style="width:' + percent + '%"></i></div><div class="team-foot"><span>已指派 ' + assigned + ' 項' + (due ? ' · 逾期 ' + due : '') + '</span><button class="text-btn" data-open-team="' + team + '">查看任務 →</button></div></article>';
  }).join("");
  $("teamCards").innerHTML = html;
  document.querySelectorAll("[data-open-team]").forEach(b => b.onclick = () => { activeTeam = b.dataset.openTeam; setView("tasks"); renderTasks(); });
}

function renderFocus() {
  const noDate = tasks.filter(t => !isDate(t) && !isDone(t)).length;
  const noOwner = tasks.filter(t => !String(t["執行負責人"] || "").trim() && !isDone(t)).length;
  const overdue = tasks.filter(t => !isDone(t) && dueDays(t) !== null && dueDays(t) < 0);
  const upcoming = tasks.filter(t => !isDone(t) && dueDays(t) !== null && dueDays(t) >= 0 && dueDays(t) <= 7).sort((a, b) => dueDays(a) - dueDays(b));

  const focus = [];
  focus.push(["確認營期最後一天", "兩份來源分別標示 1/30、1/31；確認後同步所有合作單位與對外資訊。"]);
  if (overdue.length) focus.push(["處理逾期任務", overdue.length + " 項已填日期的工作超過期限，先確認是否已完成或需調整日期。"]);
  focus.push(["補上年度排程", noDate + " 項未完成任務沒有預估開始日，建議先補主要里程碑，再補細項。"]);
  focus.push(["指定工作負責人", noOwner + " 項未完成任務尚未指派執行負責人。"]);

  $("focusList").innerHTML = focus.slice(0, 4).map(x => '<div class="focus-row"><i class="focus-dot"></i><div><strong>' + x[0] + '</strong><small>' + x[1] + '</small></div></div>').join("");
  $("upcomingList").innerHTML = upcoming.length ? upcoming.slice(0, 5).map(t => '<div class="next-task"><b>' + escapeHtml(t["工作細項"]) + '</b><span>' + fmtDate(t["預估開始日"]) + ' · ' + t["協作區塊"] + ' · ' + t["進度"] + '</span></div>').join("") : '<div class="empty">目前沒有已排定於七天內到期的任務。<br>先補日期，這裡才會顯示近期工作。</div>';
}

function renderTeamFilters() {
  const teamsList = optionData.teams.length ? optionData.teams : ["康軒", "北市大", "康橋秀岡校區"];
  const counts = { "全部": tasks.length };
  teamsList.forEach(team => counts[team] = tasks.filter(t => t["協作區塊"] === team).length);
  $("teamFilters").innerHTML = ["全部", ...teamsList].map(team => '<button class="filter-chip ' + ((activeTeam === "" && team === "全部") || activeTeam === team ? "active" : "") + '" data-team="' + (team === "全部" ? "" : team) + '">' + team + ' <span>' + (counts[team] || 0) + '</span></button>').join("");
  document.querySelectorAll("[data-team]").forEach(b => b.onclick = () => { activeTeam = b.dataset.team; page = 1; renderTasks(); });
}

function renderDropdownOptions() {
  const types = optionData.types.length ? optionData.types : [...new Set(tasks.map(t => t["類型"]).filter(Boolean))];
  $("phaseFilter").innerHTML = '<option value="">所有類型</option>' + types.map(x => '<option value="' + escapeHtml(x) + '">' + escapeHtml(x) + '</option>').join("");
  
  const statuses = optionData.statuses.length ? optionData.statuses : ["未開始", "進行中", "待回覆", "已完成", "暫緩"];
  $("statusFilter").innerHTML = '<option value="">所有狀態</option>' + statuses.map(x => '<option value="' + escapeHtml(x) + '">' + escapeHtml(x) + '</option>').join("");

  $("fType").innerHTML = types.map(x => '<option value="' + escapeHtml(x) + '">' + escapeHtml(x) + '</option>').join("");
  const teamsList = optionData.teams.length ? optionData.teams : ["康軒", "北市大", "康橋秀岡校區"];
  $("fTeam").innerHTML = teamsList.map(x => '<option value="' + escapeHtml(x) + '">' + escapeHtml(x) + '</option>').join("");
  $("fStatus").innerHTML = statuses.map(x => '<option value="' + escapeHtml(x) + '">' + escapeHtml(x) + '</option>').join("");
}

function renderTasks() {
  renderTeamFilters();
  const query = $("searchInput").value.trim().toLowerCase(), status = $("statusFilter").value, phase = $("phaseFilter").value;
  const filtered = tasks.filter(t => {
    const hay = [t["工作細項"], t["相關備註"], t["執行負責人"], t["對接窗口"], t["類型"]].join(" ").toLowerCase();
    return (!activeTeam || t["協作區塊"] === activeTeam) && (!status || t["進度"] === status) && (!phase || t["類型"] === phase) && (!query || hay.includes(query));
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, pages);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const first = filtered.length ? (page - 1) * pageSize + 1 : 0, last = Math.min(page * pageSize, filtered.length);
  $("resultCount").textContent = "顯示 " + first + "–" + last + " / " + filtered.length + " 項";
  $("pageControls").innerHTML = filtered.length ? '<button class="secondary" id="prevPage" ' + (page === 1 ? "disabled" : "") + '>上一頁</button><span>' + page + " / " + pages + '</span><button class="secondary" id="nextPage" ' + (page === pages ? "disabled" : "") + '>下一頁</button>' : "";
  
  $("taskRows").innerHTML = filtered.length ? visible.map(t => '<tr data-edit="' + escapeHtml(t["任務編號"]) + '"><td><div class="task-title">' + escapeHtml(t["工作細項"]) + '</div><div class="task-sub">' + escapeHtml(t["任務編號"]) + '</div></td><td><span class="tag ' + escapeHtml(t["協作區塊"]) + '">' + escapeHtml(t["協作區塊"]) + '</span></td><td>' + escapeHtml(t["類型"] || "—") + '</td><td>' + escapeHtml(isoDate(t["預估開始日"]) || "未提供") + '</td><td>' + escapeHtml(isoDate(t["實際完成日"]) || "—") + '</td><td>' + (t["執行負責人"] ? escapeHtml(t["執行負責人"]) : '<span class="owner-empty">待指派</span>') + '</td><td><span class="status ' + escapeHtml(t["進度"] || "未開始") + '">' + escapeHtml(t["進度"] || "未開始") + '</span></td></tr>').join("") : '<tr><td colspan="7" class="empty">沒有符合條件的任務。</td></tr>';
  
  document.querySelectorAll("[data-edit]").forEach(row => row.onclick = () => openTask(row.dataset.edit));
  if ($("prevPage")) $("prevPage").onclick = () => { page--; renderTasks(); };
  if ($("nextPage")) $("nextPage").onclick = () => { page++; renderTasks(); };
}

function renderTimeline() {
  const order = ["六月", "七月", "八月", "九月", "十月", "十一月", "十二月", "一月", "待排程"];
  const groups = {};
  order.forEach(m => groups[m] = []);
  tasks.forEach(t => {
    const m = "待排程";
    (groups[m] || (groups[m] = [])).push(t);
  });
  $("timelineAlertTitle").textContent = tasks.filter(t => !isDate(t) && !isDone(t)).length + " 項未完成工作尚未填入預估開始日";
  $("timelineAlertText").textContent = "可開啟「任務清單」進行日期調整。";
  $("timelineGrid").innerHTML = order.filter(m => groups[m]?.length).map(m => '<article class="month-card"><h3>' + m + '<span>' + groups[m].length + ' 項</span></h3>' + groups[m].map(t => '<div class="month-item"><i class="month-marker"></i><div><b>' + escapeHtml(t["工作細項"]) + '</b><small>' + escapeHtml(t["協作區塊"]) + ' · ' + escapeHtml(isoDate(t["預估開始日"]) || "待排程") + '</small></div></div>').join("") + '</article>').join("");
}

function escapeHtml(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c])); }

function render() {
  renderMetrics();
  renderTeams();
  renderFocus();
  renderDropdownOptions();
  renderTasks();
  renderTimeline();
}

function openTask(id) {
  const t = tasks.find(x => x["任務編號"] === id);
  if (!t) return;
  editId = id;
  $("dialogTitle").textContent = t["工作細項"];
  $("dialogMeta").textContent = id + " · " + (t["類型"] || "任務");
  $("fTitle").value = t["工作細項"] || "";
  $("fType").value = t["類型"] || (optionData.types[0] || "");
  $("fTeam").value = t["協作區塊"] || (optionData.teams[0] || "");
  $("fStatus").value = t["進度"] || (optionData.statuses[0] || "未開始");
  $("fOwner").value = t["執行負責人"] || "";
  $("fContact").value = t["對接窗口"] || "";
  $("fStart").value = isoDate(t["預估開始日"]);
  $("fEnd").value = isoDate(t["實際完成日"]);
  $("fDependency").value = t["待回覆對象"] || t["前置依賴"] || "";
  $("fNotes").value = t["相關備註"] || "";
  $("deleteTask").style.visibility = "visible";
  $("taskDialog").showModal();
}

function addTask() {
  const id = "N-" + String(Date.now()).slice(-6);
  const newTask = {
    "任務編號": id,
    "類型": optionData.types[0] || "一般任務",
    "協作區塊": activeTeam || (optionData.teams[0] || "康軒"),
    "工作細項": "新任務",
    "預估開始日": "",
    "實際完成日": "",
    "進度": optionData.statuses[0] || "未開始",
    "待回覆對象": "",
    "執行負責人": "",
    "對接窗口": "",
    "相關備註": ""
  };
  tasks.unshift(newTask);
  editId = id;
  saveState();
  syncToGAS("save", newTask);
  render();
  openTask(id);
}

document.querySelectorAll(".nav button").forEach(b => b.onclick = () => setView(b.dataset.view));
$("searchInput").addEventListener("input", () => { page = 1; renderTasks(); });
$("statusFilter").addEventListener("change", () => { page = 1; renderTasks(); });
$("phaseFilter").addEventListener("change", () => { page = 1; renderTasks(); });

$("addTask").onclick = addTask;
$("closeDialog").onclick = () => $("taskDialog").close();
$("cancelDialog").onclick = () => $("taskDialog").close();
$("taskDialog").addEventListener("click", e => { if (e.target === $("taskDialog")) $("taskDialog").close(); });

$("taskForm").onsubmit = e => {
  e.preventDefault();
  const t = tasks.find(x => x["任務編號"] === editId);
  if (!t) return;
  t["工作細項"] = $("fTitle").value.trim();
  t["類型"] = $("fType").value;
  t["協作區塊"] = $("fTeam").value;
  t["進度"] = $("fStatus").value;
  t["執行負責人"] = $("fOwner").value.trim();
  t["對接窗口"] = $("fContact").value.trim();
  t["預估開始日"] = isoDate($("fStart").value);
  t["實際完成日"] = isoDate($("fEnd").value);
  t["待回覆對象"] = $("fDependency").value.trim();
  t["相關備註"] = $("fNotes").value.trim();

  saveState();
  syncToGAS("save", t);
  $("taskDialog").close();
  render();
};

$("deleteTask").onclick = () => {
  if (!confirm("確定刪除此任務？")) return;
  const t = tasks.find(x => x["任務編號"] === editId);
  tasks = tasks.filter(x => x["任務編號"] !== editId);
  saveState();
  if (t) syncToGAS("delete", t);
  $("taskDialog").close();
  render();
};

$("saveState").textContent = "從 Google Sheet 載入中…";
fetch(GAS_WEB_APP_URL)
  .then(r => r.json())
  .then(res => {
    if (res.tasks) {
      tasks = normalizeTeamNames(res.tasks);
      optionData = res.options || optionData;
    } else {
      tasks = normalizeTeamNames(res);
    }
    saveState();
    render();
    $("saveState").textContent = "已連線 Google Sheet";
  })
  .catch(err => {
    console.error(err);
    $("saveState").textContent = "資料載入失敗，使用快照";
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) tasks = JSON.parse(saved);
    } catch (e) { }
    render();
  });