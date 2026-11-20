/*
 * Адаптивный холст для Gartic Phone.
 * Совместим с существующим game.js: displayCanvas('#drawingArea')
 * и drawingArea.querySelector('canvas').toDataURL('image/png').
 * Работает с мышью, касанием и стилусом (Pointer Events).
 */
(function () {
  'use strict';

  window.displayCanvas = function displayCanvas(selector) {
    const container = document.querySelector(selector);
    if (!container) {
      console.warn('Контейнер рисования не найден:', selector);
      return;
    }
    // game.js инициализирует холст один раз. Не создаём копии при повторном вызове.
    if (container.querySelector('canvas')) return;

    const editor = document.createElement('div');
    editor.className = 'mobile-paint-editor';

    const toolbar = document.createElement('div');
    toolbar.className = 'paint-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Инструменты рисования');

    const palette = document.createElement('div');
    palette.className = 'paint-palette';
    palette.setAttribute('aria-label', 'Цвета кисти');
    const paletteColors = [
      ['#222222', 'Чёрный'], ['#f44336', 'Красный'],
      ['#ff9800', 'Оранжевый'], ['#ffeb3b', 'Жёлтый'],
      ['#4caf50', 'Зелёный'], ['#2196f3', 'Синий'],
      ['#9c27b0', 'Фиолетовый'], ['#795548', 'Коричневый']
    ];

    const sizeLabel = document.createElement('label');
    sizeLabel.className = 'paint-size-label';
    sizeLabel.textContent = 'Кисть ';
    const sizeInput = document.createElement('input');
    sizeInput.type = 'range';
    sizeInput.min = '2';
    sizeInput.max = '28';
    sizeInput.value = '5';
    sizeInput.setAttribute('aria-label', 'Толщина кисти');
    const sizeValue = document.createElement('span');
    sizeValue.textContent = '5';
    sizeInput.addEventListener('input', () => { sizeValue.textContent = sizeInput.value; });
    sizeLabel.append(sizeInput, sizeValue);

    const actions = document.createElement('div');
    actions.className = 'paint-actions';
    function action(text, label) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'paint-action';
      b.textContent = text;
      b.setAttribute('aria-label', label);
      return b;
    }
    const eraseButton = action('Ластик', 'Включить или выключить ластик');
    const undoButton = action('↶ Отменить', 'Отменить последнее действие');
    const clearButton = action('Очистить', 'Очистить рисунок');
    actions.append(eraseButton, undoButton, clearButton);

    const frame = document.createElement('div');
    frame.className = 'paint-canvas-frame';
    const canvas = document.createElement('canvas');
    canvas.className = 'paint-canvas';
    // Постоянный размер буфера: CSS масштабирует только отображение.
    // При повороте телефона рисунок не исчезает.
    canvas.width = 900;
    canvas.height = 600;
    canvas.setAttribute('aria-label', 'Поле рисования');
    frame.append(canvas);
    toolbar.append(palette, sizeLabel, actions);
    editor.append(toolbar, frame);
    container.append(editor);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let brushColor = '#222222';
    let erasing = false;
    let drawingPointer = null;
    let previousPoint = null;
    const undoStack = [];
    const MAX_UNDO = 10;

    function paintWhite() {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    function saveUndo() {
      if (undoStack.length >= MAX_UNDO) undoStack.shift();
      undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }

    function chooseColor(hex, button) {
      brushColor = hex;
      erasing = false;
      eraseButton.classList.remove('is-active');
      palette.querySelectorAll('.paint-color').forEach(b => {
        const selected = b === button;
        b.classList.toggle('is-active', selected);
        b.setAttribute('aria-pressed', String(selected));
      });
    }

    paletteColors.forEach(([hex, name], index) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'paint-color';
      b.style.backgroundColor = hex;
      b.setAttribute('aria-label', name);
      b.title = name;
      b.addEventListener('click', () => chooseColor(hex, b));
      palette.append(b);
      if (index === 0) chooseColor(hex, b);
    });

    eraseButton.addEventListener('click', () => {
      erasing = !erasing;
      eraseButton.classList.toggle('is-active', erasing);
      eraseButton.setAttribute('aria-pressed', String(erasing));
      if (erasing) {
        palette.querySelectorAll('.paint-color').forEach(b => {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
      } else {
        const chosen = Array.from(palette.children).find(b =>
          b.style.backgroundColor === hexToRGB(brushColor));
        chooseColor(brushColor, chosen);
      }
    });

    function hexToRGB(hex) {
      const value = hex.slice(1);
      return `rgb(${parseInt(value.slice(0,2),16)}, ${parseInt(value.slice(2,4),16)}, ${parseInt(value.slice(4,6),16)})`;
    }

    undoButton.addEventListener('click', () => {
      if (undoStack.length) ctx.putImageData(undoStack.pop(), 0, 0);
    });

    clearButton.addEventListener('click', () => {
      saveUndo();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      paintWhite();
    });

    function pointFromPointer(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height
      };
    }

    function setupStroke(event) {
      const rect = canvas.getBoundingClientRect();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = erasing ? '#fff' : brushColor;
      ctx.fillStyle = erasing ? '#fff' : brushColor;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Размер кисти измеряется в видимых CSS-пикселях, а не пикселях буфера.
      ctx.lineWidth = Number(sizeInput.value) * canvas.width / rect.width;
    }

    canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (drawingPointer !== null) return;
      event.preventDefault();
      drawingPointer = event.pointerId;
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
      saveUndo();
      setupStroke(event);
      const p = pointFromPointer(event);
      previousPoint = p;
      // Точка при коротком касании (без перемещения пальца).
      ctx.beginPath();
      ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, 2 * Math.PI);
      ctx.fill();
    });

    canvas.addEventListener('pointermove', (event) => {
      if (drawingPointer !== event.pointerId || previousPoint === null) return;
      event.preventDefault();
      const p = pointFromPointer(event);
      ctx.beginPath();
      ctx.moveTo(previousPoint.x, previousPoint.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      previousPoint = p;
    });

    function finishStroke(event) {
      if (drawingPointer !== event.pointerId) return;
      drawingPointer = null;
      previousPoint = null;
      if (canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    }
    canvas.addEventListener('pointerup', finishStroke);
    canvas.addEventListener('pointercancel', finishStroke);
    canvas.addEventListener('lostpointercapture', finishStroke);

    paintWhite();

    // game.js делает clearRect при каждом новом задании. После этого
    // восстанавливаем белый фон и сбрасываем историю отмены между раундами.
    const block = container.closest('#draw-task-block');
    if (block && typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => {
        if (block.hidden || !canvas.isConnected) return;
        drawingPointer = null;
        previousPoint = null;
        undoStack.length = 0;
        paintWhite();
      }).observe(block, { attributes: true, attributeFilter: ['hidden'] });
    }
  };
})();
