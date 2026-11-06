// ===== 卡密商店交互（对接易支付） =====

const CARD_TYPES = {
    monthly:   { name: '月度会员', price: 15,  days: 30,  type: 'monthly' },
    quarterly: { name: '季度会员', price: 40,  days: 90,  type: 'quarterly' },
    yearly:    { name: '年度会员', price: 128, days: 365, type: 'yearly' }
};

let currentBuyType = null;
let currentOrderNo = null;
let pollTimer = null;

// 页面加载时加载已购卡密和订单
document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (token) {
        await loadMyOrders();
    }

    // 检查 URL 参数（支付完成跳转回来）
    const urlParams = new URLSearchParams(window.location.search);
    const orderNo = urlParams.get('order');
    if (orderNo) {
        // 清除 URL 参数
        history.replaceState(null, '', window.location.pathname);
        // 查询订单状态
        checkOrderResult(orderNo);
    }
});

// 加载我的订单列表（已支付的在订单里直接显示卡密）
async function loadMyOrders() {
    const res = await api('/api/v1/order/my');
    const container = document.getElementById('shopHistory');
    const list = document.getElementById('shopHistoryList');

    if (!res.ok || !res.orders || res.orders.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = '';
    list.innerHTML = res.orders.map(o => {
        const statusText = o.status === 1 ? '已支付' : (o.status === 2 ? '已退款' : '待支付');
        const statusClass = o.status === 1 ? 'unused' : (o.status === 2 ? 'used' : 'used');
        let keyHtml = '';
        if (o.status >= 1 && o.cardKey) {
            keyHtml = '<div class="shop-history-key">' + escapeHtml(o.cardKey) + '</div>';
        } else if (o.status === 0) {
            keyHtml = '<div class="shop-history-key" style="color:var(--text-muted)">支付完成后显示卡密</div>';
        }
        return '<div class="shop-history-item">' +
            '<div>' +
                keyHtml +
                '<div class="shop-history-type">' + escapeHtml(o.cardName) +
                ' &middot; ¥' + o.money +
                ' &middot; ' + formatDate(o.createdAt) +
                (o.status === 0 ? ' &middot; <a href="#" onclick="retryPay(\'' + o.orderNo + '\');return false;" style="color:var(--accent)">去支付</a>' : '') +
                '</div>' +
            '</div>' +
            '<span class="shop-history-status ' + statusClass + '">' + statusText + '</span>' +
        '</div>';
    }).join('');
}

function buyCard(type) {
    const info = CARD_TYPES[type];
    if (!info) return;

    currentBuyType = type;

    // 重置弹窗状态
    document.getElementById('modalResult').style.display = 'none';
    document.getElementById('modalAlert').innerHTML = '';
    document.getElementById('modalPayLoading').style.display = 'none';

    const token = getToken();
    if (!token) {
        document.getElementById('modalNeedLogin').style.display = '';
        document.getElementById('modalBuyForm').style.display = 'none';
    } else {
        document.getElementById('modalNeedLogin').style.display = 'none';
        document.getElementById('modalBuyForm').style.display = '';
        document.getElementById('modalType').textContent = info.name;
        document.getElementById('modalPrice').textContent = '¥' + info.price;
    }

    document.getElementById('modalTitle').textContent = '购买' + info.name;
    document.getElementById('shopModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('shopModal').style.display = 'none';
    currentBuyType = null;
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

// 确认购买 → 创建订单 → 跳转支付
async function confirmBuy() {
    if (!currentBuyType) return;

    const info = CARD_TYPES[currentBuyType];
    const btn = document.getElementById('modalBuyBtn');
    const contact = document.getElementById('modalContact').value.trim();

    btn.disabled = true;
    btn.textContent = '正在创建订单...';

    const res = await api('/api/v1/order/create', {
        method: 'POST',
        body: {
            type: info.type,
            contact: contact || undefined
        }
    });

    btn.disabled = false;
    btn.textContent = '确认购买';

    if (res.ok && res.payUrl) {
        currentOrderNo = res.orderNo;

        // 关闭弹窗，跳转到支付页面
        closeModal();

        // 新窗口打开支付页面
        window.open(res.payUrl, '_blank');

        // 开始轮询订单状态
        startPolling(res.orderNo);
    } else if (res.ok && res.qrcode) {
        // 二维码支付
        currentOrderNo = res.orderNo;
        document.getElementById('modalBuyForm').style.display = 'none';
        document.getElementById('modalPayLoading').style.display = '';
        document.getElementById('modalQrcode').src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(res.qrcode);
        startPolling(res.orderNo);
    } else {
        const msg = res.error_description || res.error || '创建订单失败';
        const alertEl = document.getElementById('modalAlert');
        alertEl.innerHTML = '<div class="alert alert-error">' + escapeHtml(msg) + '</div>';
    }
}

// 轮询订单状态
function startPolling(orderNo) {
    if (pollTimer) clearInterval(pollTimer);

    // 显示等待弹窗
    document.getElementById('modalBuyForm').style.display = 'none';
    document.getElementById('modalResult').style.display = 'none';
    document.getElementById('modalPayLoading').style.display = '';
    document.getElementById('shopModal').style.display = 'flex';

    let count = 0;
    pollTimer = setInterval(async () => {
        count++;
        if (count > 120) { // 最多轮询 2 分钟
            clearInterval(pollTimer);
            pollTimer = null;
            document.getElementById('modalPayLoading').style.display = 'none';
            document.getElementById('modalBuyForm').style.display = '';
            document.getElementById('modalAlert').innerHTML =
                '<div class="alert alert-error">支付超时，请在"我的卡密"中查看订单状态</div>';
            return;
        }

        const res = await api('/api/v1/order/query?orderNo=' + orderNo);
        if (res.ok && res.status === 1) {
            // 支付成功！
            clearInterval(pollTimer);
            pollTimer = null;

            // 显示卡密
            document.getElementById('modalPayLoading').style.display = 'none';
            document.getElementById('modalResult').style.display = '';
            document.getElementById('shopKeyBox').textContent = res.cardKey || '-';

            // 刷新订单列表
            loadMyOrders();
        }
    }, 2000); // 每 2 秒查一次
}

// 检查支付完成跳转回来的订单
async function checkOrderResult(orderNo) {
    const res = await api('/api/v1/order/query?orderNo=' + orderNo);
    if (res.ok) {
        if (res.status === 1) {
            // 已支付，显示卡密
            currentOrderNo = orderNo;
            document.getElementById('modalBuyForm').style.display = 'none';
            document.getElementById('modalPayLoading').style.display = 'none';
            document.getElementById('modalResult').style.display = '';
            document.getElementById('shopKeyBox').textContent = res.cardKey || '-';
            document.getElementById('modalTitle').textContent = '购买成功';
            document.getElementById('shopModal').style.display = 'flex';
            loadMyOrders();
        } else {
            // 还没支付，开始轮询
            currentOrderNo = orderNo;
            startPolling(orderNo);
        }
    }
}

// 重新支付
async function retryPay(orderNo) {
    window.open(API_BASE + '/api/v1/order/pay?orderNo=' + orderNo, '_blank');
    currentOrderNo = orderNo;
    startPolling(orderNo);
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
