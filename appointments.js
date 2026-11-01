/* Appointment booking. All rules are re-checked by database triggers. Designed & Developed by Ahmad */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  function lagosNow() {
    var p = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    var g = function (t) { return p.find(function (x) { return x.type === t; }).value; };
    return { date: g("year") + "-" + g("month") + "-" + g("day"), mins: (+g("hour") % 24) * 60 + +g("minute") };
  }
  var toMin = function (t) { var p = String(t).split(":"); return +p[0] * 60 + +p[1]; };
  var toTime = function (m) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0") + ":00"; };
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  document.addEventListener("DOMContentLoaded", async function () {
    var form = $("booking-form"); if (!form) return;
    var box = $("booking-message"), gate = $("auth-gate"), slotsEl = $("slots");
    if (!RC.db) { gate.hidden = false; RC.msg(box, "error", RC.NOT_CONFIGURED_MSG); return; }
    var profile = await RC.auth.profile();
    if (!profile || !profile.is_active) { gate.hidden = false; return; }
    form.hidden = false;
    form.elements.patient_name.value = profile.full_name || "";
    form.elements.patient_email.value = profile.email || "";
    form.elements.patient_phone.value = profile.phone || "";
    var today = lagosNow().date; form.elements.date.min = today;

    var dr = await RC.db.from("departments").select("id,name,slug").order("name");
    var cr = await RC.db.from("doctors").select("id,full_name,specialty,department_id,available_days,slot_start,slot_end,slot_minutes").order("full_name");
    if (dr.error || cr.error) return RC.msg(box, "error", "Could not load departments and doctors. Please refresh.");
    var depts = dr.data, docs = cr.data, deptSel = form.elements.department, docSel = form.elements.doctor;
    if (!depts.length || !docs.length) return RC.msg(box, "info", "No doctors are available for booking yet.");
    deptSel.innerHTML = '<option value="">Select a department</option>' + depts.map(function (d) { return '<option value="' + RC.esc(d.id) + '">' + RC.esc(d.name) + "</option>"; }).join("");
    function fillDocs() {
      var list = docs.filter(function (d) { return d.department_id === deptSel.value; });
      docSel.innerHTML = '<option value="">' + (deptSel.value ? "Select a doctor" : "Choose a department first") + "</option>" +
        list.map(function (d) { return '<option value="' + RC.esc(d.id) + '">' + RC.esc(d.full_name + " - " + d.specialty) + "</option>"; }).join("");
      docSel.disabled = !deptSel.value; renderSlots();
    }
    var q = new URLSearchParams(location.search), pre = docs.find(function (d) { return d.id === q.get("doctor"); });
    var preDept = pre ? pre.department_id : (depts.find(function (d) { return d.slug === q.get("department"); }) || {}).id;
    if (preDept) deptSel.value = preDept; fillDocs(); if (pre) docSel.value = pre.id;

    var doctor = function () { return docs.find(function (d) { return d.id === docSel.value; }); };
    function dateError() {
      var d = form.elements.date.value, doc = doctor();
      if (!d) return "Please choose a date.";
      if (isNaN(new Date(d + "T00:00:00"))) return "That date is not valid.";
      if (d < today) return "Appointments cannot be booked in the past.";
      if (doc && doc.available_days.indexOf(new Date(d + "T00:00:00").getDay()) < 0)
        return doc.full_name + " is only available on: " + doc.available_days.slice().sort().map(function (n) { return DAYS[n]; }).join(", ") + ".";
      return "";
    }
    async function renderSlots() {
      var doc = doctor(), d = form.elements.date.value;
      if (!doc || !d) { RC.empty(slotsEl, "Choose a doctor and date to see available times."); return; }
      var err = dateError(); if (err) { RC.empty(slotsEl, err); return; }
      RC.loading(slotsEl, "Checking availability…");
      var r = await RC.db.rpc("get_booked_slots", { p_doctor: doc.id, p_date: d });
      if (r.error) { RC.error(slotsEl, "Could not check availability. Please try again."); return; }
      var booked = r.data.map(function (x) { return toMin(x.slot); }), now = lagosNow(), html = "", free = 0;
      for (var m = toMin(doc.slot_start); m + doc.slot_minutes <= toMin(doc.slot_end); m += doc.slot_minutes) {
        var off = booked.indexOf(m) > -1 || (d === now.date && m <= now.mins); if (!off) free++;
        html += '<label class="slot"><input type="radio" name="time" value="' + toTime(m) + '"' + (off ? " disabled" : "") + "><span>" + RC.fmtTime(toTime(m).slice(0, 5)) + "</span></label>";
      }
      if (!free) RC.empty(slotsEl, "No times left on this date. Please choose another date."); else slotsEl.innerHTML = html;
    }
    deptSel.addEventListener("change", fillDocs); docSel.addEventListener("change", renderSlots); form.elements.date.addEventListener("change", renderSlots);
    if (pre) renderSlots();

    var data = null;
    function collect() {
      var f = form.elements, doc = doctor(), t = (form.querySelector("input[name=time]:checked") || {}).value;
      if (!deptSel.value) return "Please select a department.";
      if (!doc) return "Please select a doctor.";
      var de = dateError(); if (de) return de;
      if (!t) return "Please select a time slot.";
      if (f.patient_name.value.trim().length < 2) return "Please enter your full name.";
      if (!RC.auth.validPhone(f.patient_phone.value.trim()) || !f.patient_phone.value.trim()) return "Please enter a valid phone number.";
      if (!RC.auth.validEmail(f.patient_email.value.trim())) return "Please enter a valid email address.";
      if (f.reason.value.length > 300) return "The reason must be 300 characters or fewer.";
      if (!f.consent.checked) return "Please confirm you understand this is a demonstration booking.";
      data = { patient_id: profile.id, doctor_id: doc.id, department_id: doc.department_id, appointment_date: f.date.value, appointment_time: t,
        patient_name: f.patient_name.value.trim(), patient_phone: f.patient_phone.value.trim(), patient_email: f.patient_email.value.trim(),
        reason: f.reason.value.trim() || null, status: "pending" };
      return "";
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = collect(); if (err) return RC.msg(box, "error", err);
      RC.msg(box, "", ""); var doc = doctor();
      $("review-body").innerHTML = "<dl><dt>Department</dt><dd>" + RC.esc(deptSel.selectedOptions[0].text) + "</dd><dt>Doctor</dt><dd>" + RC.esc(doc.full_name) + "</dd><dt>Date</dt><dd>" + RC.esc(RC.fmtDate(data.appointment_date)) +
        "</dd><dt>Time</dt><dd>" + RC.esc(RC.fmtTime(data.appointment_time.slice(0, 5))) + "</dd><dt>Name</dt><dd>" + RC.esc(data.patient_name) + "</dd><dt>Phone</dt><dd>" + RC.esc(data.patient_phone) +
        "</dd><dt>Email</dt><dd>" + RC.esc(data.patient_email) + "</dd><dt>Reason</dt><dd>" + RC.esc(data.reason || "Not provided") + "</dd></dl>";
      form.hidden = true; $("review").hidden = false; $("review").scrollIntoView({ behavior: "smooth" });
    });
    $("edit-btn").addEventListener("click", function () { $("review").hidden = true; form.hidden = false; });
    $("confirm-btn").addEventListener("click", async function () {
      var b = this; b.disabled = true; b.textContent = "Booking…";
      var r = await RC.db.from("appointments").insert(data).select("reference_number,status").single();
      b.disabled = false; b.textContent = "Confirm booking";
      if (r.error) {
        $("review").hidden = true; form.hidden = false;
        if (r.error.code === "23505") { RC.msg(box, "error", "Sorry, that time was just taken or you already have a booking then. Please pick another slot."); renderSlots(); }
        else if (r.error.code === "P0001") RC.msg(box, "error", r.error.message);
        else RC.msg(box, "error", "We could not save your booking. Please try again later.");
        return;
      }
      $("review").hidden = true; $("result").hidden = false;
      $("ref").textContent = r.data.reference_number; $("result").scrollIntoView({ behavior: "smooth" });
    });
  });
})();
