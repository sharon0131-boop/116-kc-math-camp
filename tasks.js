// 任務清單：篩選、排序、新增、編輯與刪除。
// ===== 任務清單排序 =====

function sortTaskList(list) {
  if (!taskSort.field) return list;

  const field = taskSort.field;
  const multiplier = taskSort.direction === "asc" ? 1 : -1;

  const isDateField =
    field === "開始日期" ||
    field === "截止日期";

  return [...list].sort((a, b) => {
    const valueA = isDateField
      ? isoDate(a[field])
      : String(a[field] ?? "").trim();

    const valueB = isDateField
      ? isoDate(b[field])
      : String(b[field] ?? "").trim();

    // 未填資料固定排在最後。
    if (!valueA && !valueB) return 0;
    if (!valueA) return 1;
    if (!valueB) return -1;

    return taskCollator.compare(valueA, valueB) * multiplier;
  });
}

function setupTaskSorting() {
  document.querySelectorAll(".task-table thead th")
    .forEach(th => {
      const field = th.textContent.trim();

      if (!sortableTaskFields.includes(field)) return;

      const button = document.createElement("button");

      button.type = "button";
      button.dataset.taskSort = field;

      Object.assign(button.style, {
        background: "transparent",
        border: "0",
        padding: "0",
        color: "inherit",
        font: "inherit",
        fontWeight: "inherit",
        cursor: "pointer",
        whiteSpace: "nowrap"
      });

      th.replaceChildren(button);

      button.onclick = () => {
        if (taskSort.field === field) {
          taskSort.direction =
            taskSort.direction === "asc" ? "desc" : "asc";
        } else {
          taskSort.field = field;
          taskSort.direction = "asc";
        }

        updateTaskSortHeaders();
        renderTasks();
      };
    });

  updateTaskSortHeaders();
}

function updateTaskSortHeaders() {
  document.querySelectorAll("[data-task-sort]")
    .forEach(button => {
      const field = button.dataset.taskSort;
      const selected = taskSort.field === field;

      const arrow = selected
        ? taskSort.direction === "asc" ? " ↑" : " ↓"
        : " ↕";

      button.textContent = field + arrow;

      button.setAttribute(
        "aria-label",
        field + "，點擊以" +
        (
          selected && taskSort.direction === "asc"
            ? "降冪"
            : "升冪"
        ) +
        "排序"
      );

      button.closest("th").setAttribute(
        "aria-sort",
        selected
          ? taskSort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      );
    });
}

// ===== 任務篩選與選單 =====

function renderTeamFilters() {
  const teamsList = getTeams();

  const counts = {
    "全部": tasks.length
  };

  teamsList.forEach(team => {
    counts[team] = tasks.filter(t =>
      t["單位"] === team
    ).length;
  });

  $("teamFilters").innerHTML = ["全部", ...teamsList]
    .map(team =>
      '<button class="filter-chip ' +
        (
          (activeTeam === "" && team === "全部") ||
          activeTeam === team
            ? "active"
            : ""
        ) +
        '" data-team="' +
          escapeHtml(team === "全部" ? "" : team) +
        '">' +
        escapeHtml(team) +
        ' <span>' + (counts[team] || 0) + '</span>' +
      '</button>'
    ).join("");

  document.querySelectorAll("[data-team]").forEach(b => {
    b.onclick = () => {
      activeTeam = b.dataset.team;
      renderTasks();
    };
  });
}

function renderDropdownOptions() {
  // 更新選單後保留目前的篩選條件。
  const previousPhase = $("phaseFilter").value;
  const previousStatus = $("statusFilter").value;

  const types = getTypes();
  const statuses = getStatuses();
  const teams = getTeams();

  $("phaseFilter").innerHTML =
    '<option value="">所有類型</option>' +
    optionsHtml(types);

  $("statusFilter").innerHTML =
    '<option value="">所有狀態</option>' +
    optionsHtml(statuses);

  $("fType").innerHTML = optionsHtml(types);
  $("fStatus").innerHTML = optionsHtml(statuses);
  $("fTeam").innerHTML = optionsHtml(teams);

  $("phaseFilter").value =
    types.includes(previousPhase) ? previousPhase : "";

  $("statusFilter").value =
    statuses.includes(previousStatus) ? previousStatus : "";
}

// ===== 任務清單 =====

function renderTasks() {
  renderTeamFilters();

  const query = $("searchInput").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  const phase = $("phaseFilter").value;

  const filtered = tasks.filter(t => {
    const hay = [
      t["工作項目"],
      t["相關備註"],
      t["窗口"],
      t["單位"],
      t["類型"]
    ].join(" ").toLowerCase();

    return (
      (!activeTeam || t["單位"] === activeTeam) &&
      (!status || t["狀態"] === status) &&
      (!phase || t["類型"] === phase) &&
      (!query || hay.includes(query))
    );
  });

  const sortedTasks = sortTaskList(filtered);

  $("resultCount").textContent =
    "共 " + filtered.length + " 項任務";

  $("taskRows").innerHTML = sortedTasks.length
    ? sortedTasks.map(t =>
        '<tr data-edit="' + escapeHtml(t["任務編號"]) + '">' +
          '<td>' +
            '<div class="task-sub" style="' +
              'font-size:12px;font-weight:bold;color:#476172;">' +
              escapeHtml(t["任務編號"]) +
            '</div>' +
          '</td>' +

          '<td>' +
            escapeHtml(t["類型"] || "—") +
          '</td>' +

          '<td>' +
            '<span class="tag ' + escapeHtml(t["單位"]) + '">' +
              escapeHtml(t["單位"]) +
            '</span>' +
          '</td>' +

          '<td>' +
            escapeHtml(t["窗口"] || "—") +
          '</td>' +

          '<td>' +
            '<span class="status ' +
              escapeHtml(t["狀態"] || "未開始") + '">' +
              escapeHtml(t["狀態"] || "未開始") +
            '</span>' +
          '</td>' +

          '<td>' +
            escapeHtml(isoDate(t["開始日期"]) || "未提供") +
          '</td>' +

          '<td>' +
            escapeHtml(isoDate(t["截止日期"]) || "—") +
          '</td>' +

          '<td>' +
            '<div class="task-title">' +
              escapeHtml(t["工作項目"]) +
            '</div>' +

            '<div class="notes-cell" title="' +
              escapeHtml(t["相關備註"]) + '">' +
              escapeHtml(t["相關備註"] || "—") +
            '</div>' +
          '</td>' +
        '</tr>'
      ).join("")
    : '<tr><td colspan="8" class="empty">' +
        '沒有符合條件的任務。' +
      '</td></tr>';

  document.querySelectorAll("[data-edit]").forEach(row => {
    row.onclick = () => openTask(row.dataset.edit);
  });
}

// ===== 任務編輯與新增 =====

function openTask(id) {
  const t = tasks.find(x => x["任務編號"] === id);

  if (!t) return;

  editId = id;

  $("fTitle").setCustomValidity("");

  $("dialogTitle").textContent =
    t["工作項目"] || "編輯任務";

  $("dialogMeta").textContent = id;

  setSelectValue("fTeam", t["單位"]);
  setSelectValue("fType", t["類型"]);
  setSelectValue("fStatus", t["狀態"] || "未開始");

  $("fContact").value = t["窗口"] || "";
  $("fTitle").value = t["工作項目"] || "";
  $("fStart").value = isoDate(t["開始日期"]);
  $("fEnd").value = isoDate(t["截止日期"]);
  $("fNotes").value = t["相關備註"] || "";

  $("deleteTask").style.visibility = "visible";
  $("taskDialog").showModal();
}

function addTask() {
  // 只開啟表單，尚未建立任務或寫入 Google Sheet。
  editId = null;

  $("fTitle").setCustomValidity("");

  $("dialogTitle").textContent = "新增任務";
  $("dialogMeta").textContent =
    "填寫完成後，按「儲存變更」建立任務";

  setSelectValue(
    "fTeam",
    activeTeam || getTeams()[0] || ""
  );

  $("fContact").value = "";
  $("fType").selectedIndex = 0;

  setSelectValue("fStatus", "未開始");

  $("fTitle").value = "";
  $("fStart").value = "";
  $("fEnd").value = "";
  $("fNotes").value = "";

  $("deleteTask").style.visibility = "hidden";
  $("taskDialog").showModal();
}

// ===== 頁面與任務事件 =====

$("searchInput").addEventListener("input", renderTasks);
$("statusFilter").addEventListener("change", renderTasks);
$("phaseFilter").addEventListener("change", renderTasks);

$("addTask").onclick = addTask;

$("closeDialog").onclick = () => {
  $("taskDialog").close();
};

$("cancelDialog").onclick = () => {
  $("taskDialog").close();
};

// 不加入點擊背景關閉事件。
// 保留原生 Esc 關閉功能。

$("taskForm").onsubmit = e => {
  e.preventDefault();

  const title = $("fTitle").value.trim();

  if (!title) {
    $("fTitle").setCustomValidity("請輸入工作項目名稱");
    $("fTitle").reportValidity();
    return;
  }

  $("fTitle").setCustomValidity("");

  const values = {
    "單位": $("fTeam").value,
    "窗口": $("fContact").value.trim(),
    "類型": $("fType").value,
    "狀態": $("fStatus").value,
    "工作項目": title,
    "開始日期": isoDate($("fStart").value),
    "截止日期": isoDate($("fEnd").value),
    "相關備註": $("fNotes").value.trim()
  };

  let task;

  if (editId === null) {
    // 按儲存後才真正建立。
    task = {
      "任務編號":
        "N-" + Date.now() + "-" +
        Math.random().toString(36).slice(2, 7),
      ...values
    };

    tasks.unshift(task);
  } else {
    task = tasks.find(t => t["任務編號"] === editId);

    if (!task) return;

    Object.assign(task, values);
  }

  saveState();
  syncToGAS("save", task);

  $("taskDialog").close();
  render();
};

$("fTitle").addEventListener("input", () => {
  $("fTitle").setCustomValidity("");
});

$("deleteTask").onclick = () => {
  if (editId === null) return;
  if (!confirm("確定刪除此任務？")) return;

  const task = tasks.find(t => t["任務編號"] === editId);

  if (!task) return;

  tasks = tasks.filter(t => t["任務編號"] !== editId);

  saveState();
  syncToGAS("delete", task);

  $("taskDialog").close();
  render();
};

// ===== 彈窗關閉規則 =====

// 點擊外側不關閉，保留 Esc、×、取消及程式關閉。
$("taskDialog").setAttribute("closedby", "closerequest");
// ===== 啟用欄位排序 =====

setupTaskSorting();

