// ============================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================
let token = localStorage.getItem('access_token');
let currentUser = null;
let roomId = null;
let ws = null;

// ============================================
// DOM-ЭЛЕМЕНТЫ
// ============================================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let lastX = 0, lastY = 0;

ctx.strokeStyle = '#000';
ctx.lineWidth = 3;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// ============================================
// АВТОРИЗАЦИЯ
// ============================================
async function register() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username').value;

    try {
        const res = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, username })
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('auth-status').textContent = '✅ Регистрация успешна! Теперь войдите.';
        } else {
            document.getElementById('auth-status').textContent = '❌ ' + (data.detail || 'Ошибка регистрации');
        }
    } catch (e) {
        document.getElementById('auth-status').textContent = '❌ Ошибка регистрации: ' + e.message;
    }
}

async function login() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    try {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const res = await fetch('/auth/jwt/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData,
            credentials: 'include'  // ← ВАЖНО!
        });

        if (res.ok) {
            await fetchUser();
        } else {
            const err = await res.json();
            document.getElementById('auth-status').textContent = '❌ ' + (err.detail || 'Неверный email или пароль');
        }
    } catch (e) {
        document.getElementById('auth-status').textContent = '❌ Ошибка: ' + e.message;
    }
}

async function fetchUser() {
    try {
        const res = await fetch('/users/me', {
            credentials: 'include'  // ← ВАЖНО!
        });
        if (res.ok) {
            currentUser = await res.json();
            document.getElementById('user-name').textContent = currentUser.username || currentUser.email;
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('lobby').style.display = 'block';
            document.getElementById('auth-status').textContent = '✅ Вы вошли как ' + (currentUser.username || currentUser.email);
        } else {
            document.getElementById('auth-status').textContent = '❌ Не авторизован';
        }
    } catch (e) {
        document.getElementById('auth-status').textContent = '❌ Ошибка: ' + e.message;
    }
}

// Проверка авторизации при загрузке
if (token) {
    fetchUser();
}

// ============================================
// КОМНАТЫ
// ============================================
async function createRoom() {
    try {
        const res = await fetch('/game/rooms', {
            method: 'POST',
            credentials: 'include'  // ← ВАЖНО!
        });
        const data = await res.json();
        roomId = data.room_id;
        document.getElementById('room-id-input').value = roomId;
        document.getElementById('room-info').innerHTML = `✅ Комната создана: ${roomId}`;
        joinRoom();
    } catch (e) {
        document.getElementById('room-info').textContent = '❌ Ошибка: ' + e.message;
    }
}

async function joinRoom() {
    const id = document.getElementById('room-id-input').value.trim();
    if (!id) { alert('Введите ID комнаты'); return; }
    roomId = id;

    try {
        const res = await fetch(`/game/${roomId}/join`, {  // ← убрал /rooms/
            method: 'POST',
            credentials: 'include'
        });

        if (res.ok) {
            const data = await res.json();
            document.getElementById('room-info').innerHTML = `✅ Присоединились к комнате ${roomId}`;
            connectWS();
        } else {
            document.getElementById('room-info').textContent = '❌ Не удалось присоединиться';
        }
    } catch (e) {
        document.getElementById('room-info').textContent = '❌ Ошибка: ' + e.message;
    }
}

async function startGame() {
    if (!roomId) return;
    try {
        const res = await fetch(`/game/rooms/${roomId}/start`, {
            method: 'POST',
            credentials: 'include'  // ← ВАЖНО!
        });
        if (res.ok) {
            const data = await res.json();
            document.getElementById('game-status').textContent = '🎮 Игра началась!';
        } else {
            const err = await res.json();
            document.getElementById('game-status').textContent = '❌ ' + (err.detail || 'Ошибка старта');
        }
    } catch (e) {
        document.getElementById('game-status').textContent = '❌ Ошибка: ' + e.message;
    }
}

// ============================================
// WEBSOCKET
// ============================================
function connectWS() {
    if (!roomId || !currentUser) return;

    const wsUrl = `ws://${window.location.host}/ws/${roomId}?user_id=${currentUser.id}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        document.getElementById('game-status').textContent = '🔗 WebSocket подключён';
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
        document.getElementById('game-room-id').textContent = roomId;
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWSMessage(data);
        } catch (e) {
            console.log('Получено:', event.data);
        }
    };

    ws.onclose = () => {
        document.getElementById('game-status').textContent = '❌ WebSocket отключён';
    };

    ws.onerror = (error) => {
        document.getElementById('game-status').textContent = '⚠️ Ошибка WebSocket';
    };
}

function handleWSMessage(data) {
    console.log('WS:', data);

    if (data.type === 'draw') {
        drawDot(data.x, data.y);
    }

    if (data.type === 'chat' || data.type === 'phrase') {
        const msgDiv = document.getElementById('game-messages');
        msgDiv.innerHTML += `<div><b>${data.username || 'Игрок'}:</b> ${data.text || JSON.stringify(data)}</div>`;
        msgDiv.scrollTop = msgDiv.scrollHeight;
    }

    if (data.type === 'game_started') {
        document.getElementById('game-status').textContent = '🎮 Игра началась!';
    }

    if (data.type === 'players') {
        document.getElementById('game-players').textContent = data.players.join(', ');
    }
}

// ============================================
// ОТПРАВКА СООБЩЕНИЙ
// ============================================
function sendPhrase() {
    const input = document.getElementById('phrase-input');
    const text = input.value.trim();
    if (!text || !ws) return;

    ws.send(JSON.stringify({
        type: 'phrase',
        text: text
    }));

    const msgDiv = document.getElementById('game-messages');
    msgDiv.innerHTML += `<div><b>Вы:</b> ${text}</div>`;
    msgDiv.scrollTop = msgDiv.scrollHeight;
    input.value = '';
}

// ============================================
// КАНВАС (Рисование)
// ============================================
canvas.addEventListener('mousedown', (e) => {
    if (!ws) return;
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    lastX = (e.clientX - rect.left) * scaleX;
    lastY = (e.clientY - rect.top) * scaleY;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || !ws) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    ctx.lineTo(x, y);
    ctx.stroke();
    ws.send(JSON.stringify({ type: 'draw', x, y }));
});

canvas.addEventListener('mouseup', () => { isDrawing = false; });
canvas.addEventListener('mouseleave', () => { isDrawing = false; });

function drawDot(x, y, color = '#000') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
}