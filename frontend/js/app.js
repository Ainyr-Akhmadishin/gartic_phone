// Ждём загрузки страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ JavaScript подключён!');

    // Находим кнопку
    const button = document.getElementById('click-btn');
    const message = document.getElementById('message');

    // Вешаем обработчик на кнопку
    button.addEventListener('click', function() {
        message.textContent = '🎉 Кнопка нажата! JavaScript работает!';
        message.style.color = '#4CAF50';
        message.style.fontWeight = 'bold';
    });
});