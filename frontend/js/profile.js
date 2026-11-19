const myProfileCard = document.querySelector('#my-profile-card');
const allPlayersList = document.querySelector('#all-players-list');
const editForm = document.querySelector('#edit-form');
const editNameInput = document.querySelector('#edit-name');
const editPassInput = document.querySelector('#edit-password');
const searchInput = document.querySelector('#search-players');
const createRoomBtn = document.querySelector('#create-room-btn');
const joinRoomBtn = document.querySelector('#join-room-btn');
const logoutBtn = document.querySelector('#logout-btn');

let myPlayerData = null;

// Проверка авторизации при загрузке
async function loadCurrentUser() {
  try {
    const res = await fetch('/users/me', { credentials: 'include' });
    if (!res.ok) throw new Error('Не авторизован');
    return await res.json();
  } catch (error) {
    // Если куки нет или она истекла, кидает на вход
    window.location.href = 'index.html';
    throw error;
  }
}

async function loadMyProfile() {
  myPlayerData = await loadCurrentUser();
  myProfileCard.replaceChildren();

  const title = document.createElement('h3');
  title.textContent = myPlayerData.username || myPlayerData.email;

  const list = document.createElement('ul');
  list.className = 'card-props';

  const idLi = document.createElement('li');
  idLi.textContent = `ID: ${myPlayerData.id}`;
  list.append(idLi);

  if (myPlayerData.wins !== undefined) {
    const winsLi = document.createElement('li');
    winsLi.textContent = `Побед: ${myPlayerData.wins}`;
    list.append(winsLi);
  }

  myProfileCard.append(title, list);
  editNameInput.value = myPlayerData.username || '';
}

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!myPlayerData) return;

  const newName = editNameInput.value.trim();
  const newPass = editPassInput.value;
  const updateData = {};
  
  if (newName) updateData.username = newName;
  if (newPass) updateData.password = newPass;

  try {
    const res = await fetch('/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updateData)
    });

    if (!res.ok) throw new Error('Не удалось обновить профиль');
    alert('Профиль обновлён!');
    editPassInput.value = '';
    loadMyProfile();
  } catch (error) {
    alert(error.message);
  }
});

// Загрузка списка всех игроков (если у вас есть эндпоинт /api/players)
async function loadAllPlayers() {
  try {
    const response = await fetch('/api/players', { credentials: 'include' });
    if (!response.ok) throw new Error('Список игроков недоступен');
    
    const players = await response.json();
    renderPlayers(players);
  } catch (error) {
    allPlayersList.innerHTML = '<p class="empty-state">Список игроков временно недоступен.</p>';
  }
}

function renderPlayers(players) {
  allPlayersList.replaceChildren();
  if (players.length === 0) {
    allPlayersList.innerHTML = '<p class="empty-state">Игроки не найдены.</p>';
    return;
  }

  players.forEach(player => {
    const card = document.createElement('article');
    card.className = 'card';
    const title = document.createElement('h3');
    title.textContent = player.username || player.email || `Игрок ${player.id}`;
    card.append(title);
    allPlayersList.append(card);
  });
}

searchInput.addEventListener('input', async (e) => {
  const query = e.target.value.toLowerCase().trim();
  if (query === '') return loadAllPlayers();

  try {
    const response = await fetch('/api/players', { credentials: 'include' });
    if (!response.ok) return;
    const players = await response.json();
    const filtered = players.filter(p => (p.username || '').toLowerCase().includes(query));
    renderPlayers(filtered);
  } catch (e) {}
});

// Создание комнаты
createRoomBtn.addEventListener('click', async () => {
  if (!myPlayerData) return;
  try {
    const res = await fetch('/game/rooms', { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error('Не удалось создать комнату');
    const room = await res.json();
    window.location.href = `game.html?room=${room.room_id}`;
  } catch (error) {
    alert(`Ошибка: ${error.message}`);
  }
});

// Вход в комнату
joinRoomBtn.addEventListener('click', async () => {
  if (!myPlayerData) return;
  const roomId = prompt('Введите код комнаты:');
  if (!roomId) return;

  try {
    const res = await fetch(`/game/rooms/${roomId}/join`, { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error('Комната не найдена');
    window.location.href = `game.html?room=${roomId}`;
  } catch (error) {
    alert(`Ошибка: ${error.message}`);
  }
});

// Выход из системы
logoutBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await fetch('/auth/jwt/logout', { method: 'POST', credentials: 'include' });
    window.location.href = 'index.html';
  } catch (err) {
    window.location.href = 'index.html';
  }
});

// Старт
loadMyProfile().then(() => loadAllPlayers());