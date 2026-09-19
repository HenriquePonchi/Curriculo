/* =============================================================
   Vitae — controlador da aplicação.
   Liga o estado (storage.js) ao formulário e ao preview
   (templates.js), e dispara a exportação (pdf-export.js).
   Nada de variáveis globais soltas: tudo vive neste IIFE.
   ============================================================= */
(function (global) {
  'use strict';

  var Storage = global.CVStorage;
  var Templates = global.CVTemplates;
  var Pdf = global.CVPdf;

  /* ---------- estado ---------- */
  var state = Storage.load() || Storage.emptyState();
  var hadSaved = !!Storage.load();
  var ui = Storage.loadUI();
  var zoom = 0;            // passos de zoom sobre a escala "ajustar"
  var activeTab = 'edit';
  var renderTimer = null;

  /* ---------- atalhos de DOM ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  var dom = {};

  /* ---------- caminhos aninhados (data-bind="personal.name") ---------- */
  function getPath(obj, path) {
    return path.split('.').reduce(function (acc, k) { return acc == null ? acc : acc[k]; }, obj);
  }
  function setPath(obj, path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    var target = keys.reduce(function (acc, k) { return acc[k] = acc[k] || {}; }, obj);
    target[last] = value;
  }

  /* =============================================================
     Paletas
     ============================================================= */
  var PALETTES = [
    { name: 'Verde profundo', primary: '#1f6f5c', secondary: '#2f3a3a' },
    { name: 'Azul marinho', primary: '#1f3f73', secondary: '#33415c' },
    { name: 'Grafite', primary: '#2b2f36', secondary: '#565d66' },
    { name: 'Vinho', primary: '#7b2436', secondary: '#3a2a2e' },
    { name: 'Petróleo', primary: '#15616d', secondary: '#2a3d45' },
    { name: 'Terracota', primary: '#a65437', secondary: '#4a3730' },
    { name: 'Roxo', primary: '#5a3d8a', secondary: '#3b3350' },
    { name: 'Oliva', primary: '#5b6b28', secondary: '#3c3f2c' }
  ];

  /* =============================================================
     Contraste (WCAG)
     ============================================================= */
  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }
  function luminance(hex) {
    var c = hexToRgb(hex);
    var vals = [c.r, c.g, c.b].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2];
  }
  function contrastRatio(a, b) {
    var l1 = luminance(a), l2 = luminance(b);
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function tint(hex, amount) {
    var c = hexToRgb(hex);
    function mix(v) { return Math.round(v + (255 - v) * amount); }
    return 'rgb(' + mix(c.r) + ',' + mix(c.g) + ',' + mix(c.b) + ')';
  }

  /* =============================================================
     Definição dos campos de cada lista
     ============================================================= */
  var LIST_DEFS = {
    experience: {
      title: function (item) { return [item.role, item.company].filter(Boolean).join(' — ') || 'Nova experiência'; },
      fields: [
        { key: 'role', label: 'Cargo', type: 'text', placeholder: 'Analista de marketing pleno' },
        { key: 'company', label: 'Empresa', type: 'text', placeholder: 'Loja Marear' },
        { key: 'start', label: 'Início', type: 'text', placeholder: '03/2022' },
        { key: 'end', label: 'Fim', type: 'text', placeholder: '12/2024' },
        { key: 'current', label: 'Trabalho aqui atualmente', type: 'checkbox' },
        { key: 'description', label: 'O que você fez (uma linha por item)', type: 'textarea', full: true,
          placeholder: 'Reduzi o custo por aquisição em 34% em oito meses.' }
      ]
    },
    education: {
      title: function (item) { return [item.course, item.school].filter(Boolean).join(' — ') || 'Nova formação'; },
      fields: [
        { key: 'course', label: 'Curso', type: 'text', placeholder: 'Publicidade e Propaganda' },
        { key: 'school', label: 'Instituição', type: 'text', placeholder: 'Universidade Católica de Santos' },
        { key: 'level', label: 'Nível', type: 'select', options: ['Técnico', 'Tecnólogo', 'Graduação', 'Pós-graduação', 'MBA', 'Mestrado', 'Doutorado', 'Curso livre'] },
        { key: 'start', label: 'Início', type: 'text', placeholder: '2015' },
        { key: 'end', label: 'Conclusão', type: 'text', placeholder: '2019' }
      ]
    },
    skills: {
      title: function (item) { return item.name || 'Nova habilidade'; },
      fields: [
        { key: 'name', label: 'Habilidade', type: 'text', placeholder: 'Google Ads' },
        { key: 'level', label: 'Nível', type: 'level' }
      ]
    },
    languages: {
      title: function (item) { return item.name || 'Novo idioma'; },
      fields: [
        { key: 'name', label: 'Idioma', type: 'text', placeholder: 'Inglês' },
        { key: 'level', label: 'Nível', type: 'select', options: ['Básico', 'Intermediário', 'Avançado', 'Fluente', 'Nativo'] }
      ]
    },
    courses: {
      title: function (item) { return item.name || 'Novo curso'; },
      fields: [
        { key: 'name', label: 'Curso ou certificação', type: 'text', full: true, placeholder: 'Google Ads Search Certification' },
        { key: 'org', label: 'Instituição', type: 'text', placeholder: 'Google Skillshop' },
        { key: 'year', label: 'Ano', type: 'text', placeholder: '2024' }
      ]
    },
    custom: {
      title: function (item) { return item.title || 'Nova seção'; },
      fields: [
        { key: 'title', label: 'Título da seção', type: 'text', full: true, placeholder: 'Voluntariado' },
        { key: 'content', label: 'Conteúdo', type: 'textarea', full: true, placeholder: 'Mentoria de marketing para pequenos negócios…' }
      ]
    }
  };

  var SECTIONS = [
    { id: 'sec-personal', label: 'Dados pessoais' },
    { id: 'sec-summary', label: 'Resumo' },
    { id: 'sec-experience', label: 'Experiência' },
    { id: 'sec-education', label: 'Formação' },
    { id: 'sec-skills', label: 'Habilidades' },
    { id: 'sec-languages', label: 'Idiomas' },
    { id: 'sec-courses', label: 'Cursos' },
    { id: 'sec-custom', label: 'Seções livres' },
    { id: 'sec-templates', label: 'Modelos' },
    { id: 'sec-style', label: 'Cores e fonte' }
  ];

  /* =============================================================
     Construção das listas
     ============================================================= */
  function buildItem(listName, item, index) {
    var def = LIST_DEFS[listName];
    var node = el('div', 'item');
    node.dataset.list = listName;
    node.dataset.index = String(index);
    node.setAttribute('draggable', 'false');

    var head = el('div', 'item__head');

    var handle = el('button', 'item__handle');
    handle.type = 'button';
    handle.setAttribute('aria-label', 'Reordenar: arraste, ou use as setas do teclado');
    handle.title = 'Arraste para reordenar (ou use ↑ ↓)';
    handle.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-drag"></use></svg>';
    // O arraste só começa pela alça: evita arrastar sem querer ao selecionar texto.
    handle.addEventListener('mousedown', function () { node.setAttribute('draggable', 'true'); });
    node.addEventListener('dragend', function () { node.setAttribute('draggable', 'false'); });
    handle.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp') { e.preventDefault(); moveItem(listName, index, index - 1, true); }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveItem(listName, index, index + 1, true); }
    });

    var title = el('span', 'item__title', def.title(item));
    title.dataset.role = 'item-title';

    // Alternativa ao arraste para telas de toque e navegação por teclado.
    var up = el('button', 'btn item__move');
    up.type = 'button';
    up.setAttribute('aria-label', 'Mover para cima');
    up.textContent = '↑';
    up.disabled = index === 0;
    up.addEventListener('click', function () { moveItem(listName, index, index - 1); });

    var down = el('button', 'btn item__move');
    down.type = 'button';
    down.setAttribute('aria-label', 'Mover para baixo');
    down.textContent = '↓';
    down.disabled = index === state[listName].length - 1;
    down.addEventListener('click', function () { moveItem(listName, index, index + 1); });

    var remove = el('button', 'btn item__remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remover item');
    remove.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>';
    remove.addEventListener('click', function () { removeItem(listName, node); });

    head.append(handle, title, up, down, remove);

    var body = el('div', 'item__body');
    var twoCols = def.fields.filter(function (f) { return !f.full && f.type !== 'checkbox'; }).length > 1;
    if (twoCols) body.classList.add('grid--2');

    def.fields.forEach(function (f) {
      body.appendChild(buildField(listName, item, index, f));
    });

    node.append(head, body);
    attachDrag(node);
    return node;
  }

  function buildField(listName, item, index, f) {
    var id = 'f-' + listName + '-' + index + '-' + f.key;
    var wrap;

    if (f.type === 'checkbox') {
      wrap = el('label', 'item__current');
      wrap.style.gridColumn = '1 / -1';
      var cb = el('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.checked = !!item[f.key];
      cb.addEventListener('change', function () {
        item[f.key] = cb.checked;
        onChange();
      });
      wrap.append(cb, document.createTextNode(f.label));
      return wrap;
    }

    wrap = el('div', 'field');
    if (f.full) wrap.style.gridColumn = '1 / -1';

    var label = el('label', null, f.label);
    label.setAttribute('for', id);
    wrap.appendChild(label);

    if (f.type === 'level') {
      var group = el('div', 'level');
      group.id = id;
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-label', f.label);
      for (var i = 1; i <= 5; i++) {
        (function (value) {
          var dot = el('button', 'level__dot' + (value <= (item[f.key] || 0) ? ' is-on' : ''));
          dot.type = 'button';
          dot.setAttribute('role', 'radio');
          dot.setAttribute('aria-label', 'Nível ' + value + ' de 5');
          dot.setAttribute('aria-checked', String(value === item[f.key]));
          dot.addEventListener('click', function () {
            item[f.key] = value;
            $$('.level__dot', group).forEach(function (d, idx) {
              d.classList.toggle('is-on', idx < value);
              d.setAttribute('aria-checked', String(idx + 1 === value));
            });
            onChange();
          });
          group.appendChild(dot);
        })(i);
      }
      wrap.appendChild(group);
      return wrap;
    }

    var input;
    if (f.type === 'textarea') {
      input = el('textarea');
      input.rows = 4;
    } else if (f.type === 'select') {
      input = el('select');
      f.options.forEach(function (opt) {
        var o = el('option', null, opt);
        o.value = opt;
        input.appendChild(o);
      });
    } else {
      input = el('input');
      input.type = 'text';
    }
    input.id = id;
    input.value = item[f.key] == null ? '' : item[f.key];
    if (f.placeholder) input.placeholder = f.placeholder;

    input.addEventListener('input', function () {
      item[f.key] = input.value;
      var titleNode = $('[data-role="item-title"]', input.closest('.item'));
      if (titleNode) titleNode.textContent = LIST_DEFS[listName].title(item);
      onChange();
    });
    if (f.type === 'select') input.addEventListener('change', function () { onChange(); });

    wrap.appendChild(input);
    return wrap;
  }

  function renderList(listName) {
    var container = $('#list-' + listName);
    if (!container) return;
    container.textContent = '';
    state[listName].forEach(function (item, i) {
      container.appendChild(buildItem(listName, item, i));
    });
    if (!state[listName].length) {
      var empty = el('p', 'panel__hint', 'Nada aqui ainda. Use o botão abaixo para começar.');
      container.appendChild(empty);
    }
  }

  function addItem(listName) {
    state[listName].push(Storage.blankItem(listName));
    renderList(listName);
    var items = $$('.item', $('#list-' + listName));
    var last = items[items.length - 1];
    if (last) {
      var firstInput = $('input, textarea, select', last);
      if (firstInput) firstInput.focus();
    }
    onChange();
  }

  function moveItem(listName, from, to, keepFocus) {
    var list = state[listName];
    if (to < 0 || to >= list.length) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    renderList(listName);
    if (keepFocus) {
      var items = $$('.item', $('#list-' + listName));
      if (items[to]) $('.item__handle', items[to]).focus();
    }
    onChange();
  }

  function removeItem(listName, node) {
    var index = Number(node.dataset.index);
    node.classList.add('is-leaving');
    setTimeout(function () {
      state[listName].splice(index, 1);
      renderList(listName);
      onChange();
    }, 160);
  }

  /* ---------- reordenar (Drag Events API nativa) ---------- */
  var dragSource = null;

  function attachDrag(node) {
    node.addEventListener('dragstart', function (e) {
      dragSource = node;
      node.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', node.dataset.index); } catch (err) { /* IE legado */ }
    });

    node.addEventListener('dragend', function () {
      node.classList.remove('is-dragging');
      $$('.item.is-dropzone').forEach(function (n) { n.classList.remove('is-dropzone'); });
      dragSource = null;
    });

    node.addEventListener('dragover', function (e) {
      if (!dragSource || dragSource === node) return;
      if (dragSource.dataset.list !== node.dataset.list) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      node.classList.add('is-dropzone');
    });

    node.addEventListener('dragleave', function () { node.classList.remove('is-dropzone'); });

    node.addEventListener('drop', function (e) {
      e.preventDefault();
      node.classList.remove('is-dropzone');
      if (!dragSource || dragSource === node) return;
      var listName = node.dataset.list;
      if (dragSource.dataset.list !== listName) return;
      var from = Number(dragSource.dataset.index);
      var to = Number(node.dataset.index);
      var moved = state[listName].splice(from, 1)[0];
      state[listName].splice(to, 0, moved);
      renderList(listName);
      onChange();
    });
  }

  /* =============================================================
     Campos fixos
     ============================================================= */
  function bindStaticFields() {
    $$('[data-bind]').forEach(function (input) {
      var path = input.dataset.bind;
      var value = getPath(state, path);
      if (input.type === 'checkbox') input.checked = !!value;
      else input.value = value == null ? '' : value;

      var evt = (input.type === 'color' || input.type === 'range' || input.tagName === 'SELECT') ? 'input' : 'input';
      input.addEventListener(evt, function () {
        setPath(state, path, input.type === 'checkbox' ? input.checked : input.value);
        if (path === 'settings.margin') $('#margin-out').textContent = input.value;
        if (path === 'settings.primary' || path === 'settings.secondary') syncPaletteSelection();
        onChange();
      });
    });

    // Mostrar foto tem id próprio (fora do data-bind por causa do estado visual)
    var showPhoto = $('#f-showPhoto');
    showPhoto.checked = state.settings.showPhoto;
    showPhoto.addEventListener('change', function () {
      state.settings.showPhoto = showPhoto.checked;
      onChange();
    });

    var zoomInput = $('#f-photoZoom');
    zoomInput.value = state.personal.photoZoom;
    zoomInput.addEventListener('input', function () {
      state.personal.photoZoom = Number(zoomInput.value);
      onChange();
    });

    $('#margin-out').textContent = state.settings.margin;
    $('#f-margin').value = state.settings.margin;

    var summary = $('#f-summary');
    summary.addEventListener('input', updateSummaryCounter);
    updateSummaryCounter();

    // Aviso sutil de campo importante vazio, sem travar nada
    ['#f-name', '#f-email'].forEach(function (sel) {
      var input = $(sel);
      input.addEventListener('blur', function () {
        input.classList.toggle('is-empty-required', input.value.trim() === '');
      });
    });
  }

  function updateSummaryCounter() {
    var len = $('#f-summary').value.length;
    var note = $('#summary-counter');
    note.textContent = len + ' caracteres · o ideal fica entre 300 e 600';
    note.classList.toggle('is-warn', len > 700);
    if (len > 700) note.textContent = len + ' caracteres · está ficando longo, tente cortar para 600';
  }

  /* ---------- foto ---------- */
  function bindPhoto() {
    var input = $('#f-photo');
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { toast('Escolha um arquivo de imagem.'); return; }
      resizeImage(file, 520).then(function (dataUrl) {
        state.personal.photo = dataUrl;
        paintPhoto();
        onChange();
      }).catch(function () {
        toast('Não foi possível abrir essa imagem.');
      });
      input.value = '';
    });

    $('[data-action="remove-photo"]').addEventListener('click', function () {
      state.personal.photo = '';
      paintPhoto();
      onChange();
    });
  }

  /* Reduz a foto antes de guardar: base64 grande estoura a cota do localStorage. */
  function resizeImage(file, maxSize) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var side = Math.min(img.width, img.height);
          var canvas = document.createElement('canvas');
          canvas.width = canvas.height = Math.min(maxSize, side);
          var ctx = canvas.getContext('2d');
          // Recorte quadrado central — é o que os modelos usam (círculo/quadrado)
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side,
            0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        };
        img.onerror = reject;
        img.src = String(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function paintPhoto() {
    var img = $('#photo-img');
    if (state.personal.photo) {
      img.src = state.personal.photo;
      img.hidden = false;
    } else {
      img.removeAttribute('src');
      img.hidden = true;
    }
  }

  /* =============================================================
     Modelos, paletas e tamanho
     ============================================================= */
  function buildTemplateGrid() {
    var grid = $('#template-grid');
    grid.textContent = '';
    Templates.list.forEach(function (tpl) {
      var btn = el('button', 'tpl');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.dataset.template = tpl.id;
      btn.setAttribute('aria-checked', String(state.settings.template === tpl.id));
      var thumb = el('div', 'tpl__thumb');
      thumb.innerHTML = Templates.thumb(tpl.id, state.settings.primary);
      btn.append(thumb, el('span', 'tpl__name', tpl.name), el('span', 'tpl__tag', tpl.tag));
      btn.addEventListener('click', function () {
        state.settings.template = tpl.id;
        syncTemplateSelection();
        onChange();
      });
      grid.appendChild(btn);
    });
  }

  function syncTemplateSelection() {
    $$('.tpl').forEach(function (btn) {
      btn.setAttribute('aria-checked', String(btn.dataset.template === state.settings.template));
      var thumbBox = $('.tpl__thumb', btn);
      thumbBox.innerHTML = Templates.thumb(btn.dataset.template, state.settings.primary);
    });
  }

  function buildPaletteGrid() {
    var grid = $('#palette-grid');
    grid.textContent = '';
    PALETTES.forEach(function (p) {
      var btn = el('button', 'pal');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.dataset.primary = p.primary;
      btn.dataset.secondary = p.secondary;
      btn.setAttribute('aria-label', 'Paleta ' + p.name);
      btn.title = p.name;
      var a = el('span', 'pal__a'); a.style.background = p.primary;
      var b = el('span', 'pal__b'); b.style.background = p.secondary;
      btn.append(a, b);
      btn.addEventListener('click', function () {
        state.settings.primary = p.primary;
        state.settings.secondary = p.secondary;
        $('#f-primary').value = p.primary;
        $('#f-secondary').value = p.secondary;
        syncPaletteSelection();
        syncTemplateSelection();
        onChange();
      });
      grid.appendChild(btn);
    });
    syncPaletteSelection();
  }

  function syncPaletteSelection() {
    $$('.pal').forEach(function (btn) {
      var match = btn.dataset.primary.toLowerCase() === String(state.settings.primary).toLowerCase()
        && btn.dataset.secondary.toLowerCase() === String(state.settings.secondary).toLowerCase();
      btn.setAttribute('aria-checked', String(match));
    });
  }

  function bindSizeGroup() {
    $$('#size-group button').forEach(function (btn) {
      btn.setAttribute('aria-checked', String(btn.dataset.size === state.settings.size));
      btn.addEventListener('click', function () {
        state.settings.size = btn.dataset.size;
        $$('#size-group button').forEach(function (b) {
          b.setAttribute('aria-checked', String(b.dataset.size === state.settings.size));
        });
        onChange();
      });
    });
  }

  function updateContrastNote() {
    var note = $('#contrast-note');
    var onWhite = contrastRatio(state.settings.primary, '#ffffff');
    var whiteOn = contrastRatio('#ffffff', state.settings.primary);
    var problems = [];
    if (onWhite < 4.5) problems.push('títulos coloridos sobre fundo branco');
    if (whiteOn < 4.5) problems.push('texto branco sobre a faixa colorida');

    if (problems.length) {
      note.textContent = 'Contraste baixo em ' + problems.join(' e ') + '. Escolha um tom mais escuro para manter a leitura fácil (WCAG AA).';
      note.classList.add('is-bad');
    } else {
      note.textContent = 'Contraste aprovado no nível AA (' + onWhite.toFixed(1) + ':1 sobre branco).';
      note.classList.remove('is-bad');
    }
  }

  /* =============================================================
     Preview
     ============================================================= */
  var styleTag = null;

  function renderPreview() {
    var page = $('#cv-page');
    var result = Templates.render(state);

    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'cv-template-style';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = result.css;

    page.className = 'cv-page ' + result.className;
    page.style.setProperty('--cv-primary', state.settings.primary);
    page.style.setProperty('--cv-secondary', state.settings.secondary);
    page.style.setProperty('--cv-tint', tint(state.settings.primary, 0.9));
    page.style.setProperty('--cv-tint-strong', tint(state.settings.primary, 0.65));
    page.style.setProperty('--cv-font', Templates.fontStack(state.settings.font));
    page.style.setProperty('--cv-fs', Templates.fontSize(state.settings.size));
    page.style.setProperty('--cv-margin', state.settings.margin + 'mm');
    page.innerHTML = result.html;

    drawPageGuides(page);
    fitPreview();
    updateContrastNote();
  }

  function drawPageGuides(page) {
    var pxPerMm = page.offsetWidth / 210;
    var pageH = 297 * pxPerMm;
    var total = Math.max(1, Math.ceil((page.scrollHeight - 2) / pageH));

    for (var i = 1; i < total; i++) {
      var guide = el('div', 'cv-page__break');
      guide.style.top = (pageH * i) + 'px';
      guide.dataset.label = 'página ' + (i + 1);
      page.appendChild(guide);
    }
    $('#page-count').textContent = total + (total === 1 ? ' página' : ' páginas');
  }

  function fitPreview() {
    var stage = $('#preview-stage');
    var scaler = $('#preview-scaler');
    var page = $('#cv-page');
    if (!stage.offsetWidth) return;

    var available = stage.clientWidth - 2; // respiro para a sombra
    var base = Math.min(1, available / page.offsetWidth);
    var scale = Math.max(0.25, Math.min(1.8, base * Math.pow(1.1, zoom)));

    scaler.style.transform = 'scale(' + scale + ')';
    scaler.style.width = page.offsetWidth + 'px';
    scaler.style.height = (page.offsetHeight * scale) + 'px';

    $('#zoom-out-label').textContent = Math.round(scale * 100) + '%';
  }

  /* =============================================================
     Fluxo de mudança
     ============================================================= */
  function onChange() {
    if (renderTimer) cancelAnimationFrame(renderTimer);
    renderTimer = requestAnimationFrame(function () {
      renderTimer = null;
      renderPreview();
    });
    Storage.save(state, function (ok, err) {
      if (!ok && err) toast('Não deu para salvar: o armazenamento do navegador está cheio. Tente uma foto menor.');
    });
  }

  /* =============================================================
     Telas, abas e navegação
     ============================================================= */
  function showScreen(name) {
    document.body.dataset.screen = name;
    $('#screen-editor').hidden = (name !== 'editor');
    $('#screen-landing').hidden = (name === 'editor');
    if (name === 'editor') {
      requestAnimationFrame(function () { renderPreview(); fitPreview(); });
    }
    global.scrollTo(0, 0);
  }

  function setTab(tab) {
    activeTab = tab;
    document.body.dataset.tab = (tab === 'preview') ? 'preview' : 'edit';
    $$('.tabbar__btn').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.tab === tab);
    });
    if (tab === 'templates') scrollToSection('sec-templates');
    if (tab === 'style') scrollToSection('sec-style');
    if (tab === 'preview') requestAnimationFrame(fitPreview);
  }

  function scrollToSection(id) {
    var target = document.getElementById(id);
    if (!target) return;
    var pane = $('#pane-form');
    var isPaneScroll = pane.scrollHeight > pane.clientHeight && getComputedStyle(pane).overflowY === 'auto';
    if (isPaneScroll) {
      pane.scrollTo({ top: target.offsetTop - 16, behavior: 'smooth' });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function buildRail() {
    var list = $('#rail-list');
    list.textContent = '';
    SECTIONS.forEach(function (sec, i) {
      var li = el('li');
      var a = el('a', 'railnav__link');
      a.href = '#' + sec.id;
      a.dataset.target = sec.id;
      a.append(el('span', 'railnav__num', String(i + 1)), el('span', 'railnav__label', sec.label));
      a.addEventListener('click', function (e) {
        e.preventDefault();
        scrollToSection(sec.id);
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    watchSections();
  }

  function watchSections() {
    if (!('IntersectionObserver' in global)) return;
    var links = $$('.railnav__link');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-current', a.dataset.target === entry.target.id);
        });
      });
    }, { root: $('#pane-form'), rootMargin: '-10% 0px -70% 0px', threshold: 0 });
    SECTIONS.forEach(function (sec) {
      var node = document.getElementById(sec.id);
      if (node) observer.observe(node);
    });
  }

  /* =============================================================
     Modal, toast, overlay
     ============================================================= */
  var lastFocused = null;

  function openModal(opts) {
    lastFocused = document.activeElement;
    $('#modal-title').textContent = opts.title;
    $('#modal-text').textContent = opts.text || '';
    var actions = $('#modal-actions');
    actions.textContent = '';

    (opts.actions || []).forEach(function (a) {
      var btn = el('button', 'btn ' + (a.variant || 'btn--quiet'), a.label);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        closeModal();
        if (a.onClick) a.onClick();
      });
      actions.appendChild(btn);
    });

    $('#modal').hidden = false;
    $('.modal__box').focus();
  }

  function closeModal() {
    $('#modal').hidden = true;
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  var toastTimer = null;
  function toast(message) {
    var node = $('#toast');
    node.textContent = message;
    node.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 3800);
  }

  function busy(on, text) {
    $('#busy').hidden = !on;
    if (text) $('#busy-text').textContent = text;
  }

  /* =============================================================
     Ações do cabeçalho
     ============================================================= */
  function bindActions() {
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-action]');
      if (!trigger) return;
      var action = trigger.dataset.action;

      if (action === 'start') { e.preventDefault(); showScreen('editor'); }
      if (action === 'start-sample') {
        e.preventDefault();
        applyState(Storage.sampleState());
        showScreen('editor');
      }
      if (action === 'go-landing') { e.preventDefault(); showScreen('landing'); }
      if (action === 'toggle-theme') toggleTheme();
      if (action === 'new-resume') confirmNew();
      if (action === 'open-data-menu') openDataMenu();
      if (action === 'export-pdf') doExport();
    });

    $$('[data-add]').forEach(function (btn) {
      btn.addEventListener('click', function () { addItem(btn.dataset.add); });
    });

    $$('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { setTab(btn.dataset.tab); });
    });

    $$('[data-zoom]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        zoom = Storage.clamp(zoom + Number(btn.dataset.zoom), -6, 6);
        fitPreview();
      });
    });

    $$('[data-close-modal]').forEach(function (n) { n.addEventListener('click', closeModal); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        Storage.flush(state);
        toast('Currículo salvo neste navegador.');
      }
    });

    $('#import-file').addEventListener('change', handleImportFile);

    var resizeTimer = null;
    global.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitPreview, 120);
    });
  }

  function toggleTheme() {
    var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    Storage.saveUI({ theme: next });
  }

  function confirmNew() {
    openModal({
      title: 'Começar um currículo novo?',
      text: 'Tudo que está preenchido agora será apagado deste navegador. Se quiser guardar, exporte o JSON antes.',
      actions: [
        { label: 'Cancelar' },
        { label: 'Exportar JSON antes', onClick: function () { exportJSON(); } },
        { label: 'Apagar e começar', variant: 'btn--primary', onClick: function () {
          Storage.clear();
          applyState(Storage.emptyState());
          toast('Currículo novo, folha em branco.');
        } }
      ]
    });
  }

  function openDataMenu() {
    openModal({
      title: 'Seus dados',
      text: 'O currículo fica salvo só neste navegador. Exporte um arquivo JSON para continuar em outro aparelho.',
      actions: [
        { label: 'Fechar' },
        { label: 'Importar JSON', onClick: function () { $('#import-file').click(); } },
        { label: 'Exportar JSON', variant: 'btn--primary', onClick: exportJSON }
      ]
    });
  }

  function exportJSON() {
    var name = 'curriculo-' + Pdf.slugify(state.personal.name) + '.json';
    Storage.download(name, Storage.toJSON(state), 'application/json');
    toast('Arquivo ' + name + ' baixado.');
  }

  function handleImportFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    Storage.readFile(file)
      .then(function (text) {
        var next = Storage.importJSON(text);
        applyState(next);
        showScreen('editor');
        toast('Dados importados.');
      })
      .catch(function () {
        toast('Esse arquivo não é um JSON do Vitae.');
      });
    e.target.value = '';
  }

  /* Substitui o estado inteiro e redesenha o formulário. */
  function applyState(next) {
    state = next;
    $$('[data-bind]').forEach(function (input) {
      var value = getPath(state, input.dataset.bind);
      if (input.type === 'checkbox') input.checked = !!value;
      else input.value = value == null ? '' : value;
    });
    $('#f-showPhoto').checked = state.settings.showPhoto;
    $('#f-photoZoom').value = state.personal.photoZoom;
    $('#margin-out').textContent = state.settings.margin;
    Object.keys(LIST_DEFS).forEach(renderList);
    paintPhoto();
    updateSummaryCounter();
    syncTemplateSelection();
    syncPaletteSelection();
    $$('#size-group button').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.size === state.settings.size));
    });
    onChange();
  }

  /* ---------- exportação ---------- */
  function doExport() {
    if (!Pdf.ready()) {
      toast('As bibliotecas de PDF ainda não carregaram. Tente de novo em alguns segundos.');
      return;
    }
    if (!state.personal.name.trim()) {
      openModal({
        title: 'Seu currículo está sem nome',
        text: 'Dá para exportar assim mesmo, mas o arquivo vai sair como "curriculo-sem-nome.pdf".',
        actions: [
          { label: 'Preencher o nome', onClick: function () { setTab('edit'); scrollToSection('sec-personal'); $('#f-name').focus(); } },
          { label: 'Exportar assim', variant: 'btn--primary', onClick: runExport }
        ]
      });
      return;
    }
    runExport();
  }

  function runExport() {
    busy(true, 'Gerando o PDF…');
    // Um frame para o overlay aparecer antes do trabalho pesado.
    requestAnimationFrame(function () {
      Pdf.exportPdf($('#cv-page'), state)
        .then(function (result) {
          busy(false);
          toast(result.file + ' · ' + result.pages + (result.pages === 1 ? ' página' : ' páginas'));
        })
        .catch(function (err) {
          busy(false);
          console.error('[Vitae] falha ao exportar:', err);
          openModal({
            title: 'O PDF não foi gerado',
            text: (err && err.message) ? err.message : 'Algo travou na hora de montar o arquivo. Tente de novo; se persistir, use Ctrl+P e salve como PDF.',
            actions: [{ label: 'Entendi', variant: 'btn--primary' }]
          });
        });
    });
  }

  /* =============================================================
     Início
     ============================================================= */
  function init() {
    document.documentElement.dataset.theme = ui.theme
      || (global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    bindStaticFields();
    bindPhoto();
    bindSizeGroup();
    buildTemplateGrid();
    buildPaletteGrid();
    buildRail();
    Object.keys(LIST_DEFS).forEach(renderList);
    paintPhoto();
    bindActions();
    setTab('edit');

    if (hadSaved) {
      $('#hero-resume-note').hidden = false;
      $$('[data-action="start"]').forEach(function (btn) {
        btn.textContent = 'Continuar meu currículo';
      });
    }

    renderPreview();

    // Garante que a folha reaja quando as fontes do Google terminarem de chegar.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { renderPreview(); });
    }

    global.addEventListener('beforeunload', function () { Storage.flush(state); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
