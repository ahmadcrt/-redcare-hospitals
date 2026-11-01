/* Patient dashboard + appointments. Data access is limited by RLS to the signed-in patient. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var profile = null, all = [];
  var toMin = function (t) { var p = String(t).split(":"); return +p[0] * 60 + +p[1]; };
  function isFuture(a) {
    var n = RC.lagosNow();
    return a.appointment_date > n.date || (a.appointment_date === n.date && toMin(a.appointment_time) > n.mins);
  }
  var active = function (a) { return a.status === "pending" || a.status === "confirmed"; };
  var canCancel = function (a) { return active(a) && isFuture(a); };

  async function load() {
    var r = await RC.db.from("appointments")
      .select("*, doctors(full_name, specialty), departments(name)")
      .eq("patient_id", profile.id).order("appointment_date", { ascending: false }).order("appointment_time", { ascending: false });
    if (r.error) throw r.error;
    all = r.data;
  }
  function row(a) {
    return '<div class="appt"><div><h3>' + RC.esc(a.doctors ? a.doctors.full_name : "Doctor") + " &middot; " + RC.esc(a.departments ? a.departments.name : "") + "</h3><p>" +
      RC.esc(RC.fmtDate(a.appointment_date)) + " at " + RC.esc(RC.fmtTime(a.appointment_time.slice(0, 5))) + " &middot; Ref " + RC.esc(a.reference_number) + "</p></div><div>" +
      RC.statusBadge(a.status) + ' <button class="btn btn-outline btn-sm" type="button" data-appt="' + RC.esc(a.id) + '">Details</button></div></div>';
  }
  function renderList(el, list, emptyText) {
    if (!list.length) { el.innerHTML = '<div class="state state-empty">' + RC.esc(emptyText) + ' <a href="appointments.html">Book an appointment</a></div>'; return; }
    el.innerHTML = list.map(row).join("");
    el.querySelectorAll("[data-appt]").forEach(function (b) { b.addEventListener("click", function () { openDetails(b.dataset.appt); }); });
  }

  async function openDetails(id) {
    var a = all.find(function (x) { return x.id === id; }), dlg = $("appt-dialog"); if (!a) return;
    var body = $("appt-body");
    body.innerHTML = '<h2 id="appt-title">Appointment ' + RC.esc(a.reference_number) + "</h2><p>" + RC.statusBadge(a.status) + "</p><dl class=\"dl\">" +
      "<dt>Doctor</dt><dd>" + RC.esc(a.doctors ? a.doctors.full_name : "") + "</dd><dt>Department</dt><dd>" + RC.esc(a.departments ? a.departments.name : "") +
      "</dd><dt>Date</dt><dd>" + RC.esc(RC.fmtDate(a.appointment_date)) + "</dd><dt>Time</dt><dd>" + RC.esc(RC.fmtTime(a.appointment_time.slice(0, 5))) +
      "</dd><dt>Name</dt><dd>" + RC.esc(a.patient_name) + "</dd><dt>Reason</dt><dd>" + RC.esc(a.reason || "Not provided") + '</dd></dl><div id="appt-history" class="hint">Loading history…</div>' +
      '<div class="card-actions" id="appt-actions"></div><div id="appt-dlg-msg" aria-live="polite"></div>';
    var acts = $("appt-actions");
    acts.innerHTML = (canCancel(a) ? '<button class="btn btn-danger" type="button" id="cancel-start">Cancel appointment</button>' : "") + '<button class="btn btn-outline" type="button" id="dlg-close">Close</button>';
    $("dlg-close").onclick = function () { dlg.close(); };
    if (canCancel(a)) $("cancel-start").onclick = function () {
      acts.innerHTML = '<p style="width:100%"><strong>Cancel this appointment?</strong> This cannot be undone.</p><button class="btn btn-danger" type="button" id="cancel-yes">Yes, cancel it</button><button class="btn btn-outline" type="button" id="cancel-no">Keep it</button>';
      $("cancel-no").onclick = function () { openDetails(id); };
      $("cancel-yes").onclick = async function () {
        this.disabled = true;
        var u = await RC.db.from("appointments").update({ status: "cancelled" }).eq("id", id).select("id").maybeSingle();
        if (u.error || !u.data) { this.disabled = false; return RC.msg($("appt-dlg-msg"), "error", u.error && u.error.code === "P0001" ? u.error.message : "Could not cancel this appointment."); }
        dlg.close(); RC.msg($("portal-message"), "success", "Appointment " + a.reference_number + " was cancelled.");
        await refresh();
      };
    };
    if (!dlg.open) dlg.showModal();
    var h = await RC.db.from("appointment_status_history").select("old_status,new_status,changed_at").eq("appointment_id", id).order("changed_at");
    var hel = $("appt-history");
    if (h.error || !h.data.length) hel.textContent = ""; else hel.innerHTML = "<strong>History</strong><br>" + h.data.map(function (x) {
      return RC.esc(new Date(x.changed_at).toLocaleString("en-GB")) + ": " + RC.esc(x.old_status ? x.old_status + " to " + x.new_status : "created as " + x.new_status);
    }).join("<br>");
  }

  function renderDashboard() {
    var up = all.filter(function (a) { return active(a) && isFuture(a); }).sort(function (a, b) { return (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time); });
    var n = function (s) { return all.filter(function (a) { return a.status === s; }).length; };
    $("stat-upcoming").textContent = up.length; $("stat-pending").textContent = n("pending"); $("stat-completed").textContent = n("completed"); $("stat-cancelled").textContent = n("cancelled");
    renderList($("upcoming-list"), up.slice(0, 3), "You have no upcoming appointments.");
  }
  async function notifications() {
    var el = $("notif-list"); if (!el) return;
    var r = await RC.db.from("notifications").select("*").order("created_at", { ascending: false }).limit(5);
    if (r.error) return RC.error(el, "Could not load notifications.");
    if (!r.data.length) return RC.empty(el, "No notifications yet. Status updates from the hospital will appear here.");
    el.innerHTML = r.data.map(function (x) {
      return '<div class="notif' + (x.is_read ? "" : " unread") + '"><span class="sys">System</span>' + RC.esc(x.title) + "<small>" + RC.esc(x.message) + " &middot; " + RC.esc(new Date(x.created_at).toLocaleString("en-GB")) + "</small></div>";
    }).join("");
    var m = $("mark-read"); m.hidden = !r.data.some(function (x) { return !x.is_read; });
    m.onclick = async function () { await RC.db.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false); notifications(); };
  }
  function renderAppointments() {
    var f = $("status-filter").value, list = f ? all.filter(function (a) { return a.status === f; }) : all;
    renderList($("appt-list"), list, f ? "No " + f + " appointments." : "You have no appointments yet.");
  }
  async function refresh() {
    try { await load(); } catch (e) { return RC.error($("appt-list") || $("upcoming-list"), "Could not load your appointments. Please refresh."); }
    if ($("stats")) renderDashboard();
    if ($("appt-list")) renderAppointments();
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var portal = $("portal"); if (!portal) return;
    if (!RC.db) { $("portal-loading").innerHTML = '<div class="state state-error">' + RC.esc(RC.NOT_CONFIGURED_MSG) + "</div>"; return; }
    profile = await RC.auth.require(); if (!profile) return;
    $("portal-loading").hidden = true; portal.hidden = false;
    if ($("welcome-name")) $("welcome-name").textContent = profile.full_name;
    if ($("status-filter")) $("status-filter").addEventListener("change", renderAppointments);
    await refresh(); notifications();
  });
})();
