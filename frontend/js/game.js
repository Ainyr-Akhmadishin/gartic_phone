const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room')?.trim();

if (!roomId || roomId === 'undefined') {
  alert('Ошибка: не указан ID комнаты.');
  window.location.href = 'profile.html';
}

// DOM-элементы
const lobbySection       = document.querySelector('#lobby-section');
const gameSection        = document.querySelector('#game-section');
const resultsSection     = document.querySelector('#results-section');
const roomCodeInput      = document.querySelector('#room-code-input');
const copyRoomBtn        = document.querySelector('#copy-room-btn');
const playersList        = document.querySelector('#players-list');
const startGameBtn       = document.querySelector('#start-game-btn');
const waitingText        = document.querySelector('#waiting-text');
const gamePhaseTitle     = document.querySelector('#game-phase-title');
const gameRoundDisplay   = document.querySelector('#game-round-display');
const statusMessage      = document.querySelector('#status-message');
const submitTaskBtn      = document.querySelector('#submit-task-btn');
const textTaskBlock      = document.querySelector('#text-task-block');
const gameInputLabel     = document.querySelector('#game-input-label');
const taskImage          = document.querySelector('#task-image');
const gameInput          = document.querySelector('#game-input');
const submittedTextDisplay = document.querySelector('#submitted-text-display');
const drawTaskBlock      = document.querySelector('#draw-task-block');
const drawInputLabel     = document.querySelector('#draw-input-label');
const drawingArea        = document.querySelector('#drawingArea');
const backToProfileBtn   = document.querySelector('#back-to-profile-btn');

let currentPhase = '';
let canvasInitialized = false;
let myUserId = null;
let ws = null;

roomCodeInput.value = roomId;

// Утилиты
async function loadCurrentUser() {
  const res = await fetch('/users/me', { credentials: 'include' });
  if (!res.ok) {
    alert('Вы не авторизованы.');
    window.location.href = 'index.html';
    throw new Error('Not authenticated');
  }
  const me = await res.json();
  myUserId = me.id;
}

copyRoomBtn.addEventListener('click', () => {
  roomCodeInput.select();
  document.execCommand('copy');
  copyRoomBtn.textContent = 'Скопировано';
  setTimeout(() => copyRoomBtn.textContent = 'Копировать', 2000);
});

function initCanvas() {
  if (canvasInitialized) return;
  if (typeof displayCanvas === 'function') {
    displayCanvas('#drawingArea');
    canvasInitialized = true;
  }
}

// WebSocket
function connectWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Подключаемся к тому же хосту, на котором открыт сайт
  const wsUrl = `${wsProtocol}//${window.location.host}/ws/${roomId}?user_id=${myUserId}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket подключен');
    fetchRoomData();
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'game_started') {
      lobbySection.hidden = true;
      gameSection.hidden = false;
    }

    if (data.type === 'task') {
      statusMessage.textContent = '';
      submitTaskBtn.disabled = false;
      submitTaskBtn.style.display = 'block';
      gameInput.style.display = 'block';
      submittedTextDisplay.hidden = true;
      taskImage.style.display = 'none';
      textTaskBlock.hidden = true;
      drawTaskBlock.hidden = true;

      currentPhase = data.phase;
      gameRoundDisplay.textContent = `Раунд: ${data.task?.round ?? ''}`;

      if (data.phase === 'writing') {
        gamePhaseTitle.textContent = 'Написание фразы';
        textTaskBlock.hidden = false;
        gameInputLabel.textContent = 'Придумайте и напишите фразу:';
        gameInput.value = '';
        gameInput.focus();
      } else if (data.phase === 'drawing') {
        gamePhaseTitle.textContent = 'Рисование';
        drawTaskBlock.hidden = false;
        drawInputLabel.textContent = `Нарисуйте: ${data.task?.text || 'то, что написано'}`;
        initCanvas();
        const canvas = drawingArea.querySelector('canvas');
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      } else if (data.phase === 'describing') {
        gamePhaseTitle.textContent = 'Описание рисунка';
        textTaskBlock.hidden = false;
        gameInputLabel.textContent = 'Опишите, что вы видите на картинке:';
        if (data.task?.data || data.task?.image) {
          taskImage.src = data.task.data || data.task.image;
          taskImage.style.display = 'block';
        }
        gameInput.value = '';
        gameInput.focus();
      }
    }

    if (data.type === 'game_finished') {
      gameSection.hidden = true;
      resultsSection.hidden = false;
      renderResults(data.history);
    }

    if (data.type === 'error') {
      alert(`Ошибка от сервера: ${data.text}`);
      submitTaskBtn.disabled = false;
      submitTaskBtn.style.display = 'block';
    }
  };

  submitTaskBtn.addEventListener('click', () => {
    let payload = {};
    if (currentPhase === 'writing' || currentPhase === 'describing') {
      const text = gameInput.value.trim();
      if (!text) return alert('Введите текст!');
      gameInput.style.display = 'none';
      submittedTextDisplay.textContent = text;
      submittedTextDisplay.hidden = false;
      submitTaskBtn.style.display = 'none';
      payload = { type: currentPhase === 'writing' ? 'phrase' : 'description', text: text };
    } else if (currentPhase === 'drawing') {
      const canvas = drawingArea.querySelector('canvas');
      if (!canvas) return alert('Холст не найден');
      payload = { type: 'drawing', data: canvas.toDataURL('image/png') };
      submitTaskBtn.style.display = 'none';
      drawTaskBlock.hidden = true;
    }
    ws.send(JSON.stringify(payload));
    statusMessage.textContent = 'Отправлено! Ждем остальных...';
  });
}

// Старт игры
startGameBtn.addEventListener('click', async () => {
  try {
    const response = await fetch(`/game/rooms/${roomId}/start`, { method: 'POST', credentials: 'include' });
    if (!response.ok) throw new Error('Ошибка старта (возможно, вы не создатель)');
  } catch (error) {
    alert(error.message);
  }
});

// Лобби
async function fetchRoomData() {
  try {
    const res = await fetch(`/game/rooms/${roomId}`, { credentials: 'include' });
    if (!res.ok) return;
    const room = await res.json();

    playersList.replaceChildren();
    (room.players || []).forEach(playerId => {
      const card = document.createElement('article');
      card.className = 'card';
      const title = document.createElement('h3');
      title.textContent = `Игрок: ${playerId.slice(0, 5)}...`;

      const list = document.createElement('ul');
      list.className = 'card-props';
      if (room.creator_id && String(room.creator_id) === String(playerId)) {
        list.innerHTML += `<li><strong style="color: var(--primary);">Создатель</strong></li>`;
      }

      card.append(title, list);
      playersList.append(card);
    });

    if (room.creator_id && String(room.creator_id) === String(myUserId)) {
      startGameBtn.style.display = 'inline-block';
      waitingText.style.display = 'none';
    } else {
      startGameBtn.style.display = 'none';
      waitingText.style.display = 'block';
    }
  } catch (e) { console.error(e); }
}

// Результаты
async function renderResults(history) {
  const container = document.querySelector('#results-container');
  container.replaceChildren();

  const pageTitle = document.createElement('h2');
  pageTitle.textContent = 'Сохраненные истории';
  pageTitle.style.textAlign = 'center';
  pageTitle.style.marginBottom = '30px';
  container.append(pageTitle);

  for (const [ownerId, chain] of Object.entries(history)) {
    const thread = document.createElement('div');
    thread.className = 'chat-thread';
    const threadTitle = document.createElement('h3');
    threadTitle.textContent = `История игрока`;
    threadTitle.style.cssText = 'font-size: 22px; color: var(--primary-dark); text-align: center; margin-bottom: 20px;';
    thread.append(threadTitle);
    container.append(thread);

    for (let i = 0; i < chain.length; i++) {
      const item = chain[i];
      const msgDiv = document.createElement('div');
      msgDiv.className = 'chat-message';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'chat-label';
      labelSpan.textContent = `Шаг ${i + 1}`;

      if (item.type === 'phrase' || item.type === 'description') {
        const textDiv = document.createElement('div');
        textDiv.className = 'chat-text';
        textDiv.textContent = item.text;
        msgDiv.append(labelSpan, textDiv);
      } else if (item.type === 'drawing' && item.data) {
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'chat-image-wrapper';
        const img = document.createElement('img');
        img.src = item.data;
        img.className = 'chat-image';
        imgWrapper.append(img);
        msgDiv.append(labelSpan, imgWrapper);
      }
      thread.append(msgDiv);
      setTimeout(() => msgDiv.classList.add('show'), 50);
    }
  }
}

backToProfileBtn.addEventListener('click', () => window.location.href = 'profile.html');

// Инициализация
(async function init() {
  try {
    await loadCurrentUser();
    connectWebSocket();
  } catch (e) {}
})();

setInterval(() => {
  if (lobbySection && !lobbySection.hidden) fetchRoomData();
}, 2000);