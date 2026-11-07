// ===== 账号页交互逻辑 =====

// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (token) {
        const res = await api('/api/v1/me');
        if (res.ok) {
            showProfile(res);
        } else {
            removeToken();
        }
    }
});

// ===== 视图切换 =====
function showLogin() {
    document.getElementById('loginForm').style.display = '';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('resetForm').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = '';
    document.getElementById('resetForm').style.display = 'none';
}

function showReset() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('resetForm').style.display = '';
}

function showProfile(userData) {
    document.getElementById('authCard').style.display = 'none';
    document.getElementById('profileCard').style.display = '';
    document.getElementById('profileName').textContent = userData.name || userData.username || '用户';
    if (userData.createdAt) {
        document.getElementById('profileCreated').textContent = '注册时间：' + formatDate(userData.createdAt);
    }
    if (userData.lastLoginAt) {
        document.getElementById('profileLastLogin').textContent = '上次登录：' + formatDate(userData.lastLoginAt);
    }
    // 头像
    if (userData.avatarUrl) {
        const avEl = document.getElementById('profileAvatar');
        avEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = userData.avatarUrl;
        img.alt = 'avatar';
        avEl.appendChild(img);
    }
}

function showAuthCard() {
    document.getElementById('authCard').style.display = '';
    document.getElementById('profileCard').style.display = 'none';
}

// ===== 提示消息 =====
function showAlert(containerId, message, type = 'error') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="alert alert-' + type + '">' + escapeHtml(message) + '</div>';
    setTimeout(() => { el.innerHTML = ''; }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(s) {
    if (!s) return '-';
    try {
        const d = new Date(s);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    } catch { return s; }
}

// ===== 登录 =====
async function doLogin() {
    const btn = document.getElementById('loginBtn');
    const name = document.getElementById('loginName').value.trim();
    const pass = document.getElementById('loginPass').value;

    if (!name || !pass) {
        showAlert('loginAlert', '请填写用户名和密码');
        return;
    }

    btn.disabled = true;
    btn.textContent = '登录中...';

    const res = await api('/api/v1/login', {
        method: 'POST',
        body: { name: name, password: pass }
    });

    btn.disabled = false;
    btn.textContent = '登录';

    if (res.ok || res.token) {
        setToken(res.token);
        if (res.user) setUser(res.user);
        // 获取用户信息
        const me = await api('/api/v1/me');
        if (me.ok) {
            showProfile(me);
            // 更新导航栏
            const navAccount = document.getElementById('navAccount');
            if (navAccount) navAccount.textContent = me.name || name;
        } else {
            showAlert('loginAlert', '登录成功，但获取信息失败', 'success');
        }
    } else {
        const msg = res.error_description || res.error || '登录失败';
        showAlert('loginAlert', msg);
    }
}

// ===== 注册 =====
let codeCooldown = 0;

async function sendCode() {
    const email = document.getElementById('regEmail').value.trim();
    if (!email) {
        showAlert('registerAlert', '请先填写邮箱');
        return;
    }

    const btn = document.getElementById('sendCodeBtn');
    btn.disabled = true;

    const res = await api('/api/v1/email/send', {
        method: 'POST',
        body: { email: email, purpose: 'register' }
    });

    if (res.ok) {
        showAlert('registerAlert', '验证码已发送到邮箱', 'success');
        codeCooldown = 60;
        const timer = setInterval(() => {
            codeCooldown--;
            btn.textContent = codeCooldown + 's';
            if (codeCooldown <= 0) {
                clearInterval(timer);
                btn.textContent = '发送';
                btn.disabled = false;
            }
        }, 1000);
    } else {
        showAlert('registerAlert', res.error_description || res.error || '发送失败');
        btn.disabled = false;
    }
}

async function doRegister() {
    const btn = document.getElementById('registerBtn');
    const name = document.getElementById('regName').value.trim();
    const pass = document.getElementById('regPass').value;
    const email = document.getElementById('regEmail').value.trim();
    const code = document.getElementById('regCode').value.trim();
    const cardKey = document.getElementById('regCardKey').value.trim();

    if (!name || !pass || !email || !code) {
        showAlert('registerAlert', '请填写所有必填项');
        return;
    }

    if (name.length < 3 || name.length > 16) {
        showAlert('registerAlert', '用户名长度 3-16 位');
        return;
    }

    btn.disabled = true;
    btn.textContent = '注册中...';

    const body = { name: name, password: pass, email: email, code: code };
    if (cardKey) body.cardKey = cardKey;

    const res = await api('/api/v1/register', {
        method: 'POST',
        body: body
    });

    btn.disabled = false;
    btn.textContent = '注册';

    if (res.ok) {
        showAlert('registerAlert', '注册成功！请登录', 'success');
        setTimeout(() => {
            // 清空注册表单
            document.getElementById('regName').value = '';
            document.getElementById('regPass').value = '';
            document.getElementById('regEmail').value = '';
            document.getElementById('regCode').value = '';
            document.getElementById('regCardKey').value = '';
            // 自动填充登录用户名
            document.getElementById('loginName').value = name;
            showLogin();
        }, 1500);
    } else {
        showAlert('registerAlert', res.error_description || res.error || '注册失败');
    }
}

// ===== 重置密码 =====
let resetCooldown = 0;

async function sendResetCode() {
    const name = document.getElementById('resetName').value.trim();
    const email = document.getElementById('resetEmail').value.trim();

    if (!name || !email) {
        showAlert('resetAlert', '请填写用户名和邮箱');
        return;
    }

    const btn = document.getElementById('resetSendBtn');
    btn.disabled = true;

    const res = await api('/api/v1/email/send', {
        method: 'POST',
        body: { email: email, purpose: 'reset', name: name }
    });

    if (res.ok) {
        showAlert('resetAlert', '验证码已发送到邮箱', 'success');
        resetCooldown = 60;
        const timer = setInterval(() => {
            resetCooldown--;
            btn.textContent = resetCooldown + 's';
            if (resetCooldown <= 0) {
                clearInterval(timer);
                btn.textContent = '发送';
                btn.disabled = false;
            }
        }, 1000);
    } else {
        showAlert('resetAlert', res.error_description || res.error || '发送失败');
        btn.disabled = false;
    }
}

async function doReset() {
    const name = document.getElementById('resetName').value.trim();
    const email = document.getElementById('resetEmail').value.trim();
    const code = document.getElementById('resetCode').value.trim();
    const pass = document.getElementById('resetPass').value;

    if (!name || !email || !code || !pass) {
        showAlert('resetAlert', '请填写所有字段');
        return;
    }

    const res = await api('/api/v1/password/reset', {
        method: 'POST',
        body: { name: name, email: email, code: code, newPassword: pass }
    });

    if (res.ok) {
        showAlert('resetAlert', '密码重置成功！请登录', 'success');
        setTimeout(() => {
            document.getElementById('loginName').value = name;
            showLogin();
        }, 1500);
    } else {
        showAlert('resetAlert', res.error_description || res.error || '重置失败');
    }
}

// ===== 个人中心操作 =====
function showAvatarUpload() {
    const form = document.getElementById('avatarForm');
    form.style.display = form.style.display === 'none' ? '' : 'none';
    document.getElementById('passForm').style.display = 'none';
}

function showChangePass() {
    const form = document.getElementById('passForm');
    form.style.display = form.style.display === 'none' ? '' : 'none';
    document.getElementById('avatarForm').style.display = 'none';
}

async function uploadAvatar() {
    const fileInput = document.getElementById('avatarFile');
    const file = fileInput.files[0];

    if (!file) {
        alert('请选择图片');
        return;
    }

    if (file.size > 300 * 1024) {
        alert('图片不能超过 300KB');
        return;
    }

    // 读取为 base64
    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64 = e.target.result.split(',')[1]; // 去掉 data:image/xxx;base64, 前缀

        const res = await api('/api/v1/avatar', {
            method: 'POST',
            body: { avatar: base64, format: file.type.split('/')[1] || 'png' }
        });

        if (res.ok) {
            // 更新头像显示
            const avEl = document.getElementById('profileAvatar');
            avEl.innerHTML = '';
            const img = document.createElement('img');
            img.src = API_BASE + '/api/v1/avatar/' + (getUser() ? getUser().id : '');
            img.alt = 'avatar';
            avEl.appendChild(img);
            alert('头像上传成功');
        } else {
            alert(res.error_description || res.error || '上传失败');
        }
    };
    reader.readAsDataURL(file);
}

async function changePass() {
    const oldPass = document.getElementById('oldPass').value;
    const newPass = document.getElementById('newPass').value;

    if (!oldPass || !newPass) {
        alert('请填写旧密码和新密码');
        return;
    }

    if (newPass.length < 6) {
        alert('新密码至少 6 位');
        return;
    }

    const res = await api('/api/v1/password/change', {
        method: 'POST',
        body: { oldPassword: oldPass, newPassword: newPass }
    });


    if (res.ok) {
        alert('密码修改成功');
        document.getElementById('oldPass').value = '';
        document.getElementById('newPass').value = '';
        document.getElementById('passForm').style.display = 'none';
    } else {
        alert(res.error_description || res.error || '修改失败');
    }
}

function doLogout() {
    removeToken();
    showAuthCard();
    showLogin();
    const navAccount = document.getElementById('navAccount');
    if (navAccount) navAccount.textContent = '登录';
}
