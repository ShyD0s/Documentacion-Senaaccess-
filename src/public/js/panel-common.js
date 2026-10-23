function getToken() {
    return localStorage.getItem('access_token');
}

async function apiGet(url) {
    const token = getToken();
    if (!token) {
        window.location.href = '/';
        return null;
    }
    const res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
    });
    if (res.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        window.location.href = '/';
        return null;
    }
    return res.json();
}

async function apiPost(url, data) {
    const token = getToken();
    if (!token) {
        window.location.href = '/';
        return null;
    }
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: data ? JSON.stringify(data) : undefined
    });
    if (res.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        window.location.href = '/';
        return null;
    }
    return res.json();
}

async function apiDelete(url) {
    const token = getToken();
    if (!token) {
        window.location.href = '/';
        return null;
    }
    const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
    });
    if (res.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        window.location.href = '/';
        return null;
    }
    return res.json();
}

async function handleLogout() {
    const token = getToken();
    if (token) {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
            });
        } catch (e) {}
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
    window.location.href = '/';
    return false;
}

function escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function formatDateTime(datetime) {
    if (!datetime) return { date: '', time: '' };
    const d = new Date(datetime);
    const date = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { date, time };
}

function estadoBadge(estado) {
    const isEntrada = estado === 'Entrada';
    const color = isEntrada ? '#198754' : '#ffc107';
    const bg = isEntrada ? 'rgba(25, 135, 84, 0.1)' : 'rgba(255, 193, 7, 0.1)';
    return `<span style="display: inline-block; padding: 0.35em 0.75em; font-size: 0.75rem; font-weight: 700; line-height: 1; border-radius: 0.375rem; background: ${bg}; color: ${color}; border: 1px solid ${isEntrada ? 'rgba(25, 135, 84, 0.25)' : 'rgba(255, 193, 7, 0.25)'};">${escapeHtml(estado)}</span>`;
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('a[href="/logout.php"]').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            handleLogout();
        });
    });
});
