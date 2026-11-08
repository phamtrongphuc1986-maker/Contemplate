'use strict';
/* =====================================================================
   CONTEMPLATE — frontend (thuần JS, không thư viện).
   ---------------------------------------------------------------------
   ⚙️  CẤU HÌNH ĐỊA CHỈ API — CHỈ CẦN SỬA 1 DÒNG NÀY:

   const API_BASE = '';

   - Để TRỐNG ('')  : frontend và API chạy cùng một nơi (máy chủ Node
     phục vụ luôn thư mục web/ — cách chạy thử ở máy local/VPS 1 cổng).
   - Khi đưa frontend lên GitHub Pages (vd https://contemplate.hialo.vn)
     còn API chạy trên VPS, hãy trỏ sang subdomain API của VPS, ví dụ:

       const API_BASE = 'https://api-contemplate.hialo.vn';

     (subdomain này do Caddy trên VPS chuyển tiếp về cổng 8096 —
     xem README.md ở thư mục gốc dự án).

   Frontend KHÔNG chứa bất kỳ khóa AI nào — khóa chỉ nằm ở máy chủ.
   ===================================================================== */
const API_BASE = 'https://api-contemplate.hialo.vn';

/* ------------------------------ Trạng thái ------------------------------ */
const $ = (id) => document.getElementById(id);
let token = localStorage.getItem('ct_token') || '';
let me = null;
let conversations = [];
let currentConvId = null;
let authMode = 'login'; // 'login' | 'register'
let sending = false;

/* ------------------------------- Giao diện ------------------------------ */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('ct_theme', t);
  $('themeBtn').textContent = t === 'dark' ? '☀️' : '🌙';
}
applyTheme(localStorage.getItem('ct_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('themeBtn').addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

/* --------------------------------- API ---------------------------------- */
async function api(path, opts) {
  const res = await fetch(API_BASE + path, {
    ...(opts || {}),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...((opts && opts.headers) || {}),
    },
  });
  let data = {};
  try { data = await res.json(); } catch { /* không có JSON */ }
  if (!res.ok) {
    const err = new Error(data.message || ('Lỗi ' + res.status));
    err.code = data.error || '';
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ------------------------------ Đăng nhập ------------------------------- */
function setAuthMode(mode) {
  authMode = mode;
  $('tabLogin').classList.toggle('active', mode === 'login');
  $('tabRegister').classList.toggle('active', mode === 'register');
  $('authSubmit').textContent = mode === 'login' ? 'Đăng nhập' : 'Đăng ký và vào ngay';
  $('authError').hidden = true;
}
$('tabLogin').addEventListener('click', () => setAuthMode('login'));
$('tabRegister').addEventListener('click', () => setAuthMode('register'));

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const identifier = $('identifier').value.trim();
  const password = $('password').value;
  const errBox = $('authError');
  errBox.hidden = true;
  $('authSubmit').disabled = true;
  try {
    const data = await api('/api/auth/' + (authMode === 'login' ? 'login' : 'register'), {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    token = data.token;
    localStorage.setItem('ct_token', token);
    await enterApp();
  } catch (err) {
    errBox.textContent = err.message;
    errBox.hidden = false;
  } finally {
    $('authSubmit').disabled = false;
  }
});

$('logoutBtn').addEventListener('click', () => {
  token = '';
  localStorage.removeItem('ct_token');
  currentConvId = null;
  conversations = [];
  $('appView').hidden = true;
  $('authView').hidden = false;
});

/* --------------------------- Danh sách hội thoại ------------------------- */
async function loadMe() {
  const data = await api('/api/me');
  me = data;
  $('userInfo').textContent = '👤 ' + data.user.identifier;
  $('quotaInfo').textContent = 'Hôm nay: ' + data.quota.usedToday + '/' + data.quota.dailyLimit + ' tin nhắn';
}

async function loadConversations() {
  const data = await api('/api/conversations');
  conversations = data.conversations;
  const list = $('convList');
  list.innerHTML = '';
  for (const c of conversations) {
    const item = document.createElement('div');
    item.className = 'conv-item' + (c.id === currentConvId ? ' active' : '');
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = c.title;
    t.title = c.title;
    const del = document.createElement('button');
    del.className = 'del';
    del.type = 'button';
    del.textContent = '🗑';
    del.title = 'Xoá cuộc trò chuyện';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Xoá cuộc trò chuyện này?')) return;
      await api('/api/conversations/' + c.id, { method: 'DELETE' });
      if (currentConvId === c.id) startNewChat();
      loadConversations();
    });
    item.append(t, del);
    item.addEventListener('click', () => openConversation(c.id));
    list.appendChild(item);
  }
}

function startNewChat() {
  currentConvId = null;
  $('messages').innerHTML = '';
  $('messages').appendChild(buildWelcome());
  document.querySelectorAll('.conv-item').forEach((el) => el.classList.remove('active'));
  closeSidebarMobile();
  $('input').focus();
}

function buildWelcome() {
  const w = document.createElement('div');
  w.className = 'welcome';
  w.innerHTML = '<div class="logo">🌀</div><h2>Xin chào! Mình là Contemplate.</h2>' +
    '<p>Hãy hỏi bất cứ điều gì — tra cứu, viết lách, tính toán, lên ý tưởng…</p>';
  const chips = document.createElement('div');
  chips.className = 'chips';
  for (const text of [
    'Viết giúp tôi một đoạn giới thiệu sản phẩm',
    'Giải thích đơn giản: lỗ đen là gì?',
    'Lên thực đơn 3 ngày ăn lành mạnh',
    'Dịch sang tiếng Anh: "Cảm ơn bạn rất nhiều"',
  ]) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', () => { $('input').value = text; $('composer').requestSubmit(); });
    chips.appendChild(b);
  }
  w.appendChild(chips);
  return w;
}

async function openConversation(id) {
  currentConvId = id;
  closeSidebarMobile();
  const data = await api('/api/conversations/' + id + '/messages');
  const box = $('messages');
  box.innerHTML = '';
  for (const m of data.messages) appendMessage(m.role, m.content, false);
  scrollToBottom();
  document.querySelectorAll('.conv-item').forEach((el) => el.classList.remove('active'));
  loadConversations();
}

/* ------------------------------- Tin nhắn -------------------------------- */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/* Định dạng nhẹ kiểu markdown: **đậm**, `code`, ```khối code```, xuống dòng. */
function formatText(s) {
  let out = escapeHtml(s);
  out = out.replace(/```([\s\S]*?)```/g, (m, code) => '<pre><code>' + code.trim() + '</code></pre>');
  out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.split(/\n{2,}/).map((p) => (p.startsWith('<pre>') ? p : '<p>' + p.replace(/\n/g, '<br>') + '</p>')).join('');
  return out;
}
function appendMessage(role, content, streaming) {
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + (role === 'user' ? 'user' : 'ai');
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? '🧑' : '🌀';
  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (streaming ? ' cursor-blink' : '');
  bubble.innerHTML = content ? formatText(content) : '<span class="thinking">Đang suy ngẫm…</span>';
  wrap.append(avatar, bubble);
  $('messages').appendChild(wrap);
  scrollToBottom();
  return bubble;
}
function scrollToBottom() {
  const box = $('messages');
  box.scrollTop = box.scrollHeight;
}

/* Gửi tin và nhận câu trả lời dạng streaming (SSE). */
async function sendMessage(text) {
  if (sending || !text.trim()) return;
  sending = true;
  $('sendBtn').disabled = true;
  const welcome = document.querySelector('.welcome');
  if (welcome) welcome.remove();
  appendMessage('user', text, false);
  const bubble = appendMessage('assistant', '', true);
  let full = '';
  try {
    const res = await fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ conversationId: currentConvId, message: text }),
    });
    if (!res.ok) {
      let data = {};
      try { data = await res.json(); } catch { /* bỏ qua */ }
      throw new Error(data.message || ('Lỗi ' + res.status));
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();
      for (const part of parts) {
        const line = part.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        const evt = JSON.parse(line.slice(5).trim());
        if (evt.type === 'start') {
          currentConvId = evt.conversationId;
        } else if (evt.type === 'delta') {
          full += evt.delta;
          bubble.innerHTML = formatText(full);
          scrollToBottom();
        } else if (evt.type === 'error') {
          throw new Error(evt.message || 'AI bị gián đoạn.');
        } else if (evt.type === 'done') {
          currentConvId = evt.conversationId || currentConvId;
        }
      }
    }
    bubble.classList.remove('cursor-blink');
    if (!full) bubble.innerHTML = '<span class="thinking">(AI không trả về nội dung)</span>';
    loadConversations();
    loadMe().catch(() => {});
  } catch (err) {
    bubble.classList.remove('cursor-blink');
    bubble.parentElement.classList.add('error');
    bubble.innerHTML = formatText('⚠️ ' + err.message);
  } finally {
    sending = false;
    $('sendBtn').disabled = false;
    $('input').focus();
  }
}

$('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('input').value.trim();
  if (!text) return;
  $('input').value = '';
  $('input').style.height = 'auto';
  sendMessage(text);
});
$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    $('composer').requestSubmit();
  }
});
$('input').addEventListener('input', () => {
  $('input').style.height = 'auto';
  $('input').style.height = Math.min(140, $('input').scrollHeight) + 'px';
});
$('newChatBtn').addEventListener('click', startNewChat);
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => { $('input').value = chip.textContent; $('composer').requestSubmit(); });
});

/* ------------------------------- Sidebar -------------------------------- */
function closeSidebarMobile() {
  $('sidebar').classList.remove('open');
  $('backdrop').hidden = true;
}
$('openSidebar').addEventListener('click', () => {
  $('sidebar').classList.add('open');
  $('backdrop').hidden = false;
});
$('closeSidebar').addEventListener('click', closeSidebarMobile);
$('backdrop').addEventListener('click', closeSidebarMobile);

/* -------------------------------- Khởi động ------------------------------ */
async function enterApp() {
  $('authView').hidden = true;
  $('appView').hidden = false;
  await loadMe();
  await loadConversations();
  startNewChat();
}
(async function boot() {
  if (token) {
    try {
      await enterApp();
      return;
    } catch {
      token = '';
      localStorage.removeItem('ct_token');
    }
  }
  $('authView').hidden = false;
})();
