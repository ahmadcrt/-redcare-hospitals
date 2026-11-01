/* Public pages: departments, doctors, contact. Designed & Developed by Ahmad */
(function () {
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var daysText = function (a) { return (a || []).slice().sort().map(function (n) { return DAYS[n]; }).join(", "); };
  var hhmm = function (t) { return RC.fmtTime(String(t).slice(0, 5)); };
  var initials = function (n) { return n.replace(/^Dr\.?\s*/i, "").split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase(); };
  var $ = function (id) { return document.getElementById(id); };

  function doctorCard(d) {
    var dep = d.departments ? '<span class="tag">' + RC.esc(d.departments.name) + "</span>" : "";
    return '<article class="card"><div class="avatar" aria-hidden="true">' + RC.esc(initials(d.full_name)) + "</div>" +
      "<h3>" + RC.esc(d.full_name) + '</h3><p class="muted">' + RC.esc(d.specialty) + "</p>" + dep +
      '<p class="hint">Demo availability: ' + RC.esc(daysText(d.available_days)) + ", " + hhmm(d.slot_start) + " to " + hhmm(d.slot_end) + "</p>" +
      '<div class="card-actions"><button class="btn btn-outline btn-sm" type="button" data-doc="' + RC.esc(d.id) + '">View profile</button>' +
      '<a class="btn btn-primary btn-sm" href="appointments.html?doctor=' + encodeURIComponent(d.id) + '">Book</a></div></article>';
  }
  function deptCard(d, full) {
    var svc = (d.services || []).map(function (s) { return "<li>" + RC.esc(s) + "</li>"; }).join("");
    var docs = (d.doctors || []).map(function (x) { return RC.esc(x.full_name) + " (" + RC.esc(x.specialty) + ")"; }).join("; ");
    return '<article class="card" id="' + RC.esc(d.slug) + '"><div class="icon" aria-hidden="true">' + RC.esc(d.name.charAt(0)) + "</div><h3>" + RC.esc(d.name) + "</h3><p>" + RC.esc(d.description) + "</p>" +
      (full ? "<strong>Services offered</strong><ul class=\"card-list\">" + svc + "</ul>" + '<p class="hint"><strong>Doctors (fictional):</strong> ' + (docs || "None listed yet.") + "</p>" : "") +
      '<div class="card-actions"><a class="btn btn-outline btn-sm" href="' + (full ? "appointments.html?department=" + encodeURIComponent(d.slug) : "departments.html#" + RC.esc(d.slug)) + '">' + (full ? "Book in this department" : "Learn more") + "</a></div></article>";
  }
  function guard(el) { if (!RC.db) { RC.error(el, RC.NOT_CONFIGURED_MSG); return false; } RC.loading(el); return true; }

  async function featured() {
    var dEl = $("featured-depts"), cEl = $("featured-doctors");
    if (dEl && guard(dEl)) {
      var r = await RC.db.from("departments").select("*").order("name").limit(6);
      if (r.error) RC.error(dEl); else if (!r.data.length) RC.empty(dEl, "No departments available yet."); else dEl.innerHTML = r.data.map(function (d) { return deptCard(d, false); }).join("");
    }
    if (cEl && guard(cEl)) {
      var q = await RC.db.from("doctors").select("*, departments(name)").order("years_experience", { ascending: false }).limit(3);
      if (q.error) RC.error(cEl); else if (!q.data.length) RC.empty(cEl, "No doctors available yet."); else { cEl.innerHTML = q.data.map(doctorCard).join(""); bindDialog(q.data); }
    }
  }
  async function departments() {
    var el = $("dept-list"); if (!el || !guard(el)) return;
    var r = await RC.db.from("departments").select("*, doctors(id, full_name, specialty)").order("name");
    if (r.error) return RC.error(el);
    if (!r.data.length) return RC.empty(el, "No departments available yet.");
    el.innerHTML = r.data.map(function (d) { return deptCard(d, true); }).join("");
  }
  var docsCache = [];
  function bindDialog(list) {
    docsCache = list;
    var dlg = $("doc-dialog"); if (!dlg || !dlg.showModal) return;
    document.querySelectorAll("[data-doc]").forEach(function (b) {
      b.onclick = function () {
        var d = docsCache.find(function (x) { return x.id === b.dataset.doc; }); if (!d) return;
        $("doc-body").innerHTML = '<div class="avatar" aria-hidden="true">' + RC.esc(initials(d.full_name)) + "</div><h2 id=\"doc-title\">" + RC.esc(d.full_name) + "</h2><p class=\"muted\">" + RC.esc(d.specialty) +
          (d.departments ? " &middot; " + RC.esc(d.departments.name) : "") + "</p><p>" + RC.esc(d.bio) + "</p><p><strong>Experience:</strong> " + RC.esc(d.years_experience) + " years (fictional)</p><p><strong>Demo availability:</strong> " +
          RC.esc(daysText(d.available_days)) + ", " + hhmm(d.slot_start) + " to " + hhmm(d.slot_end) + '</p><p class="notice">This is an example profile of a fictional doctor.</p>' +
          '<div class="card-actions"><a class="btn btn-primary" href="appointments.html?doctor=' + encodeURIComponent(d.id) + '">Book with this doctor</a><button class="btn btn-outline" type="button" id="doc-close">Close</button></div>';
        $("doc-close").onclick = function () { dlg.close(); };
        dlg.showModal();
      };
    });
  }
  async function doctors() {
    var el = $("doctor-list"); if (!el || !guard(el)) return;
    var r = await RC.db.from("doctors").select("*, departments(name, slug)").order("full_name");
    if (r.error) return RC.error(el);
    var all = r.data, sel = $("filter-dept"), search = $("filter-search"), count = $("result-count");
    var names = Array.from(new Set(all.map(function (d) { return d.departments && d.departments.name; }).filter(Boolean))).sort();
    sel.innerHTML = '<option value="">All departments</option>' + names.map(function (n) { return "<option>" + RC.esc(n) + "</option>"; }).join("");
    function apply() {
      var t = search.value.trim().toLowerCase(), dep = sel.value;
      var list = all.filter(function (d) {
        var hay = (d.full_name + " " + d.specialty + " " + (d.departments ? d.departments.name : "")).toLowerCase();
        return (!t || hay.indexOf(t) > -1) && (!dep || (d.departments && d.departments.name === dep));
      });
      count.textContent = list.length + " doctor" + (list.length === 1 ? "" : "s") + " found";
      if (!list.length) RC.empty(el, "No doctors match your search."); else { el.innerHTML = list.map(doctorCard).join(""); bindDialog(all); }
    }
    search.addEventListener("input", RC.debounce(apply, 200)); sel.addEventListener("change", apply); apply();
  }
  function contact() {
    var f = $("contact-form"); if (!f) return;
    var box = $("contact-message");
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (f.elements.website.value) return; /* honeypot */
      var v = function (n) { return f.elements[n].value.trim(); };
      if (v("name").length < 2) return RC.msg(box, "error", "Please enter your name.");
      if (!RC.auth.validEmail(v("email"))) return RC.msg(box, "error", "Please enter a valid email address.");
      if (v("subject").length < 2) return RC.msg(box, "error", "Please enter a subject.");
      if (v("message").length < 10 || v("message").length > 2000) return RC.msg(box, "error", "Message must be between 10 and 2000 characters.");
      if (!RC.db) return RC.msg(box, "error", RC.NOT_CONFIGURED_MSG);
      var b = f.querySelector("button[type=submit]"); b.disabled = true;
      var r = await RC.db.from("contact_messages").insert({ name: v("name"), email: v("email"), subject: v("subject"), message: v("message") });
      b.disabled = false;
      if (r.error) return RC.msg(box, "error", "Your message could not be sent. Please try again later.");
      f.reset(); RC.msg(box, "success", "Thank you. Your demo message was saved. No real staff will reply to it.");
    });
  }
  document.addEventListener("DOMContentLoaded", function () { featured(); departments(); doctors(); contact(); });
})();
