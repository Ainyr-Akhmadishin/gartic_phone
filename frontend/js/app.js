// ============================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================
let token = localStorage.getItem('access_token');
let currentUser = null;
let roomId = null;
let ws = null;
let currentPhase = null;

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
// ЛОГГЕР
// ============================================
function log(msg, type = 'info') {
    const colors = {
        info: '#89b4fa',
        success: '#a6e3a1',
        error: '#f38ba8',
        warning: '#f9e2af',
        ws: '#cba6f7',
        auth: '#94e2d5',
        room: '#fab387'
    };
    console.log(`%c[${type.toUpperCase()}] ${msg}`, `color: ${colors[type] || '#cdd6f4'}; font-weight: bold;`);
    const logDiv = document.getElementById('game-messages');
    if (logDiv) {
        const entry = document.createElement('div');
        entry.innerHTML = `<span style="color: ${colors[type] || '#cdd6f4'};">[${type.toUpperCase()}]</span> ${msg}`;
        logDiv.appendChild(entry);
        logDiv.scrollTop = logDiv.scrollHeight;
    }
}

// ============================================
// УПРАВЛЕНИЕ UI (БЛОКИРОВКА КНОПОК)
// ============================================
function updateUI(phase) {
    console.log('🔁 updateUI вызван с фазой:', phase);
    currentPhase = phase;

    const phraseBtn = document.querySelector('.phrase-btn');
    const drawingBtn = document.querySelector('.drawing-btn');
    const descBtn = document.querySelector('.desc-btn');
    const readyBtn = document.querySelector('.ready-btn');
    const phraseInput = document.getElementById('phrase-input');
    const drawingInput = document.getElementById('drawing-input');
    const descInput = document.getElementById('desc-input');

    // Блокируем/разблокируем кнопки и поля ввода
    if (phraseBtn) phraseBtn.disabled = phase !== 'writing';
    if (drawingBtn) drawingBtn.disabled = phase !== 'drawing';
    if (descBtn) descBtn.disabled = phase !== 'describing';
    if (readyBtn) readyBtn.disabled = phase === 'finished' || phase === 'waiting';

    if (phraseInput) phraseInput.disabled = phase !== 'writing';
    if (drawingInput) drawingInput.disabled = phase !== 'drawing';
    if (descInput) descInput.disabled = phase !== 'describing';

    // Обновляем отображение фазы
    const phaseDisplay = document.getElementById('current-phase');
    if (phaseDisplay) {
        const phaseNames = {
            'waiting': '⏳ Ожидание',
            'writing': '✍️ Написание фраз',
            'drawing': '🎨 Рисование',
            'describing': '📄 Описание',
            'finished': '🏁 Завершено'
        };
        phaseDisplay.textContent = phaseNames[phase] || phase;
    }
}

// ============================================
// АВТОРИЗАЦИЯ
// ============================================
async function register() {
    log('🔄 Регистрация...', 'auth');
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
            log(`✅ Регистрация успешна для ${email}`, 'success');
            document.getElementById('auth-status').textContent = '✅ Регистрация успешна! Теперь войдите.';
        } else {
            log(`❌ Ошибка регистрации: ${data.detail || 'Неизвестная ошибка'}`, 'error');
            document.getElementById('auth-status').textContent = '❌ ' + (data.detail || 'Ошибка регистрации');
        }
    } catch (e) {
        log(`❌ Ошибка регистрации: ${e.message}`, 'error');
        document.getElementById('auth-status').textContent = '❌ Ошибка регистрации: ' + e.message;
    }
}

async function login() {
    log('🔄 Вход в систему...', 'auth');
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
            credentials: 'include'
        });

        if (res.ok) {
            log(`✅ Вход выполнен для ${email}`, 'success');
            await fetchUser();
        } else {
            const err = await res.json();
            log(`❌ Ошибка входа: ${err.detail || 'Неверный email или пароль'}`, 'error');
            document.getElementById('auth-status').textContent = '❌ ' + (err.detail || 'Неверный email или пароль');
        }
    } catch (e) {
        log(`❌ Ошибка входа: ${e.message}`, 'error');
        document.getElementById('auth-status').textContent = '❌ Ошибка: ' + e.message;
    }
}

async function fetchUser() {
    log('🔄 Получение данных пользователя...', 'auth');
    try {
        const res = await fetch('/users/me', {
            credentials: 'include'
        });
        if (res.ok) {
            currentUser = await res.json();
            log(`✅ Пользователь: ${currentUser.username || currentUser.email} (ID: ${currentUser.id})`, 'success');
            document.getElementById('user-name').textContent = currentUser.username || currentUser.email;
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('lobby').style.display = 'block';
            document.getElementById('auth-status').textContent = '✅ Вы вошли как ' + (currentUser.username || currentUser.email);
        } else {
            log('❌ Не авторизован', 'error');
            document.getElementById('auth-status').textContent = '❌ Не авторизован';
        }
    } catch (e) {
        log(`❌ Ошибка: ${e.message}`, 'error');
        document.getElementById('auth-status').textContent = '❌ Ошибка: ' + e.message;
    }
}

// Проверка авторизации при загрузке
if (token) {
    log('🔑 Токен найден, проверяем авторизацию...', 'auth');
    fetchUser();
} else {
    log('🔑 Токен не найден, требуется вход', 'auth');
}

// ============================================
// КОМНАТЫ
// ============================================
async function createRoom() {
    log('🔄 Создание комнаты...', 'room');
    try {
        const res = await fetch('/game/rooms', {
            method: 'POST',
            credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            roomId = data.room_id;
            log(`✅ Комната создана: ${roomId}`, 'success');
            document.getElementById('room-id-input').value = roomId;
            document.getElementById('room-info').innerHTML = `✅ Комната создана: ${roomId}`;
            await joinRoom();
        } else {
            log(`❌ Ошибка создания комнаты: ${data.detail || 'Неизвестная ошибка'}`, 'error');
        }
    } catch (e) {
        log(`❌ Ошибка: ${e.message}`, 'error');
        document.getElementById('room-info').textContent = '❌ Ошибка: ' + e.message;
    }
}

async function joinRoom() {
    const id = document.getElementById('room-id-input').value.trim();
    if (!id) {
        log('⚠️ Введите ID комнаты', 'warning');
        alert('Введите ID комнаты');
        return;
    }
    roomId = id;
    log(`🔄 Присоединение к комнате ${roomId}...`, 'room');

    try {
        const res = await fetch(`/game/rooms/${roomId}/join`, {
            method: 'POST',
            credentials: 'include'
        });

        if (res.ok) {
            const data = await res.json();
            log(`✅ Присоединились к комнате ${roomId}`, 'success');
            document.getElementById('room-info').innerHTML = `✅ Присоединились к комнате ${roomId}`;
            connectWS();
        } else {
            const err = await res.json();
            log(`❌ Ошибка присоединения: ${err.detail || 'Неизвестная ошибка'}`, 'error');
            document.getElementById('room-info').textContent = '❌ Не удалось присоединиться';
        }
    } catch (e) {
        log(`❌ Ошибка: ${e.message}`, 'error');
        document.getElementById('room-info').textContent = '❌ Ошибка: ' + e.message;
    }
}

async function startGame() {
    if (!roomId) {
        log('⚠️ Нет ID комнаты', 'warning');
        return;
    }
    log(`🔄 Запуск игры в комнате ${roomId}...`, 'room');
    try {
        const res = await fetch(`/game/rooms/${roomId}/start`, {
            method: 'POST',
            credentials: 'include'
        });
        if (res.ok) {
            const data = await res.json();
            log(`✅ Игра запущена!`, 'success');
            document.getElementById('game-status').textContent = '🎮 Игра началась!';
            updateUI('writing');
        } else {
            const err = await res.json();
            log(`❌ Ошибка старта: ${err.detail || 'Неизвестная ошибка'}`, 'error');
            document.getElementById('game-status').textContent = '❌ ' + (err.detail || 'Ошибка старта');
        }
    } catch (e) {
        log(`❌ Ошибка: ${e.message}`, 'error');
        document.getElementById('game-status').textContent = '❌ Ошибка: ' + e.message;
    }
}

// ============================================
// WEBSOCKET
// ============================================
function connectWS() {
    if (!roomId || !currentUser) {
        log('⚠️ Нет roomId или currentUser', 'warning');
        return;
    }

    const wsUrl = `ws://${window.location.host}/ws/${roomId}?user_id=${currentUser.id}`;
    log(`🔗 Подключение к WebSocket: ${wsUrl}`, 'ws');
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        log('✅ WebSocket подключён', 'success');
        document.getElementById('game-status').textContent = '🔗 WebSocket подключён';
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
        document.getElementById('game-room-id').textContent = roomId;
        updateUI('waiting');
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWSMessage(data);
        } catch (e) {
            log(`⚠️ Получено невалидное сообщение: ${event.data}`, 'warning');
        }
    };

    ws.onclose = () => {
        log('❌ WebSocket отключён', 'error');
        document.getElementById('game-status').textContent = '❌ WebSocket отключён';
    };

    ws.onerror = (error) => {
        log(`⚠️ Ошибка WebSocket: ${error}`, 'error');
        document.getElementById('game-status').textContent = '⚠️ Ошибка WebSocket';
    };
}

// ============================================
// ОБРАБОТКА WEBSOCKET СООБЩЕНИЙ
// ============================================
function handleWSMessage(data) {
    log(`📨 Получено сообщение: ${data.type || 'unknown'}`, 'ws');

    // ============================================
    // СТАРТ ИГРЫ
    // ============================================
    if (data.type === 'game_started') {
        log('🎮 Игра началась!', 'success');
        document.getElementById('game-status').textContent = '🎮 Игра началась!';
        updateUI(data.phase || 'writing');
        if (data.players) {
            document.getElementById('game-players').textContent = data.players.join(', ');
        }
        return;
    }

    // ============================================
    // ОШИБКА
    // ============================================
    if (data.type === 'error') {
        log(`❌ Ошибка: ${data.text}`, 'error');
        addMessage('Ошибка', data.text);
        return;
    }

    // ============================================
    // ЗАДАНИЕ
    // ============================================
    if (data.type === 'task') {
        log(`📌 Задание получено: ${JSON.stringify(data.task)}`, 'info');
        document.getElementById('task-text').textContent = JSON.stringify(data.task, null, 2);
        document.getElementById('game-status').textContent = `📌 Фаза: ${data.phase || '—'}`;
        updateUI(data.phase);
        addMessage('Задание', data.task);
        return;
    }

    // ============================================
    // РИСОВАНИЕ ОТ ДРУГОГО ИГРОКА
    // ============================================
    if (data.type === 'draw') {
        log(`🖍 Рисование: (${data.x}, ${data.y})`, 'info');
        drawDot(data.x, data.y);
        return;
    }

    // ============================================
    // ЧАТ / ФРАЗА
    // ============================================
    if (data.type === 'chat' || data.type === 'phrase') {
        log(`💬 Сообщение от ${data.username || 'Игрок'}: ${data.text || JSON.stringify(data)}`, 'info');
        const msgDiv = document.getElementById('game-messages');
        msgDiv.innerHTML += `<div><b>${data.username || 'Игрок'}:</b> ${data.text || JSON.stringify(data)}</div>`;
        msgDiv.scrollTop = msgDiv.scrollHeight;
        return;
    }

    // ============================================
    // ИГРОКИ
    // ============================================
    if (data.type === 'players') {
        log(`👥 Список игроков: ${data.players.join(', ')}`, 'info');
        document.getElementById('game-players').textContent = data.players.join(', ');
        return;
    }

    // ============================================
    // ФИНАЛ ИГРЫ
    // ============================================
    if (data.type === 'game_over' || data.type === 'game_finished') {
        log('🏁 Игра завершена!', 'success');
        document.getElementById('task-text').textContent = '🎉 Игра завершена!';
        document.getElementById('game-status').textContent = '🏁 Игра завершена';
        updateUI('finished');
        addMessage('Финал', data);
        return;
    }

    // ============================================
    // НЕИЗВЕСТНЫЙ ТИП
    // ============================================
    log(`📨 Неизвестный тип: ${data.type}`, 'warning');
    addMessage('Сервер', data);
}

// ============================================
// ОТПРАВКА СООБЩЕНИЙ
// ============================================
function sendPhrase() {
    const input = document.getElementById('phrase-input');
    const text = input.value.trim();
    if (!text) {
        log('⚠️ Введите фразу', 'warning');
        return;
    }
    if (!ws) {
        log('⚠️ WebSocket не подключён', 'warning');
        return;
    }
    if (currentPhase !== 'writing') {
        log(`⚠️ Сейчас нельзя отправлять фразу (фаза: ${currentPhase})`, 'warning');
        return;
    }

    log(`📤 Отправка фразы: ${text}`, 'ws');
    ws.send(JSON.stringify({ type: 'phrase', text: text }));
    addMessage('Вы', `Фраза: ${text}`);
    input.value = '';
}

function sendDrawing() {
    const input = document.getElementById('drawing-input');
    const data = input.value.trim();
    if (!data) {
        log('⚠️ Введите данные рисунка (base64)', 'warning');
        return;
    }
    if (!ws) {
        log('⚠️ WebSocket не подключён', 'warning');
        return;
    }
    if (currentPhase !== 'drawing') {
        log(`⚠️ Сейчас нельзя отправлять рисунок (фаза: ${currentPhase})`, 'warning');
        return;
    }

    log('📤 Отправка рисунка', 'ws');
    ws.send(JSON.stringify({ type: 'drawing', data: data }));
    addMessage('Вы', '📷 Рисунок отправлен');
    input.value = '';
}

function sendDescription() {
    const input = document.getElementById('desc-input');
    const text = input.value.trim();
    if (!text) {
        log('⚠️ Введите описание', 'warning');
        return;
    }
    if (!ws) {
        log('⚠️ WebSocket не подключён', 'warning');
        return;
    }
    if (currentPhase !== 'describing') {
        log(`⚠️ Сейчас нельзя отправлять описание (фаза: ${currentPhase})`, 'warning');
        return;
    }

    log(`📤 Отправка описания: ${text}`, 'ws');
    ws.send(JSON.stringify({ type: 'description', text: text }));
    addMessage('Вы', `Описание: ${text}`);
    input.value = '';
}

function sendReady() {
    if (!ws) {
        log('⚠️ WebSocket не подключён', 'warning');
        return;
    }
    if (currentPhase === 'finished' || currentPhase === 'waiting') {
        log(`⚠️ Сейчас нельзя отмечать готовность (фаза: ${currentPhase})`, 'warning');
        return;
    }
    log('📤 Отправка готовности', 'ws');
    ws.send(JSON.stringify({ type: 'ready' }));
    addMessage('Вы', '✅ Готов');
}

function addMessage(from, content) {
    const msgDiv = document.getElementById('game-messages');
    if (!msgDiv) return;
    const div = document.createElement('div');
    const text = typeof content === 'object' ? JSON.stringify(content) : content;
    div.innerHTML = `<b>${from}:</b> ${text}`;
    msgDiv.appendChild(div);
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

// ============================================
// КАНВАС (Рисование)
// ============================================
canvas.addEventListener('mousedown', (e) => {
    if (!ws) {
        log('⚠️ WebSocket не подключён, рисование недоступно', 'warning');
        return;
    }
    if (currentPhase !== 'drawing') {
        log('⚠️ Сейчас нельзя рисовать (фаза: ' + currentPhase + ')', 'warning');
        return;
    }
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