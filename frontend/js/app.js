// Используем относительные пути вместо http://127.0.0.1:8000
const authForm          = document.querySelector('#auth-form');
const authEmailInput    = document.querySelector('#auth-email');
const authNameInput     = document.querySelector('#auth-name');
const authPassInput     = document.querySelector('#auth-password');
const authRememberInput = document.querySelector('#auth-remember');
const authSubmitBtn     = document.querySelector('#auth-submit');
const authError         = document.querySelector('#auth-error');
const authNicknameField = document.querySelector('#auth-nickname-field');
const authRememberField = document.querySelector('#auth-remember-field');
const tabLogin          = document.querySelector('#tab-login');
const tabRegister       = document.querySelector('#tab-register');

let authMode = 'login';

function setAuthMode(mode) {
  authMode = mode;
  tabLogin.classList.toggle('active', mode === 'login');
  tabRegister.classList.toggle('active', mode === 'register');

  authNicknameField.hidden = mode !== 'register';
  authRememberField.hidden = mode !== 'login';
  authNameInput.required   = mode === 'register';

  authSubmitBtn.textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
  authPassInput.autocomplete = mode === 'login' ? 'current-password' : 'new-password';

  authError.hidden = true;
  authError.textContent = '';
}

function showError(message) {
  authError.textContent = message;
  authError.hidden = false;
}

async function parseErrorResponse(response) {
  try {
    const data = await response.json();
    if (response.status === 422 && Array.isArray(data.detail)) {
      const msgs = data.detail.map(e => {
        const field = e.loc.filter(l => l !== 'body').join('.');
        return `${field ? field + ': ' : ''}${e.msg}`;
      });
      return `Ошибка данных:\n${msgs.join('\n')}`;
    }
    return data.detail || `Ошибка сервера (${response.status})`;
  } catch (e) {
    return `Ошибка сервера (${response.status})`;
  }
}

async function handleLogin() {
  const email      = authEmailInput.value.trim();
  const password   = authPassInput.value;
  const rememberMe = authRememberInput.checked;

  if (!email || !password) return showError('Введите email и пароль');

  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Обязательно для сохранения куки
      body: JSON.stringify({ email, password, remember_me: rememberMe }),
    });

    if (!response.ok) throw new Error(await parseErrorResponse(response));

    // Успешный вход — переходим в профиль
    window.location.href = 'profile.html';
  } catch (error) {
    showError(error.message);
  }
}

async function handleRegister() {
  const email    = authEmailInput.value.trim();
  const username = authNameInput.value.trim();
  const password = authPassInput.value;

  if (!email) return showError('Введите email');
  if (!username || username.length < 2) return showError('Введите имя (не короче 2 символов)');
  if (password.length < 8) return showError('Пароль должен быть не короче 8 символов');

  try {
    // FastAPI Users ожидает username
    const payload = { email, password, username, is_active: true, is_superuser: false, is_verified: false };
    const response = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(await parseErrorResponse(response));

    // Сразу логинимся после регистрации
    setAuthMode('login');
    await handleLogin();
  } catch (error) {
    showError(error.message);
  }
}

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (authMode === 'login') handleLogin();
  else handleRegister();
});

tabLogin.addEventListener('click', () => setAuthMode('login'));
tabRegister.addEventListener('click', () => setAuthMode('register'));

// Проверка, если пользователь уже авторизован
(async function checkAuth() {
  try {
    const res = await fetch('/users/me', { credentials: 'include' });
    if (res.ok) {
      window.location.href = 'profile.html';
      return;
    }
  } catch (e) {}
  setAuthMode('login');
})();