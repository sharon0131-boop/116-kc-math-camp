// 時程盤點：按開始月份分組，並顯示待排程任務。
// 使用 google-sheet.js 的共用資料與工具，
// 以及 tasks.js 的 openTask() 編輯彈窗。

function renderTimeline() {
  const groups = new Map();
  const pending = [];

  tasks.forEach(t => {
    const date = isoDate(t["開始日期"]);

    if (!date) {
      pending.push(t);
      return;
    }

    const month = date.slice(0, 7);

    if (!groups.has(month)) {
      groups.set(month, []);
    }

    groups.get(month).push(t);
  });

  $("timelineAlertTitle").textContent =
    pending.filter(t => !isDone(t)).length +
    " 項未完成工作尚未填入開始日期";

  $("timelineAlertText").textContent =
    "依開始日期分月顯示，各月按日期排序；未填日期的任務列於待排程。";

  const sections = [...groups.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  if (pending.length) {
    sections.push(["pending", pending]);
  }

  $("timelineGrid").innerHTML = sections.length
    ? sections.map(([month, list]) => {
        const title = month === "pending"
          ? "待排程"
          : month.slice(0, 4) + " 年 " +
            Number(month.slice(5)) + " 月";

        const sorted = [...list].sort((a, b) =>
          isoDate(a["開始日期"]).localeCompare(
            isoDate(b["開始日期"])
          )
        );

        return (
          '<article class="month-card">' +
            '<h3>' + title +
              '<span>' + list.length + ' 項</span>' +
            '</h3>' +

            sorted.map(t =>
              '<div class="month-item" role="button" tabindex="0" ' +
                'data-timeline-edit="' +
                  escapeHtml(t["任務編號"]) + '" ' +
                'aria-label="編輯任務：' +
                  escapeHtml(t["工作項目"]) + '" ' +
                'style="cursor:pointer">' +

                '<i class="month-marker"></i>' +

                '<div style="min-width:0;flex:1">' +
                  '<b>' +
                    escapeHtml(t["工作項目"]) +
                  '</b>' +

                  '<div class="timeline-meta">' +
                    '<span class="timeline-badge timeline-start">' +
                      '開始｜' +
                      escapeHtml(
                        isoDate(t["開始日期"]) || "待排程"
                      ) +
                    '</span>' +

                    '<span class="timeline-badge timeline-end">' +
                      '截止｜' +
                      escapeHtml(
                        isoDate(t["截止日期"]) || "未設定"
                      ) +
                    '</span>' +

                    '<span class="timeline-badge timeline-team">' +
                      '單位｜' +
                      escapeHtml(t["單位"] || "未指定") +
                    '</span>' +

                    '<span class="status ' +
                      escapeHtml(t["狀態"] || "未開始") + '">' +
                      '狀態｜' +
                      escapeHtml(t["狀態"] || "未開始") +
                    '</span>' +
                  '</div>' +

                  (
                    t["相關備註"]
                      ? '<div style="' +
                          'margin-top:6px;' +
                          'color:var(--muted);' +
                          'font-size:11px;' +
                          'line-height:1.6;' +
                          'white-space:pre-line;' +
                          'overflow-wrap:anywhere;">' +
                          escapeHtml(t["相關備註"]) +
                        '</div>'
                      : ''
                  ) +
                '</div>' +
              '</div>'
            ).join("") +
          '</article>'
        );
      }).join("")
    : '<div class="empty">目前沒有任務。</div>';

  // 點擊任務卡片，開啟既有的任務編輯彈窗。
  $("timelineGrid")
    .querySelectorAll("[data-timeline-edit]")
    .forEach(item => {
      item.onclick = () => {
        openTask(item.dataset.timelineEdit);
      };

      // 支援鍵盤 Enter 與空白鍵操作。
      item.onkeydown = event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openTask(item.dataset.timelineEdit);
        }
      };
    });
}