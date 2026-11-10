/* ==========================================================================
   suspensions/charts.js
   ==========================================================================
   Draws everything on the Suspensions Dashboard page. Read top to bottom.

   WHAT HAPPENS WHEN THE PAGE LOADS
     1. Start the menu: show one part (part 1, or the part named at the end of
        the page's address, such as #part-3) and hide the others.
     2. Load the two data files: data/data.json (the numbers, built by
        update_data_here/build_data.py) and data/Geography.json (the school
        district outlines).
     3. Fill in the numbers written inside sentences and in the four tiles at
        the top (the <span data-fill> tags in index.html).
     4. Part 1: the chart of student groups against the average (rows of child
        figures, two views with buttons to switch) and the district map (its
        district list, legend, hover box and side panel).
     5. Part 2: the chart of school days lost (rows of school-week blocks).
        Part 3: the four steps. Part 4: the $50 million bar.
     Every chart and the map are plain HTML and SVG written here. The chart
     library in resources/vendor/ (Chart.js) is not loaded: no chart on the
     page uses it. The Chart.js helpers in part one below are kept, unused,
     so that part stays the same as the Youth Justice Dashboard's.

   Nothing here defines a color; every color is read from styles.css.

   PART ONE  ·  helpers, all on one object called WCA. Copied unchanged from
   the Youth Justice Dashboard; change it there and here together.
     WCA.colors        the brand colors, read from styles.css
     WCA.fmt           number formatting: 6395 -> "6,395", 13.9 -> "13.9%"
     WCA.get           read a value out of data.json by a dotted path
     WCA.fillNumbers   fill the <span data-fill> tags in the page text
     WCA.tooltip       the hover box: show(html, x, y) and hide()
     WCA.legend        write an HTML legend for a chart
     WCA.applyChartDefaults   the look every Chart.js chart shares (not used here)
     WCA.plugins       two small Chart.js add-ons (not used here)

   PART TWO  ·  this page
     0. Settings
     1. Start-up
     2. The menu: one part on screen at a time
     3. Part 1 chart: student groups against the Westchester average, two views
     4. The district map
     5. Part 2 chart: school days lost
     6. Part 3 chart: the four steps
     7. Part 4: the $50 million bar
     8. Small helpers (words, the map's color steps, map geometry)
   ========================================================================== */

/* ##########################################################################
   PART ONE  ·  HELPERS
   ########################################################################## */

const WCA = {};


/* --------------------------------------------------------------------------
   COLORS  ·  read from the CSS variables in styles.css
   --------------------------------------------------------------------------
   Keeping the values in CSS means styles.css is the only place a color
   is defined. WCA.colors.blue is the same value as var(--wca-blue). */

WCA.cssVar = function (name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

WCA.colors = {
  blue:      WCA.cssVar("--wca-blue"),
  green:     WCA.cssVar("--wca-green"),
  blue100:   WCA.cssVar("--wca-blue-100"),
  blue200:   WCA.cssVar("--wca-blue-200"),
  blue300:   WCA.cssVar("--wca-blue-300"),
  blue500:   WCA.cssVar("--wca-blue-500"),
  blue700:   WCA.cssVar("--wca-blue-700"),
  orange:    WCA.cssVar("--wca-orange"),
  orange100: WCA.cssVar("--wca-orange-100"),
  ink:       WCA.cssVar("--ink"),
  body:      WCA.cssVar("--body"),
  fine:      WCA.cssVar("--fine"),
  muted:     WCA.cssVar("--muted"),
  rule:      WCA.cssVar("--rule"),
  panel:     WCA.cssVar("--panel"),
  noData:    WCA.cssVar("--map-no-data"),
};

WCA.font = WCA.cssVar("--font");

/* The blue ramp for maps: 5 steps, light to dark. One hue, so darker always means more. */
WCA.blueRamp = [WCA.colors.blue100, WCA.colors.blue200, WCA.colors.blue300, WCA.colors.blue500, WCA.colors.blue700];


/* --------------------------------------------------------------------------
   NUMBER FORMATTING
   -------------------------------------------------------------------------- */

WCA.fmt = {
  /* 6395 -> "6,395" */
  count: function (n) {
    if (n === null || n === undefined) return "n/a";
    return Number(n).toLocaleString("en-US");
  },

  /* 13.9 -> "13.9%". Shares in data.json are already rounded to one decimal. */
  pct: function (n, decimals) {
    if (n === null || n === undefined) return "n/a";
    if (decimals === undefined) decimals = 1;
    return Number(n).toFixed(decimals) + "%";
  },

  /* 10.1 -> "+10.1%", -4.9 -> "−4.9%" (a real minus sign) */
  change: function (n, decimals) {
    if (n === null || n === undefined) return "n/a";
    if (decimals === undefined) decimals = 1;
    var sign = n > 0 ? "+" : (n < 0 ? "−" : "");
    return sign + Math.abs(Number(n)).toFixed(decimals) + "%";
  },

  /* 10.1 -> "up 10.1%", -4.9 -> "down 4.9%", 0 -> "unchanged": the direction in words, for headings */
  direction: function (n, decimals) {
    if (n === null || n === undefined) return "n/a";
    if (decimals === undefined) decimals = 1;
    if (n === 0) return "unchanged";
    return (n > 0 ? "up " : "down ") + Math.abs(Number(n)).toFixed(decimals) + "%";
  },

  /* Pick the right formatter for a unit named in data.json ("count", "%", "change") */
  byUnit: function (n, unit) {
    if (unit === "%") return WCA.fmt.pct(n);
    if (unit === "change") return WCA.fmt.change(n);
    return WCA.fmt.count(n);
  },
};


/* --------------------------------------------------------------------------
   READ FROM data.json BY PATH
   --------------------------------------------------------------------------
   WCA.get(data, "charts.by_place.values.0") -> 22.6
   Used to fill numbers written in the page text, so the text can never
   disagree with the data. */

WCA.get = function (object, path) {
  var parts = path.split(".");
  var value = object;
  for (var i = 0; i < parts.length; i++) {
    if (value === null || value === undefined) return undefined;
    value = value[parts[i]];
  }
  return value;
};

/* Fill every element with a data-fill attribute:
     <span data-fill="headlines.0.value" data-format="count"></span>
   data-format is count (default), pct, change, direction (the sign in words: "up 10.1%"), or raw. */
WCA.fillNumbers = function (data) {
  var elements = document.querySelectorAll("[data-fill]");
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    var value = WCA.get(data, el.getAttribute("data-fill"));
    var format = el.getAttribute("data-format") || "count";
    if (format === "raw") el.textContent = value;
    else if (format === "pct") el.textContent = WCA.fmt.pct(value);
    else if (format === "pct0") el.textContent = WCA.fmt.pct(value, 0);
    else if (format === "change") el.textContent = WCA.fmt.change(value);
    else if (format === "change0") el.textContent = WCA.fmt.change(value, 0);
    else if (format === "direction") el.textContent = WCA.fmt.direction(value, 1);
    else if (format === "direction0") el.textContent = WCA.fmt.direction(value, 0);
    else el.textContent = WCA.fmt.count(value);
  }
};


/* --------------------------------------------------------------------------
   TOOLTIP  ·  one hover box for the whole page (used by the map)
   -------------------------------------------------------------------------- */

WCA.tooltip = {
  element: null,

  /* Make the box the first time it's needed */
  init: function () {
    if (WCA.tooltip.element) return;
    var box = document.createElement("div");
    box.className = "tooltip";
    document.body.appendChild(box);
    WCA.tooltip.element = box;
  },

  /* Show html near the mouse position (x, y are page pixels from the event) */
  show: function (html, x, y) {
    WCA.tooltip.init();
    var box = WCA.tooltip.element;
    box.innerHTML = html;
    box.classList.add("show");
    /* Keep the box on screen: flip it to the left near the right edge */
    var pad = 14;
    var left = x + pad;
    if (left + box.offsetWidth > window.innerWidth - 8) left = x - pad - box.offsetWidth;
    var top = y + pad;
    if (top + box.offsetHeight > window.innerHeight - 8) top = y - pad - box.offsetHeight;
    box.style.left = left + "px";
    box.style.top = top + "px";
  },

  hide: function () {
    if (WCA.tooltip.element) WCA.tooltip.element.classList.remove("show");
  },
};


/* --------------------------------------------------------------------------
   HTML LEGEND
   --------------------------------------------------------------------------
   WCA.legend(container, [{label: "Westchester", color: "#098342"}, ...])
   Writes a row of color swatches with labels. Charts with two or more series
   always get one, so a reader never has to guess from color alone. */

WCA.legend = function (container, items) {
  if (typeof container === "string") container = document.querySelector(container);
  var html = "";
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var swatch = item.pattern
      ? '<span class="swatch" style="background:' + item.pattern + '"></span>'
      : '<span class="swatch" style="background:' + item.color + '"></span>';
    html += '<span class="legend-item">' + swatch + item.label + "</span>";
  }
  container.innerHTML = html;
};


/* --------------------------------------------------------------------------
   CHART.JS DEFAULTS  ·  the look every chart shares
   --------------------------------------------------------------------------
   Called once by the dashboard before it draws anything. Thin marks, light
   solid gridlines, WCA font and text colors, tooltips in the house style. */

WCA.applyChartDefaults = function () {
  var d = Chart.defaults;
  d.font.family = WCA.font;
  d.font.size = 13;
  d.color = WCA.colors.body;                 /* axis labels and legend text */
  d.responsive = true;
  d.maintainAspectRatio = false;             /* the .chart-box height decides */
  d.animation = false;                       /* nothing moves; easier to read and to screenshot */

  d.plugins.legend.display = false;          /* legends are written in HTML (WCA.legend) */
  d.plugins.tooltip.backgroundColor = WCA.colors.ink;
  d.plugins.tooltip.titleFont = { family: WCA.font, size: 13, weight: "600" };
  d.plugins.tooltip.bodyFont = { family: WCA.font, size: 13 };
  d.plugins.tooltip.padding = 8;
  d.plugins.tooltip.cornerRadius = 6;
  d.plugins.tooltip.displayColors = false;

  d.scale.grid.color = WCA.colors.panel;     /* faint, solid gridlines */
  d.scale.grid.drawTicks = false;
  d.scale.border.display = false;
  d.scale.ticks.color = WCA.colors.fine;
  d.scale.ticks.padding = 6;

  d.elements.bar.borderRadius = 4;           /* rounded data ends */
  d.elements.bar.borderSkipped = "start";    /* ...but square at the baseline */
  d.elements.line.borderWidth = 2;
  d.elements.line.tension = 0;               /* straight segments between points */
  d.elements.point.radius = 4;
  d.elements.point.hoverRadius = 6;
  d.elements.point.hitRadius = 12;           /* easy to hover without landing dead center */
};


/* --------------------------------------------------------------------------
   SMALL CHART.JS ADD-ONS ("plugins")
   --------------------------------------------------------------------------
   Chart.js lets us draw extra things after it draws the chart. These two are
   all the dashboards need, so we don't load a plugin library. */

WCA.plugins = {};

/* valueLabels: write each bar's value just past its end.
   Works for vertical and horizontal bars, and for the first segment of a stack.
   Turn on per chart with:
     plugins: { valueLabels: { datasets: [0], format: WCA.fmt.pct } }
   datasets = which series to label (by index); format = how to write the number. */
WCA.plugins.valueLabels = {
  id: "valueLabels",
  afterDatasetsDraw: function (chart, args, options) {
    if (!options || !options.datasets) return;
    var ctx = chart.ctx;
    var horizontal = chart.options.indexAxis === "y";
    ctx.save();
    ctx.font = "600 13px " + WCA.font;
    ctx.fillStyle = WCA.colors.ink;         /* text wears text color, not the series color */
    options.datasets.forEach(function (datasetIndex) {
      var meta = chart.getDatasetMeta(datasetIndex);
      var values = chart.data.datasets[datasetIndex].data;
      meta.data.forEach(function (bar, i) {
        var value = values[i];
        if (value === null || value === undefined) return;
        var text = options.format ? options.format(value) : String(value);
        if (horizontal) {
          ctx.textAlign = "left"; ctx.textBaseline = "middle";
          ctx.fillText(text, bar.x + 6, bar.y);
        } else {
          ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          ctx.fillText(text, bar.x, bar.y - 4);
        }
      });
    });
    ctx.restore();
  },
};

/* pointNotes: a short note beside chosen points on a line chart, e.g. the
   value at the first and last point, or "COVID-19 low" at 2021.
   Turn on per chart with:
     plugins: { pointNotes: { notes: [ {dataset: 0, index: 2, text: "COVID-19 low", place: "below"} ] } }
   place is "above" (default) or "below". */
WCA.plugins.pointNotes = {
  id: "pointNotes",
  afterDatasetsDraw: function (chart, args, options) {
    if (!options || !options.notes) return;
    var ctx = chart.ctx;
    ctx.save();
    ctx.font = "600 12px " + WCA.font;
    ctx.fillStyle = WCA.colors.ink;
    ctx.textAlign = "center";
    options.notes.forEach(function (note) {
      var meta = chart.getDatasetMeta(note.dataset || 0);
      var point = meta.data[note.index];
      if (!point) return;
      /* keep the text inside the chart area, left or right */
      var x = Math.min(Math.max(point.x, chart.chartArea.left + 28), chart.chartArea.right - 28);
      if (note.place === "below") { ctx.textBaseline = "top";    ctx.fillText(note.text, x, point.y + 8); }
      else                        { ctx.textBaseline = "bottom"; ctx.fillText(note.text, x, point.y - 8); }
    });
    ctx.restore();
  },
};

/* ##########################################################################
   PART TWO  ·  THIS PAGE
   ########################################################################## */

/* --------------------------------------------------------------------------
   0. SETTINGS  ·  the things a person might change
   -------------------------------------------------------------------------- */

var DATA_FILE = "data/data.json";
var GEOGRAPHY_FILE = "data/Geography.json";

/* This dashboard's own colors that the code needs, read from part A2 of styles.css */
var SNS = {
  rateRamp:   [1, 2, 3, 4, 5].map(function (i) { return WCA.cssVar("--sns-rate-" + i); }),   /* the map's five steps */
};

/* The map's drawing box (also in index.html's <svg viewBox>): Westchester is taller than wide */
var MAP_WIDTH = 520, MAP_HEIGHT = 700;

/* The three children drawn at the top of index.html: the figures in the charts of parts 1 and 3 */
var KID_DRAWINGS = ["kid-a", "kid-b", "kid-c"];


/* --------------------------------------------------------------------------
   1. START-UP  ·  start the menu, load both files, then draw everything
   -------------------------------------------------------------------------- */

var menu = { startAtMenu: false };      /* true when the page's address named a part: the page then opens at the menu */
startMenu();

Promise.all([
  fetch(DATA_FILE).then(function (r) { if (!r.ok) throw new Error(DATA_FILE + " not found"); return r.json(); }),
  fetch(GEOGRAPHY_FILE).then(function (r) { if (!r.ok) throw new Error(GEOGRAPHY_FILE + " not found"); return r.json(); }),
]).then(function (files) {
  var data = files[0];
  var geography = files[1];

  WCA.fillNumbers(data);

  drawGroups(data);
  drawMap(data, geography);

  drawDaysLost(data);
  drawSteps(data);
  drawMoneyBar();

  if (menu.startAtMenu) toMenu();          /* now that everything above the menu has its final height */
}).catch(function (error) {
  /* Most likely cause: the page was opened straight from a folder (file://), which
     blocks loading data files. It needs a web server; see the README. */
  var message = document.getElementById("load-error");
  message.textContent = "Couldn't load the data (" + error.message + "). " +
    "This page has to be opened through a web server, not straight from a folder. See the README.";
  message.hidden = false;
  console.error(error);
});


/* --------------------------------------------------------------------------
   2. THE MENU  ·  one part on screen at a time, as in the Data Bulletin dashboard
   --------------------------------------------------------------------------
   The four tabs under the numbers at the top show one part and hide the other
   three. Each part ends with a "Continue" button that opens the next one.
     * When the reader chooses a part, it is written at the end of the page's
       address (#part-2). A link with that ending opens the page on that part,
       at the menu.
     * The menu stays at the top of the screen while scrolling. Choosing a part
       from there starts it at its top.
     * On a keyboard, the left and right arrows move from tab to tab.
   A tab's data-tab ("part-2") names its part; the part's own id is "panel-part-2". */

function startMenu() {
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () { openPart(tab.getAttribute("data-tab")); });
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-go]"), function (button) {
    button.addEventListener("click", function () { openPart(button.getAttribute("data-go"), true); });
  });
  document.querySelector(".tabbar .inner").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    var next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    openPart(next.getAttribute("data-tab"));
    e.preventDefault();
  });
  window.addEventListener("hashchange", function () { if (isPart(location.hash.slice(1))) openPart(location.hash.slice(1), true); });

  /* Open on the part named in the address, else the first. Nothing is written to the address yet. */
  var named = location.hash.slice(1);
  menu.startAtMenu = isPart(named);
  showPart(menu.startAtMenu ? named : tabs[0].getAttribute("data-tab"));
}

/* True if `id` is one of the parts in the menu */
function isPart(id) {
  return !!id && !!document.querySelector('.tab[data-tab="' + id + '"]');
}

/* Show one part and hide the others */
function showPart(id) {
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (tab) {
    var chosen = tab.getAttribute("data-tab") === id;
    tab.setAttribute("aria-selected", chosen ? "true" : "false");
    tab.tabIndex = chosen ? 0 : -1;
    if (chosen) {
      /* On a phone the menu scrolls sideways: bring the chosen tab into view */
      var row = tab.parentNode;
      row.scrollLeft = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
    }
  });
  Array.prototype.forEach.call(document.querySelectorAll(".tabpanel"), function (panel) {
    panel.hidden = panel.id !== "panel-" + id;
  });
  WCA.tooltip.hide();
}

/* The reader chose a part: show it and write it at the end of the page's address.
   toTop = start the part at its top whatever the scroll position (the Continue buttons, a link). */
function openPart(id, toTop) {
  showPart(id);
  if (history.replaceState) history.replaceState(null, "", "#" + id);

  /* Start the part at its top when asked to, or when the reader had scrolled down the last part
     (the menu is then stuck to the top of the screen) */
  if (toTop || document.getElementById("menu-top").getBoundingClientRect().top < 0) toMenu();
}

/* Scroll so that the menu is at the top of the screen. "menu-top" marks where the menu sits on the page. */
function toMenu() {
  window.scrollTo(0, window.pageYOffset + document.getElementById("menu-top").getBoundingClientRect().top);
}


/* --------------------------------------------------------------------------
   3. PART 1 CHART  ·  student groups against the Westchester average, two views
   --------------------------------------------------------------------------
   One row per group, the group sent home most first, then the average. Each row
   is a line of child figures: one figure for each 1 of every 100 students in the
   group who was sent home (whole figures, worked out by the script). A dashed
   orange line marks the average in every row.
   The chart has two views: it opens on race and ethnicity, and the two buttons
   above it switch to the other student groups and back.
     * The views, their groups, labels, order, title words and the sentence under
       the chart all come from data.json "who" (set in the script's CHART_VIEWS).
     * The figures are three of the drawings at the top of index.html.
     * The colors are set in styles.css.
   No chart library here: the rows are plain HTML, laid out by styles.css. */

var groupsChart = { who: null };      /* data.json "who", kept for switching views */

function drawGroups(data) {
  var who = data.who;
  groupsChart.who = who;
  var chart = document.getElementById("chart-groups");

  /* The two numbers the layout needs: how many figures fit in a row (the longest row of either
     view, so the figures keep their size when the view changes), and where the average falls.
     One figure is 1 in 100, so the average rate (2.2%) sits 2.2 figures along. */
  chart.style.setProperty("--slots", who.figures_in_longest_row);
  chart.style.setProperty("--average", who.average.rate);

  /* The buttons that switch views, in the script's order */
  var buttons = document.getElementById("groups-views");
  buttons.innerHTML = who.view_order.map(function (id) {
    return '<button type="button" data-view="' + id + '" aria-pressed="false">' + who.views[id].button + "</button>";
  }).join("");
  Array.prototype.forEach.call(buttons.querySelectorAll("button"), function (button) {
    button.addEventListener("click", function () { showView(button.getAttribute("data-view")); });
  });

  /* Hover (or tap) a row for its counts and how it compares with the average */
  chart.addEventListener("mousemove", function (e) {
    var row = e.target.closest(".kidrow");
    if (!row) { WCA.tooltip.hide(); return; }
    var id = row.getAttribute("data-group");
    WCA.tooltip.show(groupTooltip(id === "average" ? who.average : who.by_id[id], id, who.year), e.clientX, e.clientY);
  });
  chart.addEventListener("mouseleave", WCA.tooltip.hide);

  showView(who.default_view);
}

/* Show one view: its rows, and the words around the chart that go with it */
function showView(id) {
  var who = groupsChart.who;
  var view = who.views[id];

  var rows = view.groups.map(function (g) { return { id: g.id, entry: g }; });
  rows.push({ id: "average", entry: who.average });
  document.getElementById("chart-groups").innerHTML =
    rows.map(function (row, i) { return groupRow(row.entry, row.id, i); }).join("");

  Array.prototype.forEach.call(document.querySelectorAll("#groups-views button"), function (button) {
    button.setAttribute("aria-pressed", button.getAttribute("data-view") === id ? "true" : "false");
  });

  /* The title: the groups furthest above the average, and how far */
  document.getElementById("groups-title-names").textContent = view.title.names;
  document.getElementById("groups-title-times").textContent = view.title.times;

  /* "How to read it": the first row of this view */
  document.getElementById("groups-read-words").textContent = view.groups[0].words;
  document.getElementById("groups-read-number").textContent = WCA.fmt.count(view.groups[0].per_100);

  /* Groups the small-number rule holds back are named under the chart */
  document.getElementById("note-groups").textContent = view.left_out.length
    ? "Not shown, too few students to compare: " + listWords(view.left_out) + "."
    : "";

  /* The sentence under the chart, shown only while the data says it is true */
  document.getElementById("groups-also").hidden = !view.also.show;
  document.getElementById("groups-also-lead").textContent = view.also.lead;
  document.getElementById("groups-also-subject").textContent = view.also.subject;

  WCA.tooltip.hide();
}

/* One row: the group's name and counts, its line of figures, then "1 in N" and the rate.
   The first row also carries the "Westchester average" tag above the dashed line; the
   average's own row carries the same words beside the line (styles.css shows one or the
   other, depending on the width of the screen). */
function groupRow(entry, id, rowIndex) {
  var kids = "";
  for (var k = 0; k < entry.per_100; k++) {
    var drawing = KID_DRAWINGS[(k * 2 + rowIndex) % KID_DRAWINGS.length];     /* mix the three children */
    kids += '<svg class="kid" viewBox="0 0 120 220"><use href="#' + drawing + '"></use></svg>';
  }
  var counts = WCA.fmt.count(entry.sent_home) + " of " + WCA.fmt.count(entry.enrolled) + " students";
  return '<li class="kidrow" data-group="' + id + '">' +
    '<div class="who"><div class="name">' + entry.label + "</div>" +
      '<div class="counts">' + (entry.small ? "A small group: " : "") + counts + "</div></div>" +
    '<div class="track kids" aria-hidden="true">' + kids + averageWords(id, rowIndex) + "</div>" +
    '<div class="value"><span class="one-in">1 in ' + WCA.fmt.count(entry.one_in) + "</span> " +
      '<span class="pct">' + WCA.fmt.pct(entry.rate) + "</span></div>" +
  "</li>";
}

/* "Westchester average": as a tag in the first row, and beside the line in the average's own row */
function averageWords(id, rowIndex) {
  return (rowIndex === 0 ? '<span class="average-tag">Westchester average</span>' : "") +
         (id === "average" ? '<span class="average-note">Westchester average</span>' : "");
}

/* The hover box for a row */
function groupTooltip(entry, id, year) {
  var html = "<strong>" + entry.label + "</strong><br>" +
    WCA.fmt.count(entry.sent_home) + " of " + WCA.fmt.count(entry.enrolled) + " students were sent home at least once in " +
    year + " (" + WCA.fmt.pct(entry.rate) + ")";
  if (id !== "average") html += "<br>" + Number(entry.times_average).toFixed(1) + " times the Westchester average";
  return html;
}


/* --------------------------------------------------------------------------
   4. THE DISTRICT MAP  ·  Westchester's public school districts
   --------------------------------------------------------------------------
   How it works:
     a. Each district's outline comes as longitude/latitude points. makeProjection()
        turns them into x/y on the drawing, scaled to fit the SVG box.
     b. One SVG <path> is drawn per district, colored by the share of its students
        sent home: five blue steps, fixed in data.json so a color means the
        same thing every year. A district with too few students to show is hatched;
        an outline with no data (the sliver of Putnam Valley) is plain gray.
     c. Hovering shows a small box; tapping or clicking a district, or picking it
        from the list, fills the side panel with the district next to the
        Westchester average. The panel starts on Westchester as a whole.
   -------------------------------------------------------------------------- */

var map = {
  data: null,             /* data.json "districts" */
  group: null,            /* the <g> that holds the district paths */
  paths: {},              /* district code -> its <path> */
  selected: null,         /* district code shown in the side panel (null = Westchester as a whole) */
  highestRate: 0,         /* the highest district rate: the full length of the side panel's small bars */
};

function drawMap(data, geography) {
  map.data = data.districts;
  map.group = document.getElementById("map-districts");
  var places = map.data.places;
  var codes = Object.keys(places);

  /* a. Fit the outlines into the SVG box with a little margin */
  var project = makeProjection(geography.features, MAP_WIDTH, MAP_HEIGHT, 8);

  /* b. One path per district */
  geography.features.forEach(function (feature) {
    var code = feature.properties.district_code;
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathFor(feature.geometry, project));
    path.setAttribute("class", "district");
    path.setAttribute("fill", fillFor(code));
    path.addEventListener("mousemove", function (e) { showDistrictTooltip(code, e.clientX, e.clientY); });
    path.addEventListener("mouseleave", WCA.tooltip.hide);
    path.addEventListener("click", function () { selectDistrict(code); });
    map.group.appendChild(path);
    map.paths[code] = path;
  });

  /* The legend: the color steps, then "too few" (only if a district is hatched) and "no data" */
  var legend = stepLabels(map.data.legend.steps).map(function (label, i) { return { label: label, color: SNS.rateRamp[i] }; });
  if (codes.some(function (code) { return tooFew(places[code]); })) {
    legend.push({ label: "Too few students to show", pattern: "repeating-linear-gradient(45deg, #B5B5B5 0 1px, #F4F4F4 1px 5px)" });
  }
  if (Object.keys(map.data.no_data).length) legend.push({ label: "No data", color: WCA.colors.noData });
  WCA.legend("#map-legend", legend);

  map.highestRate = Math.max.apply(null, codes.map(function (code) { return places[code].rate || 0; }));

  /* The district list: Westchester as a whole first, then every district A to Z */
  var select = document.getElementById("district-select");
  var first = document.createElement("option");
  first.value = "";
  first.textContent = "All of Westchester";
  select.appendChild(first);
  codes
    .sort(function (a, b) { return places[a].label.localeCompare(places[b].label); })
    .forEach(function (code) {
      var option = document.createElement("option");
      option.value = code;
      option.textContent = places[code].label;
      select.appendChild(option);
    });
  select.addEventListener("change", function () { selectDistrict(select.value || null); });

  selectDistrict(null);
}

/* True when a district's rate can't be shown (the small-number rule, or no rate in the table) */
function tooFew(place) {
  return place.too_few || place.rate === null;
}

/* The fill color for one district */
function fillFor(code) {
  var place = map.data.places[code];
  if (!place) return WCA.colors.noData;                       /* an outline with no Westchester data */
  if (tooFew(place)) return "url(#hatch)";
  return stepColor(place.rate, map.data.legend.steps, SNS.rateRamp);
}

/* The hover box for a district */
function showDistrictTooltip(code, x, y) {
  var place = map.data.places[code];
  var html;
  if (!place) html = map.data.no_data[code] || "No data";
  else if (tooFew(place)) html = "<strong>" + place.label + "</strong><br>Too few students to show";
  else html = "<strong>" + place.label + "</strong><br>" + WCA.fmt.pct(place.rate) + " of students sent home, " + map.data.year;
  WCA.tooltip.show(html, x, y);
}

/* Mark a district as chosen and show it in the side panel (null = Westchester as a whole) */
function selectDistrict(code) {
  if (map.selected && map.paths[map.selected]) map.paths[map.selected].classList.remove("selected");
  map.selected = code && map.data.places[code] ? code : null;
  if (map.selected) {
    var path = map.paths[map.selected];
    path.classList.add("selected");
    map.group.appendChild(path);           /* on top, so the outline isn't hidden by neighbors */
  }
  document.getElementById("district-select").value = map.selected || "";
  fillSidePanel(map.selected);
}

/* The side panel: the chosen district next to the Westchester average, as two big numbers
   with a small bar under each (both bars drawn against the highest district rate). */
function fillSidePanel(code) {
  var county = map.data.county;
  var panel = document.getElementById("side-panel");

  function number(name, rate, kind) {
    var width = rate === null ? 0 : Math.max(2, rate / map.highestRate * 100);
    return '<div class="versus-item ' + kind + '">' +
      '<div class="versus-number">' + (rate === null ? "Too few" : WCA.fmt.pct(rate)) + "</div>" +
      '<div class="versus-name">' + name + "</div>" +
      '<div class="versus-bar"><span style="width:' + width + '%"></span></div></div>';
  }
  function sentence(p) {
    var counts = " (" + WCA.fmt.count(p.sent_home) + " of " + WCA.fmt.count(p.enrolled) + ")";
    if (!p.sent_home) return "No students were sent home in " + oneLine(map.data.year) + counts + ".";
    return "<strong>1 in " + WCA.fmt.count(p.one_in) + "</strong> students was sent home at least once in " +
           oneLine(map.data.year) + counts + ".";
  }

  if (!code) {
    panel.innerHTML =
      "<h3>All of Westchester</h3>" +
      '<div class="towns">Every school in the county, including special act districts and charter schools</div>' +
      '<div class="versus one">' + number(county.label, county.rate, "average") + "</div>" +
      '<p class="versus-text">' + sentence(county) + "</p>";
    return;
  }

  var p = map.data.places[code];
  panel.innerHTML =
    "<h3>" + p.label + "</h3>" +
    '<div class="towns">Serves ' + servesText(p.municipalities) + "</div>" +
    '<div class="versus">' + number(p.label, tooFew(p) ? null : p.rate, "district") + number(county.label, county.rate, "average") + "</div>" +
    '<p class="versus-text">' + (tooFew(p) ? "Too few students to show a share." : sentence(p)) + "</p>";
}

/* "Village of Ardsley (45%); Town of Greenburgh (outside villages) (39%)" -> "Village of Ardsley, Town of Greenburgh (outside villages)" */
function servesText(municipalities) {
  if (!municipalities) return "";
  return municipalities.replace(/\s\(<?\d+%\)/g, "").split("; ").join(", ");
}


/* --------------------------------------------------------------------------
   5. PART 2 CHART  ·  school days lost, five groups against the Westchester average
   --------------------------------------------------------------------------
   The same rows as part 1's chart, with a bar in place of the figures. The bar
   is school days sent home for every 100 students in the group, drawn in blocks
   of one school week (5 days), so a longer bar is more weeks of school lost.
   A dashed orange line marks the average in every row. Groups, labels and order
   come from data.json "lost" (set in the script's LOST_GROUPS). */

function drawDaysLost(data) {
  var lost = data.lost;
  var chart = document.getElementById("chart-days");

  /* The numbers the layout needs: the longest bar (the full width), where the average falls,
     and how many days one block stands for */
  chart.style.setProperty("--longest", lost.longest_bar);
  chart.style.setProperty("--average", lost.average.per_100);
  chart.style.setProperty("--week", lost.week);

  var rows = lost.groups.map(function (g) { return { id: g.id, entry: g }; });
  rows.push({ id: "average", entry: lost.average });
  chart.innerHTML = rows.map(function (row, i) { return daysRow(row.entry, row.id, i, lost.week); }).join("");

  /* Hover (or tap) a row for its counts and how it compares with the average */
  chart.addEventListener("mousemove", function (e) {
    var row = e.target.closest(".kidrow");
    if (!row) { WCA.tooltip.hide(); return; }
    var found = rows.filter(function (r) { return r.id === row.getAttribute("data-group"); })[0];
    WCA.tooltip.show(daysTooltip(found.entry, found.id, lost.year), e.clientX, e.clientY);
  });
  chart.addEventListener("mouseleave", WCA.tooltip.hide);

  document.getElementById("note-days").textContent = lost.left_out.length
    ? "Not shown, too few students to compare: " + listWords(lost.left_out) + "."
    : "";
}

/* One row: the group's name and counts, its bar of school-week blocks, then the days for every 100 students */
function daysRow(entry, id, rowIndex, week) {
  var whole = Math.floor(entry.per_100 / week);              /* full weeks */
  var rest = entry.per_100 - whole * week;                   /* days left over: a shorter last block */
  var blocks = "";
  for (var k = 0; k < whole; k++) blocks += '<i class="block"></i>';
  if (rest > 0.05) blocks += '<i class="block short" style="--days:' + rest.toFixed(1) + '"></i>';

  var counts = WCA.fmt.count(entry.days) + " days, " + WCA.fmt.count(entry.enrolled) + " students";
  return '<li class="kidrow" data-group="' + id + '">' +
    '<div class="who"><div class="name">' + entry.label + "</div>" +
      '<div class="counts">' + (entry.small ? "A small group: " : "") + counts + "</div></div>" +
    '<div class="track blocks" aria-hidden="true">' + blocks + averageWords(id, rowIndex) + "</div>" +
    '<div class="value"><span class="one-in">' + WCA.fmt.count(entry.per_100_whole) + "</span> " +
      '<span class="pct">days for every 100 students</span></div>' +
  "</li>";
}

/* The hover box for a row */
function daysTooltip(entry, id, year) {
  var html = "<strong>" + entry.label + "</strong><br>" +
    WCA.fmt.count(entry.days) + " school days sent home among " + WCA.fmt.count(entry.enrolled) + " students in " + year +
    ": " + WCA.fmt.count(entry.per_100_whole) + " for every 100 students";
  if (id !== "average") html += "<br>" + Number(entry.times_average).toFixed(1) + " times the Westchester average";
  return html;
}


/* --------------------------------------------------------------------------
   6. PART 3 CHART  ·  the four steps, from students to under-18 felony arrests
   --------------------------------------------------------------------------
   One card per step, joined by a dotted line. Each card has 10 figures: the dark
   ones are how many of every 10 at that step are Black (whole figures, worked out
   by the script). A dashed orange line in every card marks their share of all
   students, the first step. Steps, labels and order come from data.json "path"
   (set in the script's PATH_STEPS). */

function drawSteps(data) {
  var path = data.path;
  var list = document.getElementById("chart-steps");

  /* Where the dashed line falls in a row of 10 figures: the share of all students, in percent */
  list.style.setProperty("--baseline", path.steps[0].share);

  list.innerHTML = path.steps.map(function (step, i) {
    var kids = "";
    for (var k = 0; k < 10; k++) {
      kids += '<svg class="kid' + (k < step.in_10 ? " on" : "") + '" viewBox="0 0 120 220"><use href="#' +
              KID_DRAWINGS[(k + i) % KID_DRAWINGS.length] + '"></use></svg>';
    }
    /* A step's years are written only when they differ from the school year (the arrests) */
    var counts = WCA.fmt.count(step.count) + " of " + WCA.fmt.count(step.total) + " " + step.counted +
                 (step.period === data.meta.latest_year ? "" : ", " + oneLine(step.period));
    return '<li class="step">' +
      '<span class="step-stop" aria-hidden="true">' + (i + 1) + "</span>" +
      '<div class="step-card">' +
        '<div class="step-label">' + step.label + "</div>" +
        '<div class="step-kids" aria-hidden="true">' + kids + "</div>" +
        '<div class="step-number">' + step.in_10 + ' in 10<span class="visually-hidden"> are ' + path.word + "</span></div>" +
        '<div class="step-counts">' + counts + "</div>" +
      "</div>" +
    "</li>";
  }).join("");
}


/* --------------------------------------------------------------------------
   7. PART 4  ·  the $50 million as one bar split three ways
   --------------------------------------------------------------------------
   The amounts are typed in index.html (data-amount, in millions) because they come
   from the coalition's budget letter, not from the data. This only sizes the pieces. */

function drawMoneyBar() {
  var pieces = document.querySelectorAll("#money-bar [data-amount]");
  var total = 0;
  Array.prototype.forEach.call(pieces, function (el) { total += Number(el.getAttribute("data-amount")); });
  Array.prototype.forEach.call(pieces, function (el) {
    el.style.width = (Number(el.getAttribute("data-amount")) / total * 100) + "%";
  });
}


/* --------------------------------------------------------------------------
   8. SMALL HELPERS
   -------------------------------------------------------------------------- */

/* ["A", "B", "C"] -> "A, B and C" */
function listWords(items) {
  if (items.length < 2) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

/* Keep a year or a span of years ("2024-25", "2023-2025") on one line, so it never splits at its hyphen */
function oneLine(text) {
  return '<span class="nowrap">' + text + "</span>";
}

/* The color step a value falls in: steps [1, 2, 3, 5] make five steps, under 1 up to 5 or more */
function stepColor(value, steps, ramp) {
  var i = 0;
  while (i < steps.length && value >= steps[i]) i++;
  return ramp[i];
}

/* Legend words for the map's steps: [1, 2, 3, 5] -> "Under 1%", "1–1.9%", "2–2.9%", "3–4.9%", "5% or more".
   Values on the page have one decimal, so each step ends 0.1 below the next one. */
function stepLabels(steps) {
  var labels = ["Under " + steps[0] + "%"];
  for (var i = 0; i < steps.length - 1; i++) {
    labels.push(steps[i] + "–" + (Math.round((steps[i + 1] - 0.1) * 10) / 10) + "%");
  }
  labels.push(steps[steps.length - 1] + "% or more");
  return labels;
}

/* --- Map geometry (from the Youth Justice Dashboard) ------------------------ */

/* Turn longitude/latitude into drawing coordinates.
   Uses the Web Mercator formula (the one web maps use) so the county's shape looks right,
   then scales and centres everything to fit the box. Returns a function (lon, lat) -> [x, y]. */
function makeProjection(features, width, height, margin) {
  function mercator(lon, lat) {
    var x = lon * Math.PI / 180;
    var y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
    return [x, y];
  }
  /* Find the bounds of every point, projected */
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  features.forEach(function (f) {
    eachRing(f.geometry, function (ring) {
      ring.forEach(function (p) {
        var xy = mercator(p[0], p[1]);
        if (xy[0] < minX) minX = xy[0]; if (xy[0] > maxX) maxX = xy[0];
        if (xy[1] < minY) minY = xy[1]; if (xy[1] > maxY) maxY = xy[1];
      });
    });
  });
  var scale = Math.min((width - 2 * margin) / (maxX - minX), (height - 2 * margin) / (maxY - minY));
  var offsetX = (width - (maxX - minX) * scale) / 2;
  var offsetY = (height - (maxY - minY) * scale) / 2;
  return function (lon, lat) {
    var xy = mercator(lon, lat);
    return [ (xy[0] - minX) * scale + offsetX, (maxY - xy[1]) * scale + offsetY ];   /* y flipped: north is up */
  };
}

/* Call fn(ring) for every ring of a Polygon or MultiPolygon */
function eachRing(geometry, fn) {
  var polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  polygons.forEach(function (polygon) { polygon.forEach(fn); });
}

/* The SVG path text ("M x,y L x,y ... Z") for a district's outline */
function pathFor(geometry, project) {
  var d = "";
  eachRing(geometry, function (ring) {
    ring.forEach(function (p, i) {
      var xy = project(p[0], p[1]);
      d += (i === 0 ? "M" : "L") + xy[0].toFixed(1) + "," + xy[1].toFixed(1);
    });
    d += "Z";
  });
  return d;
}
