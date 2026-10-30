// Google Sheet 連線、共用狀態與工具、頁面切換及初始載入。
// 必須先載入本檔，再依序載入 overview.js、tasks.js、timeline.js。
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz-BYDMWuBHxojfhoGFC_ci92t07SrHsnmyUA5qRRkLaB5zz3hbtVq6wjVv8s_NWBJT/exec";

const STORE_KEY = "zhuoyue-project-desk-2027-v2";

let tasks = [];
let activeTeam = "";
let editId = null;
let activeView = "overview";

let optionData = {
  types: [],
  teams: [],
  statuses: []
};

let reminders = [];
let remindersSaving = false;

let taskSort = {
  field: "",
  direction: "asc"
};

const sortableTaskFields = [
  "單位",
  "窗口",
  "狀態",
  "開始日期",
  "截止日期"
];

const taskCollator = new Intl.Collator("zh-Hant", {
  numeric: true,
  sensitivity: "base"
});

const $ = id => document.getElementById(id);

// ===== 日期與共用工具 =====

function isoDate(v) {
  if (!v) return "";

  const str = String(v).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.match(/^\d{4}-\d{2}-\d{2}/)[0];
  }

  if (str.includes("T")) {
    return str.split("T")[0];
  }

  const cleanedStr = str
    .replace(" GM", " GMT")
    .replace("gm", "gmt");

  let d = new Date(cleanedStr);

  if (Number.isNaN(d.getTime())) {
    d = new Date(str);
  }

  if (!Number.isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return "";
}

function fmtDate(v) {
  const s = isoDate(v);

  if (!s) return "未排日期";

  const p = s.split("-");
  return Number(p[1]) + "/" + Number(p[2]);
}

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[c]));
}

function normalizeTeamNames(items) {
  return items.map(t => ({
    ...t,
    "單位": t["單位"] === "康橋"
      ? "康橋秀岡校區"
      : t["單位"]
  }));
}

function countStatus(s) {
  return tasks.filter(t => t["狀態"] === s).length;
}

function isDone(t) {
  return t["狀態"] === "已完成";
}

function isDate(t) {
  return isoDate(t["開始日期"]);
}

function dueDays(t) {
  const date = isoDate(t["截止日期"]);

  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil(
    (
      new Date(date + "T00:00:00").getTime() -
      today.getTime()
    ) / 86400000
  );
}

function getTeams() {
  return optionData.teams.length
    ? optionData.teams
    : ["康軒", "北市大", "康橋秀岡校區"];
}

function getTypes() {
  return optionData.types.length
    ? optionData.types
    : [...new Set(
        tasks.map(t => t["類型"]).filter(Boolean)
      )];
}

function getStatuses() {
  return optionData.statuses.length
    ? optionData.statuses
    : ["未開始", "進行中", "待回覆", "已完成", "暫緩"];
}

function optionsHtml(items) {
  return items.map(x =>
    '<option value="' + escapeHtml(x) + '">' +
      escapeHtml(x) +
    '</option>'
  ).join("");
}

// 確保既有任務的值即使不在選單來源內，也能顯示。
function setSelectValue(id, value) {
  const select = $(id);

  if (
    value &&
    !Array.from(select.options).some(o => o.value === value)
  ) {
    select.add(new Option(value, value));
  }

  select.value = value || select.options[0]?.value || "";
}

// ===== 任務資料同步 =====

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(tasks));
    $("saveState").textContent = "已儲存於本機";
  } catch (err) {
    console.error(err);
    $("saveState").textContent = "本機備份未成功";
  }
}

async function syncToGAS(action, task) {
  if (
    !GAS_WEB_APP_URL ||
    GAS_WEB_APP_URL.includes("YOUR_GAS_WEB_APP_URL_HERE")
  ) {
    return;
  }

  $("saveState").textContent = "同步至 Google Sheet 中…";

  try {
    await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8"
      },
      body: JSON.stringify({ action, task })
    });

    // no-cors 無法直接讀取伺服器回應內容。
    $("saveState").textContent = "已送出同步要求";
  } catch (err) {
    console.error(err);
    $("saveState").textContent = "同步失敗，請保留目前頁面後重試";
  }
}

// ===== 頁面切換 =====

function setView(view) {
  activeView = view;

  document.querySelectorAll(".nav button").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });

  document.querySelectorAll(".panel").forEach(p => {
    p.classList.remove("active");
  });

  $(view + "Panel").classList.add("active");

  $("pageTitle").textContent =
    view === "overview"
      ? "全案狀況"
      : view === "tasks"
        ? "任務盤點"
        : "時程盤點";

  $("pageSubtitle").textContent =
    view === "overview"
      ? "先看需要決策與推進的事項，再進入任務明細。"
      : view === "tasks"
        ? "依協作區塊、狀態與關鍵字篩選任務。"
        : "依來源月份檢視工作節點與日期缺口。";
}

function render() {
  renderMetrics();
  renderTeams();
  renderFocus();
  renderDropdownOptions();
  renderTasks();
  renderTimeline();
}


document.addEventListener("DOMContentLoaded", () => {
document.querySelectorAll(".nav button").forEach(b => {
  b.onclick = () => setView(b.dataset.view);
});

$("saveState").textContent = "從 Google Sheet 載入中…";

fetch(GAS_WEB_APP_URL)
  .then(response => {
    if (!response.ok) {
      throw new Error("無法載入 Google Sheet。");
    }

    return response.json();
  })
  .then(res => {
    if (Array.isArray(res.reminders)) {
      reminders = normalizeReminders(res.reminders);
      renderReminders();

      $("editReminders").disabled = false;
    } else {
      $("reminderList").textContent =
        "提醒事項尚未啟用，請更新 Apps Script 部署版本。";
    }

    if (Array.isArray(res.tasks)) {
      tasks = normalizeTeamNames(res.tasks);

      optionData = {
        types: res.options?.types || [],
        teams: res.options?.teams || [],
        statuses: res.options?.statuses || []
      };
    } else if (Array.isArray(res)) {
      tasks = normalizeTeamNames(res);
    } else {
      throw new Error("任務資料格式不正確。");
    }

    saveState();
    render();

    $("saveState").textContent = "已連線 Google Sheet";
  })
  .catch(err => {
    console.error(err);

    $("reminderList").textContent =
      "提醒事項載入失敗，請重新整理後再試。";

    $("editReminders").disabled = true;

    try {
      const saved = localStorage.getItem(STORE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          tasks = parsed;
        }
      }
    } catch (storageError) {
      console.error(storageError);
    }

    render();

    $("saveState").textContent =
      "資料載入失敗，使用本機快照";
  });
});

// 儲存提醒並重新讀取，確認 Google Sheet 已寫入。
async function saveRemindersToGAS(next) {
    await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8"
      },
      body: JSON.stringify({
        action: "saveReminders",
        reminders: next
      })
    });

    // 重新讀取，確認提醒事項已寫入。
    const response = await fetch(
      GAS_WEB_APP_URL + "?reminderCheck=" + Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("無法讀取儲存結果。");
    }

    const data = await response.json();

    if (!Array.isArray(data.reminders)) {
      throw new Error("請更新 Apps Script 部署版本。");
    }

    const saved = normalizeReminders(data.reminders);

    if (JSON.stringify(saved) !== JSON.stringify(next)) {
      throw new Error(
        "尚未確認儲存結果，或內容已被其他人修改。" +
        "請稍後重新整理確認；輸入仍保留在彈窗內。"
      );
    }

    return saved;
}
