document.addEventListener("DOMContentLoaded",() => {
    const dashboardLink = document.querySelector("a[href='/dashboard']");
    const registerBtn = document.querySelector("#registerBtn");
    const loginBtn = document.querySelector("#loginBtn");
    const logoutBtn = document.querySelector("#logoutBtn");

    if (localStorage.getItem("access_token")) {
        dashboardLink.classList.remove("disabled");
        dashboardLink.classList.add("active");
        registerBtn.classList.add("d-none");
        loginBtn.classList.add("d-none");
        logoutBtn.classList.remove("d-none");
    } else {
        dashboardLink.classList.add("disabled");
        dashboardLink.classList.remove("active");
        registerBtn.classList.remove("d-none");
        loginBtn.classList.remove("d-none");
        logoutBtn.classList.add("d-none");
    }

    document.getElementById("logoutAction").addEventListener("click",() => {
        localStorage.removeItem("access_token");
        window.location.href = '/';
    });

});