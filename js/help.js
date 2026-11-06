// ===== 帮助页 FAQ 折叠 =====

function toggleFaq(btn) {
    const item = btn.parentElement;
    item.classList.toggle('open');
}

// 平滑滚动
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.help-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const target = document.getElementById(targetId);
            if (target) {
                const offset = 80;
                const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
});
