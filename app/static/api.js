async function apiFetch(url,options= {}) {
    options.credentials = "include";

    if (!options.headers) options.headers = {};
    if (window.accessToken) {
        options.headers['Authorization'] = `Bearer ${window.accessToken}`;
    }

    let response = await fetch(url,options);

    if (response.status === 401) {
        const refreshed = await refreshAccessToken();

        if (refreshed) {
            options.headers['Authorization'] = `Bearer ${window.accessToken}`;
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
        window.accessToken = data.data.access_token;
        return true;
    }

    window.location.href = "/login";
    return false;
}