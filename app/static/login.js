document.getElementById("LoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
        const response = await fetch("/api/login",{
            method:"POST",
            headers: {
                "Content-Type":"application/json"
            },
            credentials: "include",
            body: JSON.stringify({username,email,password})
        });

        const result = await response.json();

        if (response.ok) {
            window.accessToken = result.data.access_token;
            localStorage.setItem("is_logged_in","true");
            showFlash(result.message,"success");

            setTimeout(() => {
                window.location.href = '/';
            }, 100);

        } else {
            showFlash(result.message, "danger");

        }

    } catch (error) {
        showFlash("Something went wrong!","danger");

    }
});

function showFlash(message, type) {
  document.getElementById("flashMessage").innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}