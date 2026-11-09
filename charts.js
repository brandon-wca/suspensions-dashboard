/* ==========================================================================
   suspensions/charts.js
   ==========================================================================
   Draws everything on the Suspensions Dashboard page. Read top to bottom.

   WHAT HAPPENS WHEN THE PAGE LOADS
     1. Load the two data files: data/data.json (the numbers, built by
        update_data_here/build_data.py) and data/Geography.json (the school
        district outlines).
     2. Fill in the numbers written inside sentences (the <span data-fill> tags
        in index.html).
     3. Draw the four headline tiles.
     4. Part 1: the race chart, the other-groups chart, the district map (its
        switch, district list, legend, hover box and side panel), the ranked
        district chart and the table of every district.
     5. Part 2: the school-days chart. Part 3: the steps chart.
        Part 4: the $50 million bar.
     Charts are drawn with Chart.js (resources/vendor/chart.umd.js); the map is
     plain SVG drawn here.

   Nothing here defines a color; every color is read from styles.css
   (WCA.colors for the brand, SNS for this dashboard's own colors).

   PART ONE  ·  helpers, all on one object called WCA. Copied unchanged from
   the Youth Justice Dashboard; change it there and here together.
     WCA.colors        the brand colors, read from styles.css
     WCA.fmt           number formatting: 6395 -> "6,395", 13.9 -> "13.9%"
     WCA.get           read a value out of data.json by a dotted path
     WCA.fillNumbers   fill the <span data-fill> tags in the page text
     WCA.tooltip       the hover box: show(html, x, y) and hide()
     WCA.legend        write an HTML legend for a chart
     WCA.applyChartDefaults   the look every Chart.js chart shares
     WCA.plugins       two small Chart.js add-ons: value labels at bar ends,
                       and short notes beside chosen points on a line

   PART TWO  ·  this page
     0. Settings
     1. Start-up
     2. Headline tiles
     3. Part 1 charts: race against the state, other groups
     4. The district map
     5. The ranked district chart and the table of every district
     6. Part 2 chart: school days lost
     7. Part 3 chart: the share at each step
     8. Part 4: the $50 million bar
     9. Small helpers (formats, the reference-line add-on, map geometry)
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

/* This dashboard's own colors, read from part A2 of styles.css */
var SNS = {
  ink:        WCA.cssVar("--sns-ink"),
  steel:      WCA.cssVar("--sns-steel"),
  steelLight: WCA.cssVar("--sns-steel-light"),
  state:      WCA.cssVar("--sns-state"),
  accent:     WCA.cssVar("--wca-accent"),
  rateRamp:   [1, 2, 3, 4, 5].map(function (i) { return WCA.cssVar("--sns-rate-" + i); }),
  gapRamp:    [1, 2, 3, 4].map(function (i) { return WCA.cssVar("--sns-gap-" + i); }),
};

/* The map's drawing box (also in index.html's <svg viewBox>): Westchester is taller than wide */
var MAP_WIDTH = 520, MAP_HEIGHT = 700;

/* On a phone, bar labels wrap sooner so they fit beside the bars */
var NARROW = window.matchMedia("(max-width: 600px)").matches;
var LABEL_WIDTH = NARROW ? 15 : 24;          /* characters per line in a bar's label */


/* --------------------------------------------------------------------------
   1. START-UP  ·  load both files, then draw everything
   -------------------------------------------------------------------------- */

Promise.all([
  fetch(DATA_FILE).then(function (r) { if (!r.ok) throw new Error(DATA_FILE + " not found"); return r.json(); }),
  fetch(GEOGRAPHY_FILE).then(function (r) { if (!r.ok) throw new Error(GEOGRAPHY_FILE + " not found"); return r.json(); }),
]).then(function (files) {
  var data = files[0];
  var geography = files[1];

  WCA.applyChartDefaults();
  WCA.fillNumbers(data);

  drawHeadlines(data);

  drawRaceVsState(data);
  drawOtherGroups(data);
  drawMap(data, geography);
  drawDistrictGaps(data);
  drawDistrictTable(data);

  drawDaysByRace(data);
  drawPathSteps(data);
  drawMoneyBar();
}).catch(function (error) {
  /* Most likely cause: the page was opened straight from a folder (file://), which
     blocks loading data files. It needs a web server; see the README. */
  document.getElementById("tiles").innerHTML =
    '<p class="fine">Couldn\'t load the data (' + error.message + '). ' +
    'This page has to be opened through a web server, not straight from a folder. See the README.</p>';
  console.error(error);
});


/* --------------------------------------------------------------------------
   2. HEADLINE TILES  ·  one tile per entry in data.json "headlines"
   -------------------------------------------------------------------------- */

function drawHeadlines(data) {
  var html = "";
  data.headlines.forEach(function (h) {
    html += '<div class="tile">';
    html += '  <div class="value">' + byUnit(h.value, h.unit) + "</div>";
    html += '  <div class="label">' + capitalize(h.label) + "</div>";
    if (h.compare) {
      html += '  <div class="compare">' + capitalize(h.compare.label) + ": " + byUnit(h.compare.value, h.compare.unit) + "</div>";
    }
    html += "</div>";
  });
  document.getElementById("tiles").innerHTML = html;
}


/* --------------------------------------------------------------------------
   3. PART 1 CHARTS
   -------------------------------------------------------------------------- */

/* Share of students sent home, by race: Westchester (green, as everywhere) next to the state (gray).
   Groups with too few students to compare are left out and named in a note under the chart. */
function drawRaceVsState(data) {
  var who = data.who;
  var rows = who.race.filter(function (r) { return !r.westchester.too_few_to_compare && !r.state.too_few_to_compare; });
  sizeBox("chart-race", rows.length, 54);

  WCA.legend("#legend-race", [
    { label: "Westchester", color: WCA.colors.green },
    { label: "New York State", color: SNS.state },
  ]);

  new Chart(document.getElementById("chart-race"), {
    type: "bar",
    data: {
      labels: rows.map(function (r) { return r.label; }),
      datasets: [
        { label: "Westchester",    data: rows.map(function (r) { return r.westchester.rate; }), backgroundColor: WCA.colors.green },
        { label: "New York State", data: rows.map(function (r) { return r.state.rate; }),       backgroundColor: SNS.state },
      ],
    },
    options: horizontalBarOptions({
      valueLabels: { datasets: [0, 1], format: WCA.fmt.pct },
      tooltip: { callbacks: {
        title: function (items) { return rows[items[0].dataIndex].label + " students, " + who.year; },
        label: function (item) {
          var place = item.datasetIndex === 0 ? rows[item.dataIndex].westchester : rows[item.dataIndex].state;
          return item.dataset.label + ": " + WCA.fmt.pct(place.rate) + " sent home (" +
                 WCA.fmt.count(place.sent_home) + " of " + WCA.fmt.count(place.enrolled) + ")";
        },
      } },
    }),
    plugins: [WCA.plugins.valueLabels],
  });

  var left = who.too_few_note_groups;
  document.getElementById("note-race").textContent = left.length
    ? "Not shown, too few students to compare: " + listWords(left) + " students."
    : "";
}

/* Other groups: the share of each group sent home, with a dashed line at all students. */
function drawOtherGroups(data) {
  var who = data.who;
  var rows = who.other_groups.filter(function (r) { return !r.too_few_to_compare; });
  sizeBox("chart-groups", rows.length, NARROW ? 50 : 44, 40);

  new Chart(document.getElementById("chart-groups"), {
    type: "bar",
    data: {
      labels: rows.map(function (r) { return wrap(r.label, LABEL_WIDTH); }),
      datasets: [{ data: rows.map(function (r) { return r.rate; }), backgroundColor: SNS.steel }],
    },
    options: horizontalBarOptions({
      valueLabels: { datasets: [0], format: WCA.fmt.pct },
      refLine: { value: who.all_students.rate, label: "All students " + WCA.fmt.pct(who.all_students.rate), color: SNS.ink },
      tooltip: { callbacks: {
        title: function (items) { return rows[items[0].dataIndex].label + ", " + who.year; },
        label: function (item) {
          var r = rows[item.dataIndex];
          return [
            WCA.fmt.pct(r.rate) + " sent home: 1 in " + r.one_in + " (" + WCA.fmt.count(r.sent_home) + " of " + WCA.fmt.count(r.enrolled) + ")",
            fmtTimes(r.times_everyone_else) + " the rate of all other students (" + WCA.fmt.pct(r.everyone_else_rate) + ")",
          ];
        },
      } },
    }, { top: 22 }),
    plugins: [WCA.plugins.valueLabels, refLine],
  });
}


/* --------------------------------------------------------------------------
   4. THE DISTRICT MAP  ·  Westchester's public school districts
   --------------------------------------------------------------------------
   How it works:
     a. Each district's outline comes as longitude/latitude points. makeProjection()
        turns them into x/y on the drawing, scaled to fit the SVG box.
     b. One SVG <path> is drawn per district (once). The switch above the map only
        changes each path's fill color.
     c. Two measures, each with its own fixed color steps from data.json:
          rate  the share of students sent home (5 steel-blue steps)
          gap   how many times as often Black students are sent home as White
                students (4 orange steps); districts with too few students to
                compare are hatched
        A district with no data (the sliver of Putnam Valley) is plain gray.
     d. Hovering shows a small box; tapping or clicking a district, or picking it
        from the list, fills the side panel. The panel starts on Westchester as a whole.
   -------------------------------------------------------------------------- */

var map = {
  data: null,             /* data.json "districts" */
  group: null,            /* the <g> that holds the district paths */
  paths: {},              /* district code -> its <path> */
  measureKey: null,       /* which measure is showing: "rate" or "gap" */
  selected: null,         /* district code shown in the side panel (null = Westchester as a whole) */
};

function drawMap(data, geography) {
  map.data = data.districts;
  map.group = document.getElementById("map-districts");

  /* a. Fit the outlines into the SVG box with a little margin */
  var project = makeProjection(geography.features, MAP_WIDTH, MAP_HEIGHT, 8);

  /* b. One path per district */
  geography.features.forEach(function (feature) {
    var code = feature.properties.district_code;
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathFor(feature.geometry, project));
    path.setAttribute("class", "district");
    path.addEventListener("mousemove", function (e) { showDistrictTooltip(code, e.clientX, e.clientY); });
    path.addEventListener("mouseleave", WCA.tooltip.hide);
    path.addEventListener("click", function () { selectDistrict(code); });
    map.group.appendChild(path);
    map.paths[code] = path;
  });

  /* The two-button switch */
  var buttons = document.querySelectorAll(".switch button[data-measure]");
  Array.prototype.forEach.call(buttons, function (button) {
    button.addEventListener("click", function () { showMeasure(button.getAttribute("data-measure")); });
  });

  /* The "Find your district" list: Westchester as a whole first, then every district A to Z */
  var select = document.getElementById("district-select");
  var first = document.createElement("option");
  first.value = "";
  first.textContent = "All of Westchester";
  select.appendChild(first);
  Object.keys(map.data.places)
    .sort(function (a, b) { return map.data.places[a].label.localeCompare(map.data.places[b].label); })
    .forEach(function (code) {
      var option = document.createElement("option");
      option.value = code;
      option.textContent = map.data.places[code].label;
      select.appendChild(option);
    });
  select.addEventListener("change", function () { selectDistrict(select.value || null); });

  showMeasure(map.data.default_measure);
  selectDistrict(null);
}

/* Color every district for one measure, and rewrite the legend and the note under the map */
function showMeasure(key) {
  map.measureKey = key;
  var measure = map.data.measures[key];
  var ramp = key === "gap" ? SNS.gapRamp : SNS.rateRamp;

  Object.keys(map.paths).forEach(function (code) {
    map.paths[code].setAttribute("fill", fillFor(code));
  });

  Array.prototype.forEach.call(document.querySelectorAll(".switch button[data-measure]"), function (button) {
    button.setAttribute("aria-pressed", button.getAttribute("data-measure") === key ? "true" : "false");
  });

  var legend = stepLabels(measure.steps, measure.unit).map(function (label, i) { return { label: label, color: ramp[i] }; });
  if (key === "gap") legend.push({ label: "Too few students to compare", pattern: "repeating-linear-gradient(45deg, #B5B5B5 0 1px, #F4F4F4 1px 5px)" });
  legend.push({ label: "No data", color: WCA.colors.noData });
  WCA.legend("#map-legend", legend);
  document.getElementById("map-measure-note").textContent = measure.label + ". " + measure.description;

  WCA.tooltip.hide();
  fillSidePanel(map.selected);
}

/* The fill color for one district under the current measure */
function fillFor(code) {
  var place = map.data.places[code];
  if (!place) return WCA.colors.noData;                       /* an outline with no Westchester data */
  var measure = map.data.measures[map.measureKey];
  if (map.measureKey === "gap") {
    if (place.gap.too_few) return "url(#hatch)";
    return stepColor(place.gap.value, measure.steps, SNS.gapRamp);
  }
  if (place.too_few || place.rate === null) return "url(#hatch)";
  return stepColor(place.rate, measure.steps, SNS.rateRamp);
}

/* The hover box for a district */
function showDistrictTooltip(code, x, y) {
  var place = map.data.places[code];
  var html;
  if (!place) {
    html = map.data.no_data[code] || "No data";
  } else if (map.measureKey === "gap") {
    html = "<strong>" + place.label + "</strong><br>" + (place.gap.too_few
      ? "Too few students to compare"
      : "Black students sent home " + fmtTimes(place.gap.value) + " as often as White students, " + map.data.pooled_label);
  } else {
    html = "<strong>" + place.label + "</strong><br>" + WCA.fmt.pct(place.rate) + " of students sent home, " + map.data.year;
  }
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

/* The side panel: the chosen district (or Westchester as a whole), with the county beside it */
function fillSidePanel(code) {
  var county = map.data.county;
  var panel = document.getElementById("side-panel");
  var gapName = "Black–White gap, " + map.data.pooled_label;

  if (!code) {
    panel.innerHTML =
      "<h3>All of Westchester</h3>" +
      '<div class="towns">Every school in the county, including special act districts and charter schools</div>' +
      '<div class="big">' + WCA.fmt.pct(county.rate) + "</div>" +
      '<div class="big-label">of students were sent home at least once in ' + map.data.year + " (" +
        WCA.fmt.count(county.sent_home) + " of " + WCA.fmt.count(county.enrolled) + ")</div>" +
      "<dl><dt>" + gapName + "</dt><dd>" + fmtTimes(county.gap_pooled) + "</dd></dl>" +
      '<div class="hint">Tap a district on the map, or pick one from the list, to see its numbers.</div>';
    return;
  }

  var p = map.data.places[code];
  var a = p.groups.Black, b = p.groups.White;
  var rows = [
    ["Suspended in school", p.in_school_none_reported ? "none reported" : WCA.fmt.count(p.in_school) + " students"],
    ["School days sent home", WCA.fmt.count(p.days_sent_home) + " (" + WCA.fmt.count(p.days_per_100) + " per 100 students)"],
    ["Black students sent home", a.too_few ? "too few to show" : WCA.fmt.pct(a.rate)],
    ["White students sent home", b.too_few ? "too few to show" : WCA.fmt.pct(b.rate)],
    [gapName, p.gap.too_few ? "too few students to compare" : fmtTimes(p.gap.value) + " (Westchester: " + fmtTimes(county.gap_pooled) + ")"],
  ];
  panel.innerHTML =
    "<h3>" + p.label + "</h3>" +
    '<div class="towns">Serves ' + servesText(p.municipalities) + "</div>" +
    '<div class="big">' + (p.too_few ? "Too few" : WCA.fmt.pct(p.rate)) + "</div>" +
    '<div class="big-label">of students were sent home at least once in ' + map.data.year + " (" +
      WCA.fmt.count(p.sent_home) + " of " + WCA.fmt.count(p.enrolled) + "). Westchester: " + WCA.fmt.pct(county.rate) + ".</div>" +
    "<dl>" + rows.map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>"; }).join("") + "</dl>" +
    '<div class="hint">Tap another district, or pick one from the list.</div>';
}

/* "Village of Ardsley (45%); Town of Greenburgh (outside villages) (39%)" -> "Village of Ardsley, Town of Greenburgh (outside villages)" */
function servesText(municipalities) {
  if (!municipalities) return "";
  return municipalities.replace(/\s\(<?\d+%\)/g, "").split("; ").join(", ");
}


/* --------------------------------------------------------------------------
   5. THE RANKED DISTRICT CHART AND THE TABLE OF EVERY DISTRICT
   -------------------------------------------------------------------------- */

/* The gap in each district with enough students to compare, highest first,
   with a dashed line at Westchester's gap over the same years. Orange = the gap, as on the map. */
function drawDistrictGaps(data) {
  var d = data.districts;
  var codes = d.ranked_by_gap;
  var places = codes.map(function (c) { return d.places[c]; });

  sizeBox("chart-districts", codes.length, 34, 40);

  new Chart(document.getElementById("chart-districts"), {
    type: "bar",
    data: {
      labels: places.map(function (p) { return p.label; }),
      datasets: [{ data: places.map(function (p) { return p.gap.value; }), backgroundColor: SNS.gapRamp[2] }],
    },
    options: horizontalBarOptions({
      insideLabels: { format: fmtTimes },             /* values inside the bars, clear of the dashed line */
      refLine: { value: d.county.gap_pooled, label: "Westchester " + fmtTimes(d.county.gap_pooled), color: SNS.ink },
      tooltip: { callbacks: {
        title: function (items) { return places[items[0].dataIndex].label + ", " + d.pooled_label; },
        label: function (item) {
          var c = places[item.dataIndex].gap.counts;
          return [
            "Black students sent home: " + WCA.fmt.count(c.Black.sent_home) + " of " + WCA.fmt.count(c.Black.enrolled),
            "White students sent home: " + WCA.fmt.count(c.White.sent_home) + " of " + WCA.fmt.count(c.White.enrolled),
          ];
        },
      } },
    }, { top: 22, right: 12 }, function (v) { return v + "×"; }),
    plugins: [insideLabels, refLine],
  });
}

/* Every district's numbers, A to Z, in a table folded away under the chart */
function drawDistrictTable(data) {
  var d = data.districts;
  var codes = Object.keys(d.places).sort(function (a, b) { return d.places[a].label.localeCompare(d.places[b].label); });
  function rate(entry) { return entry.too_few ? "too few" : WCA.fmt.pct(entry.rate); }

  var html = "<table><caption class=\"visually-hidden\">Out-of-school suspensions by school district</caption><thead><tr>" +
    "<th scope=\"col\">District</th><th scope=\"col\">Students, " + d.year + "</th><th scope=\"col\">Sent home</th>" +
    "<th scope=\"col\">Share sent home</th><th scope=\"col\">Black students sent home</th><th scope=\"col\">White students sent home</th>" +
    "<th scope=\"col\">Black–White gap, " + d.pooled_label + "</th></tr></thead><tbody>";
  html += "<tr><th scope=\"row\">All of Westchester</th><td>" + WCA.fmt.count(d.county.enrolled) + "</td><td>" +
    WCA.fmt.count(d.county.sent_home) + "</td><td>" + WCA.fmt.pct(d.county.rate) + "</td><td></td><td></td><td>" +
    fmtTimes(d.county.gap_pooled) + "</td></tr>";
  codes.forEach(function (code) {
    var p = d.places[code];
    html += "<tr><th scope=\"row\">" + p.label + "</th><td>" + WCA.fmt.count(p.enrolled) + "</td><td>" + WCA.fmt.count(p.sent_home) +
      "</td><td>" + (p.too_few ? "too few" : WCA.fmt.pct(p.rate)) + "</td><td>" + rate(p.groups.Black) + "</td><td>" +
      rate(p.groups.White) + "</td><td>" + (p.gap.too_few ? "too few" : fmtTimes(p.gap.value)) + "</td></tr>";
  });
  html += "</tbody></table>";
  document.getElementById("district-table").innerHTML = html;
}


/* --------------------------------------------------------------------------
   6. PART 2 CHART  ·  school days lost per 100 students, by race
   -------------------------------------------------------------------------- */

/* The first group of the gap (Black students) in dark steel, the others in light steel. */
function drawDaysByRace(data) {
  var lost = data.lost;
  var highlight = lost.days_pair.a.group;
  var rows = lost.days_by_race.filter(function (r) { return !r.too_few_to_compare; });
  sizeBox("chart-days", rows.length, 40);

  new Chart(document.getElementById("chart-days"), {
    type: "bar",
    data: {
      labels: rows.map(function (r) { return r.label; }),
      datasets: [{
        data: rows.map(function (r) { return r.per_100; }),
        backgroundColor: rows.map(function (r) { return r.group === highlight ? SNS.ink : SNS.steelLight; }),
      }],
    },
    options: horizontalBarOptions({
      valueLabels: { datasets: [0], format: WCA.fmt.count },
      tooltip: { callbacks: {
        title: function (items) { return rows[items[0].dataIndex].label + " students, " + lost.year; },
        label: function (item) {
          var r = rows[item.dataIndex];
          return WCA.fmt.count(r.per_100) + " days per 100 students (" + WCA.fmt.count(r.days) + " days, " +
                 WCA.fmt.count(r.enrolled) + " students)";
        },
      } },
    }, null, WCA.fmt.count),
    plugins: [WCA.plugins.valueLabels],
  });
}


/* --------------------------------------------------------------------------
   7. PART 3 CHART  ·  the Black share at each step
   -------------------------------------------------------------------------- */

/* One bar per step. The first bar (students enrolled) is the comparison, in gray, and the
   dashed line repeats it down the chart: a bar past the line is more than the group's share. */
function drawPathSteps(data) {
  var path = data.path;
  var group = path.groups[0];
  var steps = path.steps;
  var base = steps[0].shares[group];
  sizeBox("chart-steps", steps.length, NARROW ? 54 : 48, 40);

  /* A step's years are written beside its label only when they differ from the school year (the arrests) */
  function stepLabel(s) { return s.period === data.meta.latest_year ? s.label : s.label + " (" + s.period + ")"; }

  new Chart(document.getElementById("chart-steps"), {
    type: "bar",
    data: {
      labels: steps.map(function (s) { return wrap(stepLabel(s), LABEL_WIDTH); }),
      datasets: [{
        data: steps.map(function (s) { return s.shares[group]; }),
        backgroundColor: steps.map(function (s, i) { return i === 0 ? SNS.state : SNS.steel; }),
      }],
    },
    options: horizontalBarOptions({
      valueLabels: { datasets: [0], format: WCA.fmt.pct },
      refLine: { value: base, label: group + " share of students", color: SNS.accent },
      tooltip: { callbacks: {
        title: function (items) { return steps[items[0].dataIndex].label + ", " + steps[items[0].dataIndex].period; },
        label: function (item) {
          var s = steps[item.dataIndex];
          return WCA.fmt.count(s.counts[group]) + " of " + WCA.fmt.count(s.total) + " were " + group + " (" + WCA.fmt.pct(s.shares[group]) + ")";
        },
      } },
    }, { top: 22 }),
    plugins: [WCA.plugins.valueLabels, refLine],
  });
}


/* --------------------------------------------------------------------------
   8. PART 4  ·  the $50 million as one bar split three ways
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
   9. SMALL HELPERS
   -------------------------------------------------------------------------- */

/* 6.7 -> "6.7×" (how many times as often) */
function fmtTimes(n) {
  if (n === null || n === undefined) return "n/a";
  return Number(n).toFixed(1) + "×";
}

/* Format a value by the unit named in data.json, including this page's "times" */
function byUnit(value, unit) {
  if (unit === "times") return fmtTimes(value);
  return WCA.fmt.byUnit(value, unit);
}

/* ["A", "B", "C"] -> "A, B and C" */
function listWords(items) {
  if (items.length < 2) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

/* The color step a value falls in: steps [1, 2, 3, 5] make five steps, under 1 up to 5 or more */
function stepColor(value, steps, ramp) {
  var i = 0;
  while (i < steps.length && value >= steps[i]) i++;
  return ramp[i];
}

/* Legend words for the steps: [1, 2, 3, 5] with "%" -> "Under 1%", "1–1.9%", "2–2.9%", "3–4.9%", "5% or more".
   Values on the page have one decimal, so each step ends 0.1 below the next one. */
function stepLabels(steps, unit) {
  var mark = unit === "times" ? "×" : "%";
  var labels = ["Under " + steps[0] + mark];
  for (var i = 0; i < steps.length - 1; i++) {
    labels.push(steps[i] + "–" + (Math.round((steps[i + 1] - 0.1) * 10) / 10) + mark);
  }
  labels.push(steps[steps.length - 1] + mark + " or more");
  return labels;
}

/* refLine: a dashed line across a horizontal bar chart at one value, with a short label above it.
   Turn on per chart with:  plugins: { refLine: { value: 2.2, label: "All students 2.2%", color: ... } }
   The label is written in text color; the line takes the given color. */
var refLine = {
  id: "refLine",
  afterDatasetsDraw: function (chart, args, options) {
    if (!options || options.value === null || options.value === undefined) return;
    var area = chart.chartArea;
    var x = chart.scales.x.getPixelForValue(options.value);
    var ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = options.color || WCA.colors.ink;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(x, area.top); ctx.lineTo(x, area.bottom); ctx.stroke();
    ctx.setLineDash([]);
    if (options.label) {
      ctx.font = "600 12px " + WCA.font;
      ctx.fillStyle = WCA.colors.ink;
      var leftSide = x > area.left + (area.right - area.left) * 0.6;   /* near the right edge: write it to the left */
      ctx.textAlign = leftSide ? "right" : "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(options.label, leftSide ? x + 4 : x - 4, area.top - 4);
    }
    ctx.restore();
  },
};

/* The options every horizontal bar chart shares: bars run left to right, room on the right for
   the value labels. `plugins` adds the chart's own; `padding` adds room (e.g. above, for a line's label);
   `tickFormat` writes the numbers on the value axis (default: percentages). */
function horizontalBarOptions(plugins, padding, tickFormat) {
  var pad = { right: 52, top: 0 };
  if (padding) Object.keys(padding).forEach(function (k) { pad[k] = padding[k]; });
  var ticks = tickFormat || function (v) { return v + "%"; };
  return {
    indexAxis: "y",
    datasets: { bar: { barPercentage: 0.75, categoryPercentage: 0.8 } },
    layout: { padding: pad },
    scales: {
      x: { beginAtZero: true, grace: "8%", ticks: { callback: ticks, maxTicksLimit: 6 } },
      y: { grid: { display: false }, ticks: { autoSkip: false } },   /* every bar keeps its label */
    },
    plugins: plugins,
  };
}

/* Give a chart's box enough height for its bars: `perBar` pixels each, plus `extra` for the axis */
function sizeBox(canvasId, bars, perBar, extra) {
  document.getElementById(canvasId).parentNode.style.height = ((extra || 40) + bars * perBar) + "px";
}

/* insideLabels: write each bar's value inside its end, in white (used where a dashed line runs
   just past the bar ends and labels outside would collide with it).
   Turn on per chart with:  plugins: { insideLabels: { format: fmtTimes } } */
var insideLabels = {
  id: "insideLabels",
  afterDatasetsDraw: function (chart, args, options) {
    if (!options || !options.format) return;
    var ctx = chart.ctx;
    var meta = chart.getDatasetMeta(0);
    var values = chart.data.datasets[0].data;
    ctx.save();
    ctx.font = "600 13px " + WCA.font;
    ctx.fillStyle = WCA.cssVar("--white");
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    meta.data.forEach(function (bar, i) {
      if (values[i] === null || values[i] === undefined) return;
      ctx.fillText(options.format(values[i]), bar.x - 8, bar.y);
    });
    ctx.restore();
  },
};

/* Break text into lines of about `width` characters, at spaces (a bar label on two lines) */
function wrap(text, width) {
  var words = text.split(" "), lines = [], line = "";
  words.forEach(function (word) {
    if ((line + " " + word).trim().length > width && line) { lines.push(line); line = word; }
    else line = (line + " " + word).trim();
  });
  if (line) lines.push(line);
  return lines;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
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
