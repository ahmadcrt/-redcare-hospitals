/* Patient profile: view and edit permitted fields (name, phone). */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  document.addEventListener("DOMContentLoaded", async function () {
    var form = $("profile-form"); if (!form) return;
    if (!RC.db) { $("portal-loading").innerHTML = '<div class="state state-error">' + RC.esc(RC.NOT_CONFIGURED_MSG) + "</div>"; return; }
    var p = await RC.auth.require(); if (!p) return;
    $("portal-loading").hidden = true; $("portal").hidden = false;
    var box = $("profile-message");
    form.elements.full_name.value = p.full_name; form.elements.email.value = p.email; form.elements.phone.value = p.phone || "";
    $("member-since").textContent = new Date(p.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = form.elements.full_name.value.trim(), phone = form.elements.phone.value.trim();
      if (name.length < 2 || name.length > 100) return RC.msg(box, "error", "Name must be between 2 and 100 characters.");
      if (!RC.auth.validPhone(phone)) return RC.msg(box, "error", "Phone number may contain only digits, spaces and + ( ) -");
      var b = form.querySelector("button[type=submit]"); b.disabled = true;
      var r = await RC.db.from("profiles").update({ full_name: name, phone: phone || null }).eq("id", p.id).select("full_name").maybeSingle();
      b.disabled = false;
      if (r.error || !r.data) return RC.msg(box, "error", "Your profile could not be updated. Please try again.");
      RC.msg(box, "success", "Profile updated.");
    });
  });
})();
