(function () {
  var $ = function (id) { return document.getElementById(id); };
  async function load() {
    var el = $("pat-wrap"); RC.loading(el);
    var q = RC.db.from("profiles").select("*").eq("role", "patient").order("created_at", { ascending: false }).limit(200);
    var s = $("search").value.replace(/[^\w\s@.\-]/g, "").trim(), st = $("f-active").value;
    if (s) q = q.or("full_name.ilike.%" + s + "%,email.ilike.%" + s + "%"); if (st) q = q.eq("is_active", st === "active");
    var r = await q; if (r.error) return RC.error(el);
    $("count").textContent = r.data.length + " patient" + (r.data.length === 1 ? "" : "s");
    if (!r.data.length) return RC.empty(el, "No patients found.");
    el.innerHTML = '<div class="table-wrap"><table class="table-stack"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + r.data.map(function (p) {
      return '<tr><td data-label="Name">' + RC.esc(p.full_name) + '</td><td data-label="Email">' + RC.esc(p.email) + '</td><td data-label="Phone">' + RC.esc(p.phone || "-") + '</td><td data-label="Joined">' + RC.esc(new Date(p.created_at).toLocaleDateString("en-GB")) +
        '</td><td data-label="Status">' + (p.is_active ? '<span class="badge badge-completed">Active</span>' : '<span class="badge badge-cancelled">Disabled</span>') + '</td><td data-label="Actions"><button class="btn btn-outline btn-sm" type="button" data-id="' + RC.esc(p.id) +
        '" data-active="' + p.is_active + '" data-name="' + RC.esc(p.full_name) + '">' + (p.is_active ? "Disable" : "Reactivate") + "</button></td></tr>";
    }).join("") + "</tbody></table></div>";
    el.querySelectorAll("button[data-id]").forEach(function (b) { b.onclick = async function () {
      var on = b.dataset.active === "true";
      if (on && !confirm("Disable app access for " + b.dataset.name + "?")) return;
      var r = await RC.db.from("profiles").update({ is_active: !on }).eq("id", b.dataset.id).select("id").maybeSingle();
      if (r.error || !r.data) return RC.msg($("admin-message"), "error", "Could not update this patient.");
      RC.msg($("admin-message"), "success", b.dataset.name + (on ? " disabled." : " reactivated.")); load();
    }; });
  }
  document.addEventListener("DOMContentLoaded", async function () {
    if (!$("pat-wrap")) return; if (!await RC.adminInit()) return;
    $("search").addEventListener("input", RC.debounce(load, 300)); $("f-active").addEventListener("change", load); load();
  });
})();
