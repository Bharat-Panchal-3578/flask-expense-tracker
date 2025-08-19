async function apiFetch(url,options= {}) {
    options.credentials = "include";

    if (!options.headers) options.headers = {};
    if (localStorage.getItem("access_token")) {
        options.headers['Authorization'] = `Bearer ${localStorage.getItem("access_token")}`;
    }

    let response = await fetch(url,options);

    if (response.status === 401) {
        const refreshed = await refreshAccessToken();

        if (refreshed) {
            options.headers['Authorization'] = `Bearer ${localStorage.getItem("access_token")}`;
            response = await fetch(url,options);
        }
    }

    return response;
}

async function refreshAccessToken() {
    const response = await fetch("/api/refresh",{
        method:"POST",
        credentials: "include"
    });

    if (response.ok) {
        const data = await response.json();
        localStorage.setItem("access_token",data.data.access_token);
        return true;
    }

    window.location.href = "/login";
    return false;
}