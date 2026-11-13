/* ==========================================================================
   suspensions/charts.js
   ==========================================================================
   Runs the menu and draws everything on the Suspensions Dashboard page.
   Read top to bottom.

   WHAT HAPPENS WHEN THE PAGE LOADS
     1. Load data/data.json (the numbers, built by update_data_here/build_data.py).
     2. Fill in the numbers written inside sentences (the <span data-fill> tags in index.html).
     3. Draw the three headline tiles.
     4. Open the part named in the address (…/#part-2), or part 1. A part's charts are
        drawn with Chart.js (resources/vendor/chart.umd.js) the first time it is opened.
     5. "Find your district" also loads data/Geography.json (the district outlines) the
        first time it is opened, then draws the map, the list, the town search and the card.

   Nothing here defines a color; every color is read from styles.css (WCA.colors and SNS).

   PART ONE  ·  helpers, all on one object called WCA
                (copied unchanged from the Youth Justice Dashboard)
     WCA.colors        the brand colors, read from styles.css
     WCA.fmt           number formatting: 6395 -> "6,395", 13.9 -> "13.9%"
     WCA.get           read a value out of data.json by a dotted path
     WCA.fillNumbers   fill the <span data-fill> tags in the page text
     WCA.tooltip       the hover box: show(html, x, y) and hide()
     WCA.legend        write an HTML legend for a chart
     WCA.applyChartDefaults   the look every Chart.js chart shares
     WCA.plugins       two small Chart.js add-ons (not used on this page)

   PART TWO  ·  this page
     0. Settings
     1. Start-up
     2. Numbers in sentences, and the headline tiles
     3. The menu
     4. Chart add-ons: labels at the bar ends, the dashed line, the shaded years
     5. Part 1's charts
     6. Part 2's chart
     7. Part 3's charts
     8. Find your district: the map, the list, the town search, the district card
     9. Small helpers
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

var MAP_WIDTH = 520;        /* the map's drawing box: the same two numbers as viewBox in index.html */
var MAP_HEIGHT = 700;
var BAR_THICKNESS = 22;     /* how thick a bar is, in pixels, in every bar chart */
var ROW_HEIGHT = 40;        /* how much height each bar's row gets, in pixels */
var NARROW = 520;           /* a chart narrower than this many pixels (a phone) gets shorter labels */
var SEARCH_RESULTS = 8;     /* how many districts the town search lists at most */

/* This dashboard's colors, read from part A2 of styles.css */
var SNS = {
  data:     WCA.cssVar("--sns-data"),        /* the bars */
  average:  WCA.cssVar("--sns-average"),     /* orange: what the bars are compared with, and the dashed line (parts 1 and 2);
                                                in part 3, the "Suspended" and "Felony arrests" bars */
  other:    WCA.cssVar("--sns-other"),       /* everyone else (not used on the page now; kept for later) */
  white:    WCA.cssVar("--white"),
};


/* --------------------------------------------------------------------------
   1. START-UP  ·  load the numbers, fill the text, open the first part
   -------------------------------------------------------------------------- */

var DATA = null;            /* data.json, once it has loaded */
var drawn = {};             /* which parts have been drawn already, e.g. drawn["part-2"] = true */

/* What to draw the first time each part is opened. The names match the tabs in index.html. */
var PARTS = {
  "part-1":   function () { drawWho(DATA); },
  "part-2":   function () { drawLost(DATA); },
  "part-3":   function () { drawPath(DATA); },
  "part-4":   function () { },                 /* no chart: its numbers are filled into the text */
  "district": function () { loadMap(DATA); },
  "about":    function () { },                 /* About the data: words only. It has no tab; the link in the top band opens it */
};

fetch(DATA_FILE)
  .then(function (r) { if (!r.ok) throw new Error(DATA_FILE + " not found"); return r.json(); })
  .then(function (data) {
    DATA = data;
    WCA.applyChartDefaults();
    WCA.fillNumbers(data);
    fillMore(data);
    drawHeadlines(data);
    setUpMenu();
  })
  .catch(function (error) {
    /* Most likely cause: the page was opened straight from a folder (file://), which
       blocks loading data files. It needs a web server; see the README. */
    document.getElementById("tiles").innerHTML =
      '<p class="fine">Couldn\'t load the data (' + error.message + '). ' +
      'This page has to be opened through a web server, not straight from a folder. See the README.</p>';
    console.error(error);
  });


/* --------------------------------------------------------------------------
   2. NUMBERS IN SENTENCES, AND THE HEADLINE TILES
   -------------------------------------------------------------------------- */

/* WCA.fillNumbers (part one) writes counts and text. This page writes numbers three more ways:
     data-format="one"     one decimal, always: 6.6, 1.0     (students out of 100)
     data-format="whole"   rounded to a whole number: 53     (school days)
     data-format="times"   how many times as much: 3, 3.6    (never 3.0)
     data-format="roughly" how many times, in words: "almost 9" (8.9), "3" (3.0), "more than 4" (4.2) */
function fillMore(data) {
  var elements = document.querySelectorAll('[data-format="one"], [data-format="whole"], [data-format="times"], [data-format="roughly"]');
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    var value = WCA.get(data, el.getAttribute("data-fill"));
    var format = el.getAttribute("data-format");
    if (value === null || value === undefined) el.textContent = "n/a";
    else if (format === "one") el.textContent = one(value);
    else if (format === "roughly") el.textContent = roughlyText(value);
    else if (format === "whole") el.textContent = WCA.fmt.count(Math.round(value));
    else el.textContent = timesText(value);
  }
}

/* One tile per entry in data.json "headlines". A "per100" number gets "out of 100" after it. */
function drawHeadlines(data) {
  var html = "";
  data.headlines.forEach(function (h) {
    var value = h.unit === "per100"
      ? one(h.value) + ' <span class="unit">out of 100</span>'
      : WCA.fmt.count(h.value);
    html += '<div class="tile">';
    html += '  <div class="value">' + value + "</div>";
    /* Keep a school year such as "2024-25" on one line, so it never breaks at the hyphen */
    var label = h.label.replace(/(\d{4}-\d{2})/g, '<span class="year">$1</span>');
    html += '  <div class="label">' + label + "</div>";
    if (h.note) html += '  <div class="compare">' + h.note + "</div>";
    html += "</div>";
  });
  document.getElementById("tiles").innerHTML = html;
}


/* --------------------------------------------------------------------------
   3. THE MENU  ·  one part on screen at a time
   --------------------------------------------------------------------------
   Each tab in index.html has data-tab="part-2"; its part has id="panel-part-2".
   The address remembers the part (…/#part-2), so a link or a QR code can open
   the page on any part, and the browser's back button works. */

function setUpMenu() {
  var tabs = document.querySelectorAll(".tab");
  for (var i = 0; i < tabs.length; i++) {
    (function (tab, index) {
      tab.addEventListener("click", function () { showPart(tab.dataset.tab, true); });
      /* The left and right arrow keys move from tab to tab, as keyboard users expect */
      tab.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        var step = e.key === "ArrowRight" ? 1 : tabs.length - 1;
        var next = tabs[(index + step) % tabs.length];
        next.focus();
        showPart(next.dataset.tab, false, true);
      });
    })(tabs[i], i);
  }

  /* The "Continue to ..." button at the end of each part: data-go names the part to open */
  var buttons = document.querySelectorAll("[data-go]");
  for (var b = 0; b < buttons.length; b++) {
    (function (button) {
      button.addEventListener("click", function () { showPart(button.dataset.go, true, true); });
    })(buttons[b]);
  }

  /* The links in the top band ("Find your district", "About the data") open their part and move the screen to it */
  var links = document.querySelectorAll('.banner-links a, .source a[href^="#"]');   /* and a source line's link to "About the data" */
  for (var l = 0; l < links.length; l++) {
    links[l].addEventListener("click", function (e) {
      e.preventDefault();
      showPart(this.getAttribute("href").replace("#", ""), true, true);
    });
  }

  window.addEventListener("hashchange", function () { showPart(partInAddress(), false, false); });
  showPart(partInAddress(), false, false);
}

/* The part named in the address, e.g. "part-3" for …/#part-3. Part 1 when there is none. */
function partInAddress() {
  var name = window.location.hash.replace("#", "");
  return PARTS[name] ? name : "part-1";
}

/* Show one part and hide the others.
     jump       true = also move the screen up to the menu, so the part starts at the top
     remember   true = also write the part into the address */
function showPart(name, jump, remember) {
  var tabs = document.querySelectorAll(".tab");
  for (var i = 0; i < tabs.length; i++) {
    var on = tabs[i].dataset.tab === name;
    tabs[i].setAttribute("aria-selected", on ? "true" : "false");
    tabs[i].tabIndex = on ? 0 : -1;
    if (on) {
      /* on a phone the tabs slide sideways: bring the chosen one to the middle */
      var strip = tabs[i].parentNode;
      strip.scrollLeft = tabs[i].offsetLeft - (strip.clientWidth - tabs[i].offsetWidth) / 2;
    }
  }
  var panels = document.querySelectorAll(".tabpanel");
  for (var p = 0; p < panels.length; p++) panels[p].hidden = panels[p].id !== "panel-" + name;

  /* A part's charts are drawn the first time it is on screen (a chart can't measure itself while hidden) */
  if (!drawn[name]) { drawn[name] = true; PARTS[name](); }

  if ((jump || remember) && window.location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  if (jump) {
    var menu = document.querySelector(".tabbar");
    window.scrollTo(0, menu.getBoundingClientRect().top + window.pageYOffset);
  }
}


/* --------------------------------------------------------------------------
   4. CHART ADD-ONS ("plugins")  ·  three small things drawn on top of Chart.js
   -------------------------------------------------------------------------- */

/* barLabels: the words just past the end of each bar, on a white patch so the dashed line
   never runs through them. Turn on per chart with:
     plugins: { barLabels: { text: function (i, narrow) { return ["53 days", "29% of a school year"]; } } }
   text gives the label for bar number i as [bold part, lighter part]; narrow is true on a phone. */
var barLabels = {
  id: "barLabels",
  afterDatasetsDraw: function (chart, args, options) {
    if (!options || !options.text) return;
    var ctx = chart.ctx;
    var narrow = chart.width < NARROW;
    var bold = "600 13px " + WCA.font;
    var light = "400 13px " + WCA.font;
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    chart.getDatasetMeta(0).data.forEach(function (bar, i) {
      var parts = options.text(i, narrow);
      if (!parts) return;
      ctx.font = bold;
      var boldWidth = ctx.measureText(parts[0]).width;
      ctx.font = light;
      var lightWidth = parts[1] ? ctx.measureText(parts[1]).width + 5 : 0;
      var x = bar.x + 6;
      ctx.fillStyle = SNS.white;                                   /* the white patch */
      ctx.fillRect(x - 3, bar.y - 10, boldWidth + lightWidth + 6, 20);
      ctx.font = bold;
      ctx.fillStyle = WCA.colors.ink;                              /* text wears text color, not the bar's color */
      ctx.fillText(parts[0], x, bar.y);
      if (parts[1]) {
        ctx.font = light;
        ctx.fillStyle = WCA.colors.fine;
        ctx.fillText(parts[1], x + boldWidth + 5, bar.y);
      }
    });
    ctx.restore();
  },
};

/* averageLine: a dashed line down the chart at one value, the value the bars are compared with.
   Turn on per chart with:   plugins: { averageLine: { value: 2.2 } } */
var averageLine = {
  id: "averageLine",
  afterDatasetsDraw: function (chart, args, options) {
    if (!options || options.value === null || options.value === undefined) return;
    var x = chart.scales.x.getPixelForValue(options.value);
    var area = chart.chartArea;
    var ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = SNS.average;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x, area.top);
    ctx.lineTo(x, area.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

/* shadeYears: a pale band behind some of the years on a line chart (the COVID years).
   Turn on per chart with:   plugins: { shadeYears: { from: 1, to: 2 } }
   from and to are positions along the bottom of the chart: 0 is the first year. */
var shadeYears = {
  id: "shadeYears",
  beforeDatasetsDraw: function (chart, args, options) {
    if (!options || options.from === undefined || options.from < 0) return;
    var x = chart.scales.x;
    var area = chart.chartArea;
    var half = (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2;
    var left = Math.max(area.left, x.getPixelForValue(options.from) - half);
    var right = Math.min(area.right, x.getPixelForValue(options.to) + half);
    var ctx = chart.ctx;
    ctx.save();
    ctx.fillStyle = SNS.white;
    ctx.fillRect(left, area.top, right - left, area.bottom - area.top);
    ctx.restore();
  },
};


/* --------------------------------------------------------------------------
   5. PART 1'S CHARTS  ·  students sent home out of every 100
   --------------------------------------------------------------------------
   Two bar charts on one scale: by race and ethnicity, and by student group.
   In each, the last bar (orange) is all Westchester students, and a dashed
   line runs up the chart from it. */

function drawWho(data) {
  var who = data.who;
  var everyone = who.race.concat(who.groups);
  var highest = Math.max.apply(null, everyone.map(function (e) { return e.per_100; }));
  var shared = {
    average: who.average,
    rows: Math.max(who.race.length, who.groups.length) + 1,      /* both charts get the taller one's height */
    max: Math.ceil(highest / 5) * 5,                             /* one scale for both: 19.6 -> 20 */
    value: function (e) { return e.per_100; },
    label: function (e) { return [one(e.per_100)]; },
    labelRoom: function () { return 40; },
    tip: function (e) {
      return [one(e.per_100) + " out of 100 students were sent home",
              "(" + WCA.fmt.count(e.sent_home) + " of " + WCA.fmt.count(e.enrolled) + " students)"];
    },
    axisTitle: function () { return "Students sent home, out of every 100"; },
    tableHeads: ["Group", "Sent home, out of 100", "Students sent home", "Students enrolled"],
    tableRow: function (e) { return [e.label, one(e.per_100), WCA.fmt.count(e.sent_home), WCA.fmt.count(e.enrolled)]; },
  };

  drawGroupBars(extend({ canvasId: "chart-race", entries: who.race, callout: "callout-race",
                         caption: "Students sent home out of every 100, by race and ethnicity, " + who.year }, shared));
  drawGroupBars(extend({ canvasId: "chart-groups", entries: who.groups, callout: "callout-groups",
                         caption: "Students sent home out of every 100, by student group, " + who.year }, shared));

  /* The notes in the source line, each marked on the title it belongs to: * then **.
     The race chart's note shows only when it leaves out small groups (the list is in data.json);
     then the student-group note takes the next mark. */
  var raceNote = who.race_not_shown.length > 0;
  var groupsMark = raceNote ? "**" : "*";
  document.getElementById("mark-race").textContent = raceNote ? "*" : "";
  document.getElementById("note-race").textContent = raceNote ? "* Small racial or ethnic groups are not shown." : "";
  document.getElementById("mark-groups").textContent = groupsMark;
  document.getElementById("note-groups").textContent = groupsMark + " A student can be in more than one group.";
  /* Previous version (a line under the race chart naming the groups), kept in case it comes back:
     note.textContent = who.race_not_shown.length
       ? "Not shown: " + listInWords(who.race_not_shown) + ", small groups in Westchester."
       : ""; */
}

/* One horizontal bar chart of student groups, with all students as the last bar. Used by parts 1 and 2.
     canvasId    the <canvas> to draw in
     entries     the groups, largest first, as they come from data.json
     average     the all-students entry: the last bar, in orange, with the dashed line at its value
     rows        how many rows of height to give the chart
     max         where the value axis ends
     value       function (entry) -> the number the bar shows
     label       function (entry, narrow) -> the words at the bar's end: [bold part, lighter part]
     labelRoom   function (narrow) -> pixels to keep free on the right for those words
     tip         function (entry) -> the lines in the hover box
     axisTitle   the words under the value axis
     caption, tableHeads, tableRow   the same numbers as a table for screen readers */
/* Places the words written on a chart (o.callout, the id of a <p class="callout"> in the chart's box) inside an
   orange circle, centered in the chart's empty space: below the first bar, to the right of where the other bars
   and their numbers end. The circle is as big as that space allows (up to MAX); the words shrink until they fit.
   When that space is too small for the words (a phone), the circle is hidden (Brandon, Nov 2026). The other way,
   kept for later: set CALLOUT_ON_PHONE to "below" and the circle sits centered just under the chart instead.
   It runs every time the chart draws, so the circle moves with the chart on a phone or when the window changes. */
var CALLOUT_MAX = 171;                                     /* the circle's largest size, in pixels */
var CALLOUT_SHARE = 0.9;                                   /* the circle fills 90% of the empty space it has */
var CALLOUT_FONT = 15.5;                                   /* the largest type in the circle, in pixels */
var CALLOUT_MIN = 135;                                     /* smaller than this, the space is too small for the words */
var CALLOUT_ON_PHONE = "hide";                             /* "hide", or "below" to show it under the chart */
var placeCallout = {
  id: "placeCallout",
  afterDraw: function (chart, args, options) {
    var el = options.id && document.getElementById(options.id);
    if (!el) return;
    var bars = chart.getDatasetMeta(0).data;
    var end = 0;
    for (var i = 1; i < bars.length; i++) end = Math.max(end, bars[i].x);
    /* the empty space */
    var left = end + 44, right = chart.chartArea.right;
    /* afterLabels (part 2, whose bar labels are long): the space starts after the other bars' words,
       and may use the room kept on the right for the first bar's words, since it sits below that bar */
    if (options.afterLabels) {
      end = 0;
      var text = options.labelText, narrow = chart.width < NARROW, ctx = chart.ctx;
      ctx.save();
      for (var j = 1; j < bars.length; j++) {
        var parts = text(j, narrow);
        ctx.font = "600 13px " + WCA.font;
        var w = ctx.measureText(parts[0]).width;
        ctx.font = "400 13px " + WCA.font;
        if (parts[1]) w += ctx.measureText(parts[1]).width + 5;
        end = Math.max(end, bars[j].x + 6 + w);
      }
      ctx.restore();
      left = end + 16;
      right = chart.width - 8;
    }
    var top = bars[0].y + bars[0].height / 2 + 4, bottom = chart.chartArea.bottom;
    var size = Math.min((right - left) * CALLOUT_SHARE, (bottom - top) * CALLOUT_SHARE, CALLOUT_MAX);
    var x, y, box = chart.canvas.parentNode;
    el.hidden = false;
    box.style.marginBottom = "";
    if (size >= CALLOUT_MIN) {
      x = left + (right - left - size) / 2;
      y = top + (bottom - top - size) / 2;
    } else if (CALLOUT_ON_PHONE !== "below") {
      el.hidden = true;
      return;
    } else {                                               /* under the chart, centered, with room made for it */
      size = 153;
      x = (chart.width - size) / 2;
      y = chart.height + 8;
      box.style.marginBottom = (size + 16) + "px";
    }
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = el.style.height = size + "px";
    el.style.padding = Math.round(size * 0.16) + "px";
    /* the largest type, from 17 px down, that keeps the words inside the circle */
    var font = CALLOUT_FONT;
    el.style.fontSize = font + "px";
    while (font > 10 && el.scrollHeight > el.clientHeight) { font -= 0.5; el.style.fontSize = font + "px"; }
  },
};

function drawGroupBars(o) {
  var canvas = document.getElementById(o.canvasId);
  var rows = o.entries.concat([o.average]);
  canvas.parentNode.style.height = (o.rows * (o.rowHeight || ROW_HEIGHT) + 58) + "px";

  var old = Chart.getChart(canvas);
  if (old) old.destroy();

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: rows.map(function (e) { return e.label; }),
      datasets: [{
        data: rows.map(o.value),
        backgroundColor: rows.map(function (e) { return e === o.average ? SNS.average : SNS.data; }),
        barThickness: BAR_THICKNESS,
      }],
    },
    options: {
      indexAxis: "y",
      layout: { padding: { right: function (context) { return o.labelRoom(context.chart.width < NARROW); } } },
      scales: {
        x: {
          min: 0, max: o.max,
          ticks: { maxTicksLimit: 6 },
          title: { display: true, color: WCA.colors.fine, font: { size: 12 },
                   text: function (context) { return o.axisTitle(context.chart.width < NARROW); } },
        },
        y: {
          grid: { display: false },
          afterFit: fixedNameRoom,                                 /* the same room for names in every chart, so the bars line up */
          ticks: {
            color: WCA.colors.body,
            autoSkip: false,                                       /* write every group's name */
            /* long names break into two or three lines; shorter lines on a phone */
            callback: function (value, index) { return wrap(rows[index].label, this.chart.width < NARROW ? 15 : 24); },
          },
        },
      },
      plugins: {
        averageLine: { value: o.value(o.average) },
        barLabels: { text: function (i, narrow) { return o.label(rows[i], narrow); } },
        placeCallout: { id: o.callout || null, afterLabels: !!o.calloutAfterLabels,
                        labelText: function (i, narrow) { return o.label(rows[i], narrow); } },
        tooltip: { callbacks: {
          title: function (items) { return rows[items[0].dataIndex].label; },
          label: function (item) { return o.tip(rows[item.dataIndex]); },
        } },
      },
    },
    plugins: [averageLine, barLabels, placeCallout],
  });

  writeTable(canvas, o.caption, o.tableHeads, rows.map(o.tableRow));
}


/* --------------------------------------------------------------------------
   6. PART 2'S CHART  ·  school days lost for every 100 students
   --------------------------------------------------------------------------
   The same kind of chart as part 1. Each bar's label gives the days and, in
   lighter type, that number as a share of one school year. */

function drawLost(data) {
  var lost = data.lost;
  var highest = Math.max.apply(null, lost.race.map(function (e) { return e.days_per_100; }));

  drawGroupBars({
    canvasId: "chart-days",
    callout: "callout-days",                                     /* the words on the chart, as in part 1 */
    calloutAfterLabels: true,                                    /* clear of the long bar labels */
    entries: lost.race,
    average: lost.total,
    rows: lost.race.length + 1,
    max: Math.ceil(highest / 10) * 10,                           /* 53 -> 60 */
    value: function (e) { return e.days_per_100; },
    /* the days on every bar; the share of a school year only on the first (largest) bar, the rest in the hover box */
    label: function (e, narrow) {
      return [WCA.fmt.count(Math.round(e.days_per_100)) + " days",
              e === lost.race[0] ? "= " + e.pct_of_year + "%" + (narrow ? "" : " of a school year") : ""];
    },
    labelRoom: function (narrow) { return narrow ? 96 : 196; },
    tip: function (e) {
      return [WCA.fmt.count(Math.round(e.days_per_100)) + " school days lost for every 100 students",
              "(" + WCA.fmt.count(e.days) + " days, " + WCA.fmt.count(e.enrolled) + " students)",
              "That is " + e.pct_of_year + "% of one " + lost.school_year_days + "-day school year"];
    },
    rowHeight: 55,                                               /* taller rows: the chart is about as tall as the three big numbers beside it (6 rows x 55 + 58 = 388 px) */
    axisTitle: function (narrow) {
      return narrow ? "Days lost, for every 100 students" : "School days lost to being sent home, for every 100 students";
    },
    caption: "School days lost to being sent home for every 100 students, by race and ethnicity, " + lost.year,
    tableHeads: ["Group", "Days for every 100 students", "Share of one school year", "Days lost", "Students enrolled"],
    tableRow: function (e) {
      return [e.label, WCA.fmt.count(Math.round(e.days_per_100)), e.pct_of_year + "%", WCA.fmt.count(e.days), WCA.fmt.count(e.enrolled)];
    },
  });
}


/* --------------------------------------------------------------------------
   7. PART 3'S CHARTS  ·  each racial group's share at each step
   --------------------------------------------------------------------------
   One small chart ("panel") for each group in data.json "path.races": three
   named groups and "All other students", all the same size and on the same scale
   (never two scales in one chart). Each bar is the group's share of everyone at
   that step. Two bars are orange, "Suspended" and "Felony arrests" (PATH_ORANGE
   below), so the eye can set a group's share of suspensions beside its share of
   arrests; the other bars are blue. The sentences in the shaded box beside the
   panels are in index.html and take their numbers from data.json like any other.

   styles.css (.panels) arranges the panels two to a row (a 2 x 2), one to a row
   on a phone, and sets each panel's height from the number of steps, which this
   code hands it as --rows. */

var PATH_NAME_ROOM = 146;      /* the width kept for the steps' names, each on one line, in pixels
                                  (the longest, "At-Home Suspensions", is 138 wide) */
var PATH_BAR_SHARE = 0.56;     /* how much of its row a bar fills: 22 pixels thick on a computer, 17 on a phone */
var PATH_SCALE_STEP = 20;      /* the scale ends at the next multiple of this above the longest bar: 52% -> 60% */
/* The steps whose bars are orange; every other bar is blue. The keys are ids in PATH_STEPS and
   PATH_ARREST_STEP (update_data_here/build_data.py). */
var PATH_ORANGE = { suspended: true, arrests: true };

/* The note marks after a step's name; each matches a note in part 3's source line in index.html.
   The keys are ids in PATH_STEPS (update_data_here/build_data.py). */
var PATH_MARKS = { suspended: "*" };

function drawPath(data) {
  var path = data.path;
  var box = document.getElementById("path-panels");

  /* one scale for every panel: it ends just past the longest bar of any group */
  var highest = 0, rows = 0;
  path.races.forEach(function (race) {
    rows = Math.max(rows, race.steps.length);
    race.steps.forEach(function (s) { highest = Math.max(highest, s.share); });
  });
  var max = Math.ceil(highest / PATH_SCALE_STEP) * PATH_SCALE_STEP;
  box.style.setProperty("--rows", rows);                   /* styles.css turns this into the panels' height */

  /* one panel per group: its name, the box its chart draws into, the chart */
  box.innerHTML = "";
  path.races.forEach(function (race) {
    var figure = document.createElement("figure");
    var caption = document.createElement("figcaption");
    caption.textContent = race.label;
    var chartBox = document.createElement("div");
    chartBox.className = "chart-box";
    var canvas = document.createElement("canvas");
    canvas.id = "chart-path-" + race.id;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Bar chart: " + race.label + "' share of all students and of those at each later step.");
    chartBox.appendChild(canvas);
    figure.appendChild(caption);
    figure.appendChild(chartBox);
    box.appendChild(figure);
    drawPathPanel(canvas, race, max);
  });
}

/* One panel: a group's share at each step.
     race    one entry of data.json "path.races": its label and its steps
     max     where the scale ends (the same for every panel) */
function drawPathPanel(canvas, race, max) {
  var steps = race.steps;

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: steps.map(function (s) { return s.label; }),
      datasets: [{
        data: steps.map(function (s) { return s.share; }),
        backgroundColor: steps.map(function (s) { return PATH_ORANGE[s.id] ? SNS.average : SNS.data; }),
        categoryPercentage: 1,                                       /* a bar's thickness follows its row's height... */
        barPercentage: PATH_BAR_SHARE,                               /* ...so it is thinner in a phone's shorter rows */
      }],
    },
    options: {
      indexAxis: "y",
      layout: { padding: { right: 42 } },                           /* room for the number past the longest bar */
      scales: {
        x: { min: 0, max: max, ticks: { stepSize: max / 2, callback: function (v) { return v + "%"; } } },
        y: {
          grid: { display: false },
          afterFit: function (axis) {
            axis.width = PATH_NAME_ROOM;                             /* the same in every panel, so the bars line up */
            axis.paddingTop = 2;                                     /* no empty band between the panel's title and its first bar */
          },
          ticks: {
            color: WCA.colors.body,
            autoSkip: false,                                       /* write every step's name */
            callback: function (value, index) { return steps[index].label + (PATH_MARKS[steps[index].id] || ""); },
          },
        },
      },
      plugins: {
        barLabels: { text: function (i) { return [steps[i].share_whole + "%"]; } },
        tooltip: { callbacks: {
          title: function (items) { return steps[items[0].dataIndex].label; },
          label: function (item) {
            var s = steps[item.dataIndex];
            return [race.label + ": " + WCA.fmt.pct(s.share),
                    "(" + WCA.fmt.count(s.count) + " of " + WCA.fmt.count(s.total) + ")"];
          },
        } },
      },
    },
    plugins: [barLabels],
  });

  writeTable(canvas, race.label + ": share at each step", ["Step", "Share", "Count", "Out of"],
    steps.map(function (s) { return [s.label, WCA.fmt.pct(s.share), WCA.fmt.count(s.count), WCA.fmt.count(s.total)]; }));
}


/* --------------------------------------------------------------------------
   8. FIND YOUR DISTRICT  ·  the map, the list, the town search, the district card
   --------------------------------------------------------------------------
   How it works:
     a. Each district's outline comes as longitude/latitude points. makeProjection()
        turns them into x/y on the drawing, scaled to fit the SVG box.
     b. One SVG <path> is drawn per district, once, in the blue step build_data.py
        gave it (data.json "step": 0 = lightest). An outline that isn't a Westchester
        district is gray.
     c. Tapping a district, picking it from the list or choosing a search result all
        call selectDistrict(), which outlines it and fills the card beside the map.
     d. The card starts on all of Westchester. For a district it shows the district
        beside Westchester and New York State, its student groups, two facts and a
        small chart of the last school years.
   -------------------------------------------------------------------------- */

var map = {
  data: null,             /* data.json "map" */
  group: null,            /* the <g> that holds the district outlines */
  paths: {},              /* district code -> its <path> */
  codes: [],              /* district codes, in name order */
  selected: "",           /* the district code shown in the card ("" = all of Westchester) */
  trend: null,            /* the small line chart in the card */
};

/* Load the outlines (only now: the other parts don't need them), then draw */
function loadMap(data) {
  map.data = data.map;
  fillCard("");
  fetch(GEOGRAPHY_FILE)
    .then(function (r) { if (!r.ok) throw new Error(GEOGRAPHY_FILE + " not found"); return r.json(); })
    .then(function (geography) { drawMap(geography); })
    .catch(function (error) {
      document.getElementById("map-legend").innerHTML =
        '<span class="fine">Couldn\'t load the map (' + error.message + '). The list and the town search still work.</span>';
      console.error(error);
    });
  setUpList();
  setUpSearch();
}

function drawMap(geography) {
  map.group = document.getElementById("map-districts");

  /* a. Fit the outlines into the SVG box with a little margin */
  var project = makeProjection(geography.features, MAP_WIDTH, MAP_HEIGHT, 8);

  /* b. One path per outline */
  geography.features.forEach(function (feature) {
    var code = feature.properties.district_code;
    var district = map.data.districts[code];
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathFor(feature.geometry, project));

    if (district) {
      path.setAttribute("class", "district");
      path.setAttribute("fill", WCA.blueRamp[district.step]);
      /* a keyboard or screen-reader user can reach each district and choose it with Enter */
      path.setAttribute("tabindex", "0");
      path.setAttribute("role", "button");
      path.setAttribute("aria-label", district.name + ": " + one(district.per_100) + " out of 100 students sent home");
      path.addEventListener("click", function () { selectDistrict(code, true); });
      path.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectDistrict(code, true); }
      });
    } else {
      path.setAttribute("class", "district other");
    }

    /* the hover box is for a mouse only: on a phone a tap chooses the district instead */
    path.addEventListener("pointermove", function (e) {
      if (e.pointerType === "mouse") showDistrictTooltip(code, e.clientX, e.clientY);
    });
    path.addEventListener("pointerleave", WCA.tooltip.hide);

    map.group.appendChild(path);
    map.paths[code] = path;
  });

  /* The legend: the five blue steps with the labels from data.json, and gray */
  var legend = '<span class="title">Students sent home, out of every 100, ' + map.data.year + "</span>";
  map.data.legend.forEach(function (label, i) {
    legend += '<span class="legend-item"><span class="swatch" style="background:' + WCA.blueRamp[i] + '"></span>' + label + "</span>";
  });
  if (Object.keys(map.data.other_outlines).length) {
    legend += '<span class="legend-item"><span class="swatch" style="background:' + WCA.colors.noData + '"></span>Not a Westchester district</span>';
  }
  document.getElementById("map-legend").innerHTML = legend;

  if (map.selected) markSelected(map.selected);    /* a district picked from the list before the map arrived */
}

/* The hover box for one outline */
function showDistrictTooltip(code, x, y) {
  var d = map.data.districts[code];
  var html;
  if (d) {
    html = "<strong>" + d.name + "</strong><br>" + one(d.per_100) + " out of 100 students sent home<br>" +
           WCA.fmt.count(d.sent_home) + " of " + WCA.fmt.count(d.enrolled) + " students";
  } else {
    html = "<strong>" + map.data.other_outlines[code] + "</strong><br>A district in another county. " +
           "This small piece lies in Westchester and isn't counted here.";
  }
  WCA.tooltip.show(html, x, y);
}

/* The list of districts, in name order, under "All of Westchester" */
function setUpList() {
  var districts = map.data.districts;
  map.codes = Object.keys(districts).sort(function (a, b) { return districts[a].name.localeCompare(districts[b].name); });
  var select = document.getElementById("district-select");
  map.codes.forEach(function (code) {
    var option = document.createElement("option");
    option.value = code;
    option.textContent = districts[code].name;
    select.appendChild(option);
  });
  select.addEventListener("change", function () { selectDistrict(select.value, true); });
}

/* Choose a district (or "" for all of Westchester): outline it, set the list, fill the card.
   bringCard = true moves the screen to the card when it is out of sight (on a phone it sits under the map). */
function selectDistrict(code, bringCard) {
  map.selected = code;
  markSelected(code);
  document.getElementById("district-select").value = code;
  fillCard(code);
  WCA.tooltip.hide();
  if (bringCard) {
    var card = document.getElementById("district-card");
    var top = card.getBoundingClientRect().top;
    var menuHeight = document.querySelector(".tabbar").offsetHeight;
    if (top > window.innerHeight - 160 || top < menuHeight) {
      window.scrollTo(0, top + window.pageYOffset - menuHeight - 12);
    }
  }
}

/* Outline the chosen district on the map, and no other */
function markSelected(code) {
  Object.keys(map.paths).forEach(function (other) { map.paths[other].classList.remove("selected"); });
  var path = map.paths[code];
  if (!path) return;
  path.classList.add("selected");
  map.group.appendChild(path);           /* on top, so the outline isn't hidden by neighbours */
}

/* --- The town search --------------------------------------------------------
   Typing two letters or more lists the districts whose name, or one of the towns
   and villages they serve, contains what was typed ("port ch" finds Port
   Chester-Rye UFSD). Choosing one works like tapping it on the map. */

function setUpSearch() {
  var input = document.getElementById("town-search");
  var list = document.getElementById("town-results");

  input.addEventListener("input", function () { showMatches(input.value); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") list.hidden = true;
    if (e.key === "Enter") {                       /* Enter takes the first district in the list */
      var first = list.querySelector("button");
      if (first) first.click();
    }
  });
  /* a click anywhere else closes the list */
  document.addEventListener("click", function (e) {
    if (e.target !== input && !list.contains(e.target)) list.hidden = true;
  });
}

function showMatches(typed) {
  var list = document.getElementById("town-results");
  var text = typed.trim().toLowerCase();
  list.innerHTML = "";
  if (text.length < 2) { list.hidden = true; return; }

  var found = 0;
  map.codes.forEach(function (code) {
    if (found >= SEARCH_RESULTS) return;
    var d = map.data.districts[code];
    var places = d.serves.filter(function (place, i) { return d.search[i].indexOf(text) >= 0; });
    if (d.name.toLowerCase().indexOf(text) < 0 && !places.length) return;
    found++;

    var item = document.createElement("li");
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = d.name;
    if (places.length) {
      var serves = document.createElement("small");
      serves.textContent = "Serves " + listInWords(places);
      button.appendChild(serves);
    }
    button.addEventListener("click", function () {
      list.hidden = true;
      selectDistrict(code, true);
    });
    item.appendChild(button);
    list.appendChild(item);
  });

  if (!found) {
    var none = document.createElement("li");
    none.className = "empty";
    none.textContent = "No district, town or village matches. Try the list of districts.";
    list.appendChild(none);
  }
  list.hidden = false;
}

/* --- The district card ----------------------------------------------------- */

function fillCard(code) {
  var m = map.data;
  var card = document.getElementById("district-card");
  if (map.trend) { map.trend.destroy(); map.trend = null; }

  var westchester = { label: "Westchester", status: "ok", per_100: m.county.per_100, kind: "average",
                      sent_home: m.county.sent_home, enrolled: m.county.enrolled };
  var state = { label: "New York State", status: "ok", per_100: m.state.per_100, kind: "other",
                sent_home: m.state.sent_home, enrolled: m.state.enrolled };

  /* All of Westchester: the card the page starts with */
  if (!code) {
    card.innerHTML =
      "<h3>All of Westchester</h3>" +
      '<p class="serves">Every public school in the county, special act districts and charter schools included</p>' +
      rateLine(m.county, m.year) +
      barRows([westchester, state], Math.max(westchester.per_100, state.per_100)) +
      '<p class="hint">Tap a district on the map, pick it from the list, or type your town to see how it compares.</p>';
    return;
  }

  var d = m.districts[code];
  var district = { label: "This district", status: "ok", per_100: d.per_100, sent_home: d.sent_home, enrolled: d.enrolled };
  var everyRow = [district, westchester, state].concat(d.race, d.groups);
  var longest = Math.max.apply(null, everyRow.map(function (r) { return r.per_100 || 0; }));   /* one scale for every bar in the card */

  var twenty = d.twenty_plus === null
    ? "<div><b>n/a</b>students suspended 20 days or more: not reported</div>"
    : "<div><b>" + WCA.fmt.count(d.twenty_plus) + "</b>" + (d.twenty_plus === 1 ? "student" : "students") + " suspended 20 days or more</div>";
  var days = d.days_per_100 === null
    ? "<div><b>n/a</b>school days lost: not reported</div>"
    : "<div><b>" + WCA.fmt.count(Math.round(d.days_per_100)) + "</b>school days lost to being sent home, for every 100 students</div>";

  card.innerHTML =
    "<h3>" + d.name + "</h3>" +
    '<p class="serves">Serves ' + listInWords(d.serves) + "</p>" +
    rateLine(d, m.year) +
    barRows([district, westchester, state], longest) +
    "<h4>By race and ethnicity</h4>" +
    barRows(d.race, longest) +
    "<h4>Other student groups</h4>" +
    barRows(d.groups, longest) +
    '<div class="facts">' + twenty + days + "</div>" +
    "<h4>Students sent home, out of every 100, by school year</h4>" +
    '<div class="chart-box mini"><canvas id="chart-trend" role="img" aria-label="Line chart: students sent home out of every 100 in ' + d.name + ", " + m.years[0] + " to " + m.years[m.years.length - 1] + '"></canvas></div>' +
    (m.covid_years.length ? '<p class="note">Shaded: ' + listInWords(m.covid_years) + ", when schools closed and then taught mostly remotely.</p>" : "") +
    (d.note ? '<p class="note">About its boundaries: ' + d.note + ".</p>" : "");

  drawTrend(d);
}

/* "6.4 out of 100 students were sent home in 2024-25 (428 of 6,714 students)" */
function rateLine(entry, year) {
  return '<p class="rate"><span class="big">' + one(entry.per_100) + "</span> out of 100 students were sent home in " + year +
         ' <span class="muted">(' + WCA.fmt.count(entry.sent_home) + " of " + WCA.fmt.count(entry.enrolled) + " students)</span></p>";
}

/* Rows of bars for the card: a name, a bar, the number. A group whose number can't be shown
   (data.json "status") gets the reason in words instead. longest = the value a full-width bar stands for. */
function barRows(rows, longest) {
  var html = '<div class="bars">';
  rows.forEach(function (r) {
    if (r.status === "ok") {
      var width = Math.max(1, r.per_100 / longest * 100);
      var counts = WCA.fmt.count(r.sent_home) + " of " + WCA.fmt.count(r.enrolled) + " students";
      html += '<div class="row" title="' + counts + '"><span class="who">' + r.label + "</span>" +
              '<span class="track"><span class="fill ' + (r.kind || "") + '" style="width:' + width.toFixed(1) + '%"></span></span>' +
              '<span class="val">' + one(r.per_100) + "</span></div>";
    } else {
      var why = r.status === "too_few" ? "Too few students to show" : "Not reported by NYSED";
      html += '<div class="row none"><span class="who">' + r.label + '</span><span class="why">' + why + "</span></div>";
    }
  });
  return html + "</div>";
}

/* The small line chart in the card: the district's students sent home out of 100, one point per school year */
function drawTrend(d) {
  var m = map.data;
  var first = m.years.indexOf(m.covid_years[0]);
  var last = m.years.indexOf(m.covid_years[m.covid_years.length - 1]);

  map.trend = new Chart(document.getElementById("chart-trend"), {
    type: "line",
    data: {
      labels: m.years,
      datasets: [{ data: d.trend, borderColor: SNS.data, backgroundColor: SNS.data, pointBackgroundColor: SNS.data, pointRadius: 3 }],
    },
    options: {
      layout: { padding: { top: 6, right: 8 } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, font: { size: 11 },
               callback: function (value, index) { return m.years[index].slice(2); } } },      /* "2024-25" -> "24-25" */
        y: { beginAtZero: true, grace: "15%", ticks: { maxTicksLimit: 4, font: { size: 11 } } },
      },
      plugins: {
        shadeYears: { from: first, to: last },
        tooltip: { callbacks: {
          title: function (items) { return m.years[items[0].dataIndex]; },
          label: function (item) { return one(item.parsed.y) + " out of 100 students sent home"; },
        } },
      },
    },
    plugins: [shadeYears],
  });
}

/* --- Map geometry ---------------------------------------------------------- */

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


/* --------------------------------------------------------------------------
   9. SMALL HELPERS
   -------------------------------------------------------------------------- */

/* Give the names beside the bars the same room in every chart (less on a phone), so that
   charts on one scale have bars that start and end at the same places. Chart.js calls this
   for the axis that holds the names. */
function fixedNameRoom(axis) {
  axis.width = axis.chart.width < NARROW ? 112 : 164;
}

/* 6.6 -> "6.6", 1 -> "1.0": one decimal, always */
function one(n) {
  if (n === null || n === undefined) return "n/a";
  return Number(n).toFixed(1);
}

/* 3 -> "3", 3.6 -> "3.6": for "3 times the rate" (never "3.0 times") */
/* 8.9 -> "almost 9"; 3.0 -> "3"; 4.2 -> "more than 4" (the number rounded, with a word saying which way) */
function roughlyText(n) {
  var whole = Math.round(n * 10) / 10;                     /* 8.94 is 8.9, as on the page */
  var near = Math.round(whole);
  if (whole === near) return String(near);
  return whole < near ? "almost " + near : "more than " + near;
}

function timesText(n) {
  var text = Number(n).toFixed(1);
  return text.slice(-2) === ".0" ? text.slice(0, -2) : text;
}

/* ["a", "b", "c"] -> "a, b and c" */
function listInWords(items) {
  if (items.length < 2) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

/* Copy b's settings onto a and return a */
function extend(a, b) {
  Object.keys(b).forEach(function (key) { a[key] = b[key]; });
  return a;
}

/* Break text into lines of about `width` characters, at spaces */
function wrap(text, width) {
  var words = text.split(" "), lines = [], line = "";
  words.forEach(function (word) {
    if ((line + " " + word).trim().length > width && line) { lines.push(line); line = word; }
    else line = (line + " " + word).trim();
  });
  if (line) lines.push(line);
  return lines;
}

/* A chart's numbers as a table for screen readers, written right after the chart.
   It sits in a box that takes no room on screen (a table on its own would widen the page). */
function writeTable(canvas, caption, heads, rows) {
  var box = canvas.parentNode;
  var old = box.nextElementSibling;
  if (old && old.classList.contains("visually-hidden")) old.parentNode.removeChild(old);
  var html = '<div class="visually-hidden"><table><caption>' + caption + "</caption><tr>";
  heads.forEach(function (h) { html += '<th scope="col">' + h + "</th>"; });
  html += "</tr>";
  rows.forEach(function (r) {
    html += "<tr>";
    r.forEach(function (cell, i) { html += (i === 0 ? '<th scope="row">' + cell + "</th>" : "<td>" + cell + "</td>"); });
    html += "</tr>";
  });
  box.insertAdjacentHTML("afterend", html + "</table></div>");
}
