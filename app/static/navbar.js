document.addEventListener("DOMContentLoaded", () => {
  const dashboardLink = document.querySelector("#dashboardLink");
  const registerBtn   = document.querySelector("#registerBtn");
  const loginBtn      = document.querySelector("#loginBtn");
  const logoutBtn     = document.querySelector("#logoutBtn");
  const logoutAction  = document.querySelector("#logoutAction");

  // ---- UI helpers
  function safeAddClass(el, cls)    { if (el) el.classList.add(cls); }
  function safeRemoveClass(el, cls) { if (el) el.classList.remove(cls); }

  function setLoggedInUI() {
    safeRemoveClass(dashboardLink, "disabled");
    safeAddClass(dashboardLink, "active");
    safeAddClass(registerBtn, "d-none");
    safeAddClass(loginBtn, "d-none");
    safeRemoveClass(logoutBtn, "d-none");
  }

  function setLoggedOutUI() {
    safeAddClass(dashboardLink, "disabled");
    safeRemoveClass(dashboardLink, "active");
    safeRemoveClass(registerBtn, "d-none");
    safeRemoveClass(loginBtn, "d-none");
    safeAddClass(logoutBtn, "d-none");
  }

  // ---- auth helpers
  function markLoggedIn(accessToken) {
    localStorage.setItem("access_token",accessToken);
    localStorage.setItem("is_logged_in", "true");
  }

  function clearLoginState() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("is_logged_in");
  }

  async function forceLogout(redirect = true) {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch (_) {/* ignore */}
    clearLoginState();
    setLoggedOutUI();
    if (redirect) window.location.href = "/";
  }

  // ---- refresh on load
  async function tryRefresh() {
    // 1) Optimistic UI: if user says they’re logged in, show it now.
    const looksLoggedIn = localStorage.getItem("is_logged_in") === "true";
    if (looksLoggedIn) setLoggedInUI();
    else { setLoggedOutUI(); return; }

    // 2) Confirm by asking the backend for a fresh access token.
    try {
      const res = await fetch("/api/refresh", { method: "POST", credentials: "include" });

      if (res.ok) {
        const data = await res.json();
        markLoggedIn(data.data.access_token);
        // UI already set to logged-in above; keep it.
        return;
      }

      // Treat 401/422 as “session invalid/expired”
      if (res.status === 401 || res.status === 422) {
        await forceLogout(false); // don’t bounce them immediately; just switch UI
        return;
      }

      // Unexpected status: keep UI consistent but log once for debugging
      console.debug("Unexpected /api/refresh response:", res.status, await res.text());
      await forceLogout(false);
    } catch (err) {
      // Network error: assume logged out
      console.debug("Refresh request failed:", err);
      await forceLogout(false);
    }
  }

  // ---- logout button
  if (logoutAction) {
    logoutAction.addEventListener("click", async () => {
      await forceLogout(true);
    });
  }

  // Run on page load
  tryRefresh();
});
