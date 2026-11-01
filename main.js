/* Shared layout (header, footer, mobile menu) and utilities. Designed & Developed by Ahmad */
window.RC = window.RC || {};
(function () {
  var NAV = [["index.html","Home"],["about.html","About"],["departments.html","Departments"],["doctors.html","Doctors"],
             ["services.html","Services"],["appointments.html","Book Appointment"],["contact.html","Contact"]];

  RC.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); };
  RC.fmtDate = function (d) { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); };
  RC.fmtTime = function (t) { var p = String(t).split(":"), h = +p[0]; return ((h % 12) || 12) + ":" + p[1] + " " + (h < 12 ? "AM" : "PM"); };
  RC.debounce = function (fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms || 250); }; };
  /* Accessible message. type: success | error | info | "" (clears) */
  RC.msg = function (el, type, text) {
    if (!el) return;
    el.className = type ? "alert alert-" + type : "";
    el.setAttribute("role", type === "error" ? "alert" : "status");
    el.textContent = text || "";
    if (type) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  RC.statusBadge = function (s) { return '<span class="badge badge-' + RC.esc(s) + '">' + RC.esc(s.charAt(0).toUpperCase() + s.slice(1)) + "</span>"; };
  RC.loading = function (el, t) { el.innerHTML = '<div class="state"><span class="spinner" aria-hidden="true"></span> ' + RC.esc(t || "Loading…") + "</div>"; };
  RC.empty = function (el, t) { el.innerHTML = '<div class="state state-empty">' + RC.esc(t) + "</div>"; };
  RC.error = function (el, t) { el.innerHTML = '<div class="state state-error" role="alert">' + RC.esc(t || "Could not load data. Please try again.") + "</div>"; };

  function header(active) {
    var links = NAV.map(function (n) {
      return '<li><a href="' + n[0] + '"' + (n[0] === active ? ' aria-current="page"' : "") + ">" + n[1] + "</a></li>";
    }).join("");
    return '<a class="skip-link" href="#main">Skip to main content</a>' +
      '<div class="demo-banner">Fictional demonstration project. REDCARE HOSPITALS is not a real hospital. <a href="privacy.html">Learn more</a></div>' +
      '<header class="site-header"><div class="container nav">' +
      '<a class="brand" href="index.html" aria-label="REDCARE HOSPITALS home"><span class="brand-mark" aria-hidden="true">+</span><span>REDCARE <small>HOSPITALS</small></span></a>' +
      '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu"><span></span><span></span><span></span></button>' +
      '<nav id="site-nav" class="nav-menu" aria-label="Main"><ul class="nav-links">' + links + '</ul>' +
      '<div class="nav-actions" id="nav-actions"><a class="btn btn-outline btn-sm" href="login.html">Log in</a><a class="btn btn-primary btn-sm" href="register.html">Register</a></div></nav>' +
      "</div></header>";
  }
  function footer() {
    return '<footer class="site-footer"><div class="container footer-grid">' +
      '<div><div class="brand brand-light"><span class="brand-mark" aria-hidden="true">+</span><span>REDCARE <small>HOSPITALS</small></span></div>' +
      '<p>A fictional healthcare provider created as a software portfolio project.</p></div>' +
      '<div><h2 class="footer-h">Explore</h2><ul><li><a href="about.html">About</a></li><li><a href="departments.html">Departments</a></li><li><a href="doctors.html">Doctors</a></li><li><a href="services.html">Services</a></li></ul></div>' +
      '<div><h2 class="footer-h">Patients</h2><ul><li><a href="appointments.html">Book appointment</a></li><li><a href="login.html">Patient login</a></li><li><a href="register.html">Register</a></li><li><a href="contact.html">Contact</a></li></ul></div>' +
      '<div><h2 class="footer-h">Legal</h2><ul><li><a href="privacy.html">Privacy &amp; demo notice</a></li></ul></div>' +
      '</div><div class="container footer-bottom"><p><strong>Demo disclaimer:</strong> This website provides no real medical services, advice or emergency care. All doctors and data are fictional. In a real emergency, call your local emergency number.</p>' +
      "<p>&copy; " + new Date().getFullYear() + " REDCARE HOSPITALS (demo). Designed &amp; Developed by Ahmad</p></div></footer>";
  }

  async function authNav() {
    var box = document.getElementById("nav-actions");
    if (!box || !RC.auth) return;
    var p = await RC.auth.profile();
    if (!p) return;
    var admin = p.role === "admin";
    box.innerHTML = '<a class="btn btn-outline btn-sm" href="' + (admin ? "admin-dashboard.html" : "patient-dashboard.html") + '">' + (admin ? "Admin" : "My Dashboard") + '</a>' +
      '<button class="btn btn-primary btn-sm" id="logout-btn" type="button">Log out</button>';
    document.getElementById("logout-btn").addEventListener("click", function () { RC.auth.signOut(); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var active = location.pathname.split("/").pop() || "index.html";
    var h = document.getElementById("site-header"), f = document.getElementById("site-footer");
    if (h) h.innerHTML = header(active);
    if (f) f.innerHTML = footer();
    var t = document.querySelector(".nav-toggle"), m = document.getElementById("site-nav");
    if (t && m) {
      t.addEventListener("click", function () {
        var open = m.classList.toggle("open");
        t.setAttribute("aria-expanded", open); t.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && m.classList.contains("open")) { t.click(); t.focus(); } });
    }
    authNav();
  });
})();

/* Current date/time in Africa/Lagos (the timezone used by the database booking rules). */
RC.lagosNow = function () {
  var p = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  var g = function (t) { return p.find(function (x) { return x.type === t; }).value; };
  return { date: g("year") + "-" + g("month") + "-" + g("day"), mins: (+g("hour") % 24) * 60 + +g("minute") };
};
