(function () {
  const TODAY = startOfToday();
  const DAY = 24 * 60 * 60 * 1000;
  const DAY_WIDTH = 180;
  const WINDOW_DAYS = 7;
  const levels = ["P1", "P2", "P3", "P4", "P5", "P6"];
  const state = {
    subject: "Math",
    missingOnly: false,
    windowStart: new Date(TODAY),
  };

  const els = {
    gantt: document.getElementById("gantt"),
    rows: document.getElementById("lessonRows"),
    missingOnly: document.getElementById("missingOnly"),
    summaryLessons: document.getElementById("summaryLessons"),
    summaryMissing: document.getElementById("summaryMissing"),
    summaryUrgent: document.getElementById("summaryUrgent"),
    tableNote: document.getElementById("tableNote"),
    weekWindow: document.getElementById("weekWindow"),
    prevWeek: document.getElementById("prevWeek"),
    todayWeek: document.getElementById("todayWeek"),
    nextWeek: document.getElementById("nextWeek"),
  };

  const data = (window.CLASS_GAMES || []).map((item) => {
    const game = clean(item.gameTitle) || "No game specified";
    const status = getStatus(item, game);
    const date = parseLocalDate(item.nextClass);
    return {
      ...item,
      date,
      daysUntil: daysBetween(TODAY, date),
      game,
      displayGame: displayGameName(game),
      status,
      statusLabel: getStatusLabel(status, item),
    };
  });

  document.querySelectorAll("[data-subject]").forEach((button) => {
    button.addEventListener("click", () => {
      state.subject = button.dataset.subject;
      document.querySelectorAll("[data-subject]").forEach((b) => b.classList.toggle("active", b === button));
      render();
    });
  });

  els.missingOnly.addEventListener("change", () => {
    state.missingOnly = els.missingOnly.checked;
    render();
  });

  els.prevWeek.addEventListener("click", () => {
    shiftWindow(-WINDOW_DAYS);
  });

  els.todayWeek.addEventListener("click", () => {
    state.windowStart = new Date(TODAY);
    render();
  });

  els.nextWeek.addEventListener("click", () => {
    shiftWindow(WINDOW_DAYS);
  });

  function clean(value) {
    return String(value || "").trim();
  }

  function displayGameName(game) {
    const text = clean(game);
    if (text === "No game specified") return text;
    return text.replace(/^(Math|Science)-P[1-6]-/i, "");
  }

  function parseLocalDate(value) {
    const normalized = String(value || "").trim().replace(" ", "T");
    return new Date(`${normalized}+08:00`);
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function daysBetween(start, end) {
    const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((endDate - startDate) / DAY);
  }

  function getStatus(item, game) {
    if (!item.gameSpecified || game === "No game specified") return "missing";
    const prodStatus = clean(item.prodStatuses).toLowerCase();
    if (!prodStatus) return item.subject === "Science" ? "pending" : "ready";
    if (prodStatus === "done") return "ready";
    return "pending";
  }

  function getStatusLabel(status, item) {
    if (status === "missing") return "No game specified";
    if (status === "ready") return "Ready";
    return clean(item.prodStatuses) || "Assigned, no production row";
  }

  function shiftWindow(days) {
    state.windowStart = new Date(state.windowStart.getTime() + days * DAY);
    render();
  }

  function windowEnd() {
    return new Date(state.windowStart.getTime() + (WINDOW_DAYS - 1) * DAY);
  }

  function daysFromWindowStart(date) {
    return daysBetween(state.windowStart, date);
  }

  function isTodayInWindow() {
    const todayOffset = daysBetween(state.windowStart, TODAY);
    return todayOffset >= 0 && todayOffset < WINDOW_DAYS;
  }

  function filteredRows() {
    return data
      .filter((item) => item.subject === state.subject)
      .map((item) => ({ ...item, windowDay: daysFromWindowStart(item.date) }))
      .filter((item) => item.windowDay >= 0 && item.windowDay < WINDOW_DAYS)
      .filter((item) => !state.missingOnly || item.status === "missing")
      .sort((a, b) => a.level.localeCompare(b.level) || a.date - b.date || a.week - b.week);
  }

  function render() {
    const rows = filteredRows();
    const chartDays = WINDOW_DAYS - 1;
    const chartWidth = 112 + WINDOW_DAYS * DAY_WIDTH;
    els.gantt.style.setProperty("--dayWidth", `${DAY_WIDTH}px`);
    els.gantt.style.setProperty("--chartWidth", `${chartWidth}px`);
    els.summaryLessons.textContent = rows.length;
    els.summaryMissing.textContent = rows.filter((r) => r.status === "missing").length;
    els.summaryUrgent.textContent = rows.filter((r) => r.status === "missing" && r.daysUntil >= 0 && r.daysUntil <= 7).length;
    renderWindowLabel();
    renderGantt(rows, chartDays);
    renderTable(rows);
  }

  function renderWindowLabel() {
    const offset = daysBetween(TODAY, state.windowStart);
    const range = `${formatShortDate(state.windowStart)}-${formatShortDate(windowEnd())}`;
    let label = range;
    if (offset === 0) {
      label = `7-day view from today | ${range}`;
    } else if (offset > 0) {
      label = `${range} | ${offset} day${offset === 1 ? "" : "s"} ahead`;
    } else {
      label = `${range} | ${Math.abs(offset)} day${offset === -1 ? "" : "s"} ago`;
    }
    els.weekWindow.textContent = label;
    els.todayWeek.disabled = offset === 0;
  }

  function renderGantt(rows, chartDays) {
    if (!rows.length) {
      els.gantt.innerHTML = '<div class="empty">No lessons match the current filters.</div>';
      return;
    }

    const ticks = [];
    const todayOffset = daysBetween(state.windowStart, TODAY);
    for (let day = 0; day <= chartDays; day += 1) {
      const date = new Date(state.windowStart.getTime() + day * DAY);
      ticks.push(`<div class="tick${day === todayOffset ? " todayTick" : ""}" style="left:${day * DAY_WIDTH}px">${formatDayTick(date)}</div>`);
    }

    const html = [
      '<div class="timeline">',
      '<div class="timelineCorner">Level</div>',
      `<div class="ticks">${ticks.join("")}</div>`,
      "</div>",
      '<div class="levelBlock">',
      isTodayInWindow() ? `<div class="todayLine" style="left:${112 + todayOffset * DAY_WIDTH}px" title="Today"></div>` : "",
    ];

    levels.forEach((level) => {
      const levelRows = rows.filter((row) => row.level === level);
      const laneCounts = new Map();
      levelRows.forEach((row) => laneCounts.set(row.windowDay, (laneCounts.get(row.windowDay) || 0) + 1));
      const rowHeight = Math.max(62, Math.max(1, ...laneCounts.values()) * 52 + 14);
      const laneByDay = new Map();
      const bars = levelRows
        .map((row) => {
          const lane = laneByDay.get(row.windowDay) || 0;
          laneByDay.set(row.windowDay, lane + 1);
          const left = Math.max(0, row.windowDay) * DAY_WIDTH + 6;
          const top = 7 + lane * 52;
          const width = DAY_WIDTH - 12;
          const title = `${row.level} W${row.week}: ${row.topic || "Untitled topic"} | ${row.game}`;
          const topicLine = `${formatTime(row.date)} - W${row.week}${row.topic ? ` - ${row.topic}` : ""}`;
          return `<button class="bar ${row.status}" style="left:${left}px;top:${top}px;width:${width}px" title="${escapeAttr(title)}"><span class="barTopic">${escapeHtml(topicLine)}</span><span class="barGame">${escapeHtml(row.displayGame)}</span></button>`;
        })
        .join("");

      html.push(
        `<div class="row" style="min-height:${rowHeight}px">`,
        `<div class="rowLabel levelRow"><strong>${level}</strong><span>${levelRows.length || "No"} item${levelRows.length === 1 ? "" : "s"}</span></div>`,
        `<div class="track" style="min-height:${rowHeight}px">${isTodayInWindow() ? `<div class="todayCell" style="left:${todayOffset * DAY_WIDTH}px" aria-hidden="true"></div>` : ""}${bars}</div>`,
        "</div>",
      );
    });

    html.push("</div>");
    els.gantt.innerHTML = html.join("");
  }

  function renderTable(rows) {
    els.tableNote.textContent = `${state.subject}, ${formatShortDate(state.windowStart)}-${formatShortDate(windowEnd())}`;
    const gameRows = [...rows].sort((a, b) => a.date - b.date || a.level.localeCompare(b.level) || a.week - b.week);
    els.rows.innerHTML = gameRows
      .map(
        (row) => `
        <tr>
          <td>${formatDate(row.date)}<br><span class="muted">${formatTime(row.date)}</span></td>
          <td><strong>${row.level}</strong><br><span class="muted">W${row.week}</span></td>
          <td><strong>${escapeHtml(row.displayGame)}</strong><br><span class="muted">${escapeHtml(row.topic || "No topic row found")}</span></td>
          <td><span class="statusPill ${row.status}">${escapeHtml(row.statusLabel)}</span><br><span class="muted">${escapeHtml(row.assignmentSource || "")}</span></td>
        </tr>`,
      )
      .join("");
  }

  function formatShortDate(date) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatDayTick(date) {
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  function formatDate(date) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatTime(date) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("'", "&#39;");
  }

  render();
})();
