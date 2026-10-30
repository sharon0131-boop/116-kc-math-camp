// 專案總覽：指標、負責單位、風險任務與提醒事項彈窗。
// ===== 專案總覽 =====

function renderMetrics() {
  const overdue = tasks.filter(t =>
    !isDone(t) &&
    dueDays(t) !== null &&
    dueDays(t) < 0
  ).length;

  const next = tasks.filter(t =>
    !isDone(t) &&
    dueDays(t) !== null &&
    dueDays(t) >= 0 &&
    dueDays(t) <= 7
  ).length;

  const noDate = tasks.filter(t =>
    !isDate(t) && !isDone(t)
  ).length;

  const rows = [
    [
      "未完成任務",
      tasks.filter(t => !isDone(t)).length,
      "總任務 " + tasks.length,
      ""
    ],
    ["逾期未完成", overdue, "依截止日期判斷", "urgent"],
    ["七天內到期", next, "已填日期的任務", "warn"],
    ["待補開始日期", noDate, "尚未完成的工作", "warn"]
  ];

  $("metrics").innerHTML = rows.map(x =>
    '<div class="metric ' + x[3] + '">' +
      '<div class="label">' + x[0] + '</div>' +
      '<div class="value">' + x[1] + '</div>' +
      '<div class="hint">' + x[2] + '</div>' +
    '</div>'
  ).join("");
}

function renderTeams() {
  $("teamCards").innerHTML = getTeams().map(team => {
    const list = tasks.filter(t => t["單位"] === team);
    const done = list.filter(isDone).length;

    const percent = list.length
      ? Math.round(done / list.length * 100)
      : 0;

    const due = list.filter(t =>
      !isDone(t) &&
      dueDays(t) !== null &&
      dueDays(t) < 0
    ).length;

    return (
      '<article class="team-card">' +
        '<div class="team-top">' +
          '<span class="team-name">' +
            escapeHtml(team) +
          '</span>' +
          '<span class="team-count">' +
            list.length + ' 項工作' +
          '</span>' +
        '</div>' +

        '<div class="team-numbers">' +
          '<b>' + done + '</b>' +
          '<span>／' + list.length + ' 項完成</span>' +
        '</div>' +

        '<div class="progress">' +
          '<i style="width:' + percent + '%"></i>' +
        '</div>' +

        '<div class="team-foot">' +
          '<span>' +
            (due ? '逾期 ' + due : '進度正常') +
          '</span>' +

          '<button class="text-btn" data-open-team="' +
            escapeHtml(team) + '">' +
            '查看任務 →' +
          '</button>' +
        '</div>' +
      '</article>'
    );
  }).join("");

  document.querySelectorAll("[data-open-team]").forEach(b => {
    b.onclick = () => {
      activeTeam = b.dataset.openTeam;
      setView("tasks");
      renderTasks();
    };
  });
}

function renderFocus() {
  const unfinished = tasks.filter(t => !isDone(t));

  const overdue = unfinished.filter(t =>
    dueDays(t) !== null && dueDays(t) < 0
  );

  const upcoming = unfinished.filter(t =>
    dueDays(t) !== null &&
    dueDays(t) >= 0 &&
    dueDays(t) <= 7
  );

  const noDate = unfinished.filter(t => !isDate(t));

  const byDeadline = (a, b) =>
    isoDate(a["截止日期"]).localeCompare(
      isoDate(b["截止日期"])
    );

  overdue.sort(byDeadline);
  upcoming.sort(byDeadline);

  const sections = [
    ["overdueList", overdue],
    ["upcomingList", upcoming],
    ["noStartList", noDate]
  ];

  sections.forEach(([id, list]) => {
    $(id + "Count").textContent = list.length + " 項";

    $(id).innerHTML = list.length
      ? list.map(t =>
          '<button type="button" class="overview-task" ' +
            'data-overview-edit="' +
              escapeHtml(t["任務編號"]) +
            '">' +

            '<strong>' +
              escapeHtml(t["工作項目"]) +
            '</strong>' +

            '<span>' +
              escapeHtml(t["單位"] || "未指定單位") +
              ' · ' +
              escapeHtml(t["狀態"] || "未開始") +
            '</span>' +

            (
              t["相關備註"]
                ? '<span class="overview-task-note">備註：' +
                    escapeHtml(t["相關備註"]) +
                  '</span>'
                : ''
            ) +

            '<span class="overview-task-dates">' +
              '<small class="overview-task-date">開始：' +
                escapeHtml(
                  isoDate(t["開始日期"]) || "未設定"
                ) +
              '</small>' +

              '<small class="overview-task-date">截止：' +
                escapeHtml(
                  isoDate(t["截止日期"]) || "未設定"
                ) +
              '</small>' +
            '</span>' +
          '</button>'
        ).join("")
      : '<div class="empty">目前沒有符合的任務。</div>';
  });

  document.querySelectorAll("[data-overview-edit]")
    .forEach(button => {
      button.onclick = () => {
        openTask(button.dataset.overviewEdit);
      };
    });
}

// ===== 專案提醒 =====

function normalizeReminders(items) {
  if (!Array.isArray(items)) return [];

  return items.slice(0, 3)
    .map(x => ({
      title: String(x.title || "").trim(),
      detail: String(x.detail || "").trim()
    }))
    .filter(x => x.title);
}

function renderReminders() {
  $("reminderList").innerHTML = reminders.length
    ? reminders.map((x, i) =>
        '<div class="reminder-card">' +
          '<div class="reminder-number">' +
            (i + 1) +
          '</div>' +

          '<div class="reminder-content">' +
            '<strong>' + escapeHtml(x.title) + '</strong>' +
            (
              x.detail
                ? '<p>' + escapeHtml(x.detail) + '</p>'
                : ''
            ) +
          '</div>' +
        '</div>'
      ).join("")
    : '<div class="empty">' +
        '目前沒有提醒事項，可點選「編輯提醒」新增。' +
      '</div>';
}

$("editReminders").onclick = () => {
  for (let i = 1; i <= 3; i++) {
    $("reminderTitle" + i).value =
      reminders[i - 1]?.title || "";

    $("reminderDetail" + i).value =
      reminders[i - 1]?.detail || "";
  }

  $("reminderMessage").textContent = "";
  $("reminderDialog").showModal();
};

function closeReminders() {
  if (!remindersSaving) {
    $("reminderDialog").close();
  }
}

$("closeReminderDialog").onclick = closeReminders;
$("cancelReminderDialog").onclick = closeReminders;

// 一般編輯時允許 Esc 關閉。
// 儲存期間暫停關閉，避免中斷儲存確認。
$("reminderDialog").addEventListener("cancel", e => {
  if (remindersSaving) {
    e.preventDefault();
  }
});

// 不加入點擊背景關閉事件。

$("reminderForm").onsubmit = async e => {
  e.preventDefault();

  if (remindersSaving) return;

  const next = [];

  for (let i = 1; i <= 3; i++) {
    const title = $("reminderTitle" + i).value.trim();
    const detail = $("reminderDetail" + i).value.trim();

    if (!title && detail) {
      $("reminderMessage").textContent =
        "第 " + i + " 筆請補上標題。";

      $("reminderTitle" + i).focus();
      return;
    }

    if (title) {
      next.push({ title, detail });
    }
  }

  remindersSaving = true;

  $("saveReminders").disabled = true;
  $("saveReminders").textContent = "儲存中…";

  $("reminderMessage").textContent =
    "正在儲存並確認試算表內容…";

  try {
    const saved = await saveRemindersToGAS(next);

    reminders = saved;
    renderReminders();

    $("saveState").textContent =
      "提醒事項已儲存至 Google Sheet";

    $("reminderDialog").close();
  } catch (err) {
    console.error(err);

    $("reminderMessage").textContent =
      err.message || "儲存確認失敗。";
  } finally {
    remindersSaving = false;

    $("saveReminders").disabled = false;
    $("saveReminders").textContent = "儲存提醒";
  }
};

$("reminderDialog").setAttribute("closedby", "closerequest");
