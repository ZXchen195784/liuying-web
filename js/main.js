// ===== API 配置 =====
const API_BASE = 'https://103.217.192.105:20022';

// ===== Token 管理 =====
function getToken() {
    return localStorage.getItem('ly_token');
}

function setToken(token) {
    localStorage.setItem('ly_token', token);
}

function removeToken() {
    localStorage.removeItem('ly_token');
    localStorage.removeItem('ly_user');
}

function getUser() {
    const raw = localStorage.getItem('ly_user');
    return raw ? JSON.parse(raw) : null;
}

function setUser(user) {
    localStorage.setItem('ly_user', JSON.stringify(user));
}

// ===== API 请求 =====
async function api(path, options = {}) {
    const url = API_BASE + path;
    const headers = { 'Content-Type': 'application/json', ...options.headers };

    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    try {
        const res = await fetch(url, {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        const data = await res.json();
        return data;
    } catch (err) {
        return { ok: false, error: 'network_error', error_description: '无法连接服务器，请检查网络' };
    }
}

// ===== 导航栏 =====
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const navAccount = document.getElementById('navAccount');

    // 滚动效果
    window.addEventListener('scroll', () => {
        if (window.scrollY > 20) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
    });

    // 移动端菜单
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });
    }

    // 更新登录状态
    async function updateAccountNav() {
        const token = getToken();
        if (!token) {
            if (navAccount) {
                navAccount.textContent = '登录';
                navAccount.href = 'account.html';
            }
            return;
        }

        const res = await api('/api/v1/me');
        if (res.ok) {
            if (navAccount) {
                navAccount.textContent = res.name;
                navAccount.href = 'account.html';
            }
        } else {
            removeToken();
            if (navAccount) {
                navAccount.textContent = '登录';
                navAccount.href = 'account.html';
            }
        }
    }
    updateAccountNav();
}

// ===== 页面初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
});
