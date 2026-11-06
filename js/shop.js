// ===== 卡密商店交互 =====

const CARD_TYPES = {
    monthly:   { name: '月度会员', price: 15,  days: 30,  type: 'monthly' },
    quarterly: { name: '季度会员', price: 40,  days: 90,  type: 'quarterly' },
    yearly:    { name: '年度会员', price: 128, days: 365, type: 'yearly' }
};

let currentBuyType = null;

// 页面加载时加载已购卡密
document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (token) {
        await loadMyKeys();
    }
});

async function loadMyKeys() {
    const res = await api('/api/v1/card/my');
    if (res.ok && res.cards && res.cards.length > 0) {
        const container = document.getElementById('shopHistory');
        const list = document.getElementById('shopHistoryList');
        container.style.display = '';

        list.innerHTML = res.cards.map(c => {
            const statusText = c.used ? '已使用' : '未使用';
            const statusClass = c.used ? 'used' : 'unused';
            const typeText = CARD_TYPES[c.type] ? CARD_TYPES[c.type].name : c.type;
            return '<div class="shop-history-item">' +
                '<div>' +
                    '<div class="shop-history-key">' + escapeHtml(c.key) + '</div>' +
                    '<div class="shop-history-type">' + escapeHtml(typeText) + ' &middot; ' + formatDate(c.createdAt) + '</div>' +
                '</div>' +
                '<span class="shop-history-status ' + statusClass + '">' + statusText + '</span>' +
            '</div>';
        }).join('');
    }
}

function buyCard(type) {
    const info = CARD_TYPES[type];
    if (!info) return;

    currentBuyType = type;

    // 重置弹窗状态
    document.getElementById('modalResult').style.display = 'none';
    document.getElementById('modalAlert').innerHTML = '';

    const token = getToken();
    if (!token) {
        document.getElementById('modalNeedLogin').style.display = '';
        document.getElementById('modalBuyForm').style.display = 'none';
    } else {
        document.getElementById('modalNeedLogin').style.display = 'none';
        document.getElementById('modalBuyForm').style.display = '';
        document.getElementById('modalType').textContent = info.name;
        document.getElementById('modalPrice').textContent = '\u00a5' + info.price;
    }

    document.getElementById('modalTitle').textContent = '购买' + info.name;
    document.getElementById('shopModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('shopModal').style.display = 'none';
    currentBuyType = null;
}

async function confirmBuy() {
    if (!currentBuyType) return;

    const info = CARD_TYPES[currentBuyType];
    const btn = document.getElementById('modalBuyBtn');
    const contact = document.getElementById('modalContact').value.trim();

    btn.disabled = true;
    btn.textContent = '处理中...';

    const res = await api('/api/v1/card/purchase', {
        method: 'POST',
        body: {
            type: info.type,
            contact: contact || undefined
        }
    });

    btn.disabled = false;
    btn.textContent = '确认购买';

    if (res.ok && res.cardKey) {
        // 显示卡密
        document.getElementById('modalBuyForm').style.display = 'none';
        document.getElementById('modalResult').style.display = '';
        document.getElementById('shopKeyBox').textContent = res.cardKey;

        // 刷新卡密列表
        await loadMyKeys();
    } else {
        const msg = res.error_description || res.error || '购买失败';
        const alertEl = document.getElementById('modalAlert');
        alertEl.innerHTML = '<div class="alert alert-error">' + escapeHtml(msg) + '</div>';
    }
}

function copyKey() {
    const key = document.getElementById('shopKeyBox').textContent;
    if (!key || key === '-') return;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(key).then(() => {
            alert('已复制到剪贴板');
        }).catch(() => {
            fallbackCopy(key);
        });
    } else {
        fallbackCopy(key);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        alert('已复制到剪贴板');
    } catch {
        alert('复制失败，请手动选中复制');
    }
    document.body.removeChild(ta);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML;
}

function formatDate(s) {
    if (!s) return '-';
    try {
        const d = new Date(s);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    } catch { return s; }
}

// 点击遮罩关闭弹窗
document.addEventListener('click', (e) => {
    if (e.target.id === 'shopModal') closeModal();
});
