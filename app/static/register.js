const form = document.getElementById("RegisterForm");

form.addEventListener("submit", async function(e) {
    e.preventDefault() // stop page refresh

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
        const response = await fetch("/api/register",{
            method:"POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({username, email, password})
        });

        const result = await response.json();

        if (response.ok) {
            showFlash(result.message,"success");
            setTimeout(() => {
                window.location.href ="/home";
            }, 3000);
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