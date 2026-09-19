/* =============================================================
   Vitae — camada de dados.
   Responsabilidade única: forma do estado, persistência e
   import/export. Não sabe nada sobre DOM nem sobre templates.
   Exposto em window.CVStorage.
   ============================================================= */
(function (global) {
  'use strict';

  var KEY = 'vitae.resume.v1';
  var KEY_UI = 'vitae.ui.v1';
  var SAVE_DELAY = 500; // ms — debounce pedido no briefing

  /* ---------- Estado padrão ---------- */
  function emptyState() {
    return {
      version: 1,
      personal: {
        photo: '',        // dataURL
        photoZoom: 100,   // % de enquadramento
        name: '',
        title: '',
        email: '',
        phone: '',
        city: '',
        linkedin: '',
        website: ''
      },
      summary: '',
      experience: [],
      education: [],
      skills: [],
      languages: [],
      courses: [],
      custom: [],
      settings: {
        template: 'moderno',
        primary: '#1f6f5c',
        secondary: '#2f3a3a',
        font: 'Inter',
        size: 'm',       // s | m | l
        margin: 15,      // mm
        showPhoto: true
      }
    };
  }

  /* ---------- Itens em branco por tipo de lista ---------- */
  var BLANKS = {
    experience: function () {
      return { company: '', role: '', start: '', end: '', current: false, description: '' };
    },
    education: function () {
      return { school: '', course: '', level: 'Graduação', start: '', end: '' };
    },
    skills: function () { return { name: '', level: 4 }; },
    languages: function () { return { name: '', level: 'Intermediário' }; },
    courses: function () { return { name: '', org: '', year: '' }; },
    custom: function () { return { title: '', content: '' }; }
  };

  function blankItem(listName) {
    var make = BLANKS[listName];
    return make ? make() : {};
  }

  /* ---------- Normalização ---------- */
  /* Mescla o que veio do storage/JSON sobre o padrão, campo a campo,
     para que uma versão antiga do arquivo nunca deixe o app sem chave. */
  function normalize(raw) {
    var base = emptyState();
    if (!raw || typeof raw !== 'object') return base;

    ['personal', 'settings'].forEach(function (group) {
      if (raw[group] && typeof raw[group] === 'object') {
        Object.keys(base[group]).forEach(function (k) {
          if (raw[group][k] !== undefined && raw[group][k] !== null) {
            base[group][k] = raw[group][k];
          }
        });
      }
    });

    if (typeof raw.summary === 'string') base.summary = raw.summary;

    Object.keys(BLANKS).forEach(function (listName) {
      if (!Array.isArray(raw[listName])) return;
      base[listName] = raw[listName].map(function (item) {
        var blank = blankItem(listName);
        if (item && typeof item === 'object') {
          Object.keys(blank).forEach(function (k) {
            if (item[k] !== undefined && item[k] !== null) blank[k] = item[k];
          });
        }
        return blank;
      });
    });

    base.settings.margin = clamp(Number(base.settings.margin) || 15, 8, 25);
    if (['s', 'm', 'l'].indexOf(base.settings.size) === -1) base.settings.size = 'm';
    base.settings.showPhoto = base.settings.showPhoto !== false;
    base.personal.photoZoom = clamp(Number(base.personal.photoZoom) || 100, 100, 220);

    return base;
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  /* ---------- Persistência ---------- */
  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : null;
    } catch (err) {
      console.warn('[Vitae] não foi possível ler o currículo salvo:', err);
      return null;
    }
  }

  var saveTimer = null;
  var lastError = null;

  function saveNow(state) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
      lastError = null;
      return true;
    } catch (err) {
      // Cota estourada costuma ser a foto em base64.
      lastError = err;
      console.warn('[Vitae] não foi possível salvar:', err);
      return false;
    }
  }

  function save(state, onDone) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      var ok = saveNow(state);
      if (typeof onDone === 'function') onDone(ok, lastError);
    }, SAVE_DELAY);
  }

  function flush(state) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    return saveNow(state);
  }

  function clear() {
    try { global.localStorage.removeItem(KEY); } catch (err) { /* ignora */ }
  }

  /* ---------- Preferências de interface (tema, zoom) ---------- */
  function loadUI() {
    try { return JSON.parse(global.localStorage.getItem(KEY_UI)) || {}; }
    catch (err) { return {}; }
  }
  function saveUI(patch) {
    try {
      var next = Object.assign(loadUI(), patch);
      global.localStorage.setItem(KEY_UI, JSON.stringify(next));
    } catch (err) { /* ignora */ }
  }

  /* ---------- Import / export JSON ---------- */
  function toJSON(state) {
    return JSON.stringify(state, null, 2);
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result)); };
      reader.onerror = function () { reject(new Error('Não foi possível ler o arquivo.')); };
      reader.readAsText(file);
    });
  }

  function importJSON(text) {
    var parsed = JSON.parse(text); // deixa o erro subir: quem chama mostra a mensagem
    if (!parsed || typeof parsed !== 'object') throw new Error('Formato inesperado.');
    return normalize(parsed);
  }

  /* ---------- Currículo de exemplo ---------- */
  function sampleState() {
    var s = emptyState();
    s.personal = Object.assign(s.personal, {
      name: 'Ana Beatriz Moura',
      title: 'Analista de Marketing Digital',
      email: 'ana.moura@email.com',
      phone: '(13) 99999-0000',
      city: 'Santos, SP',
      linkedin: 'linkedin.com/in/anabmoura',
      website: 'anamoura.com.br'
    });
    s.summary = 'Analista de marketing com 6 anos em campanhas de performance para e-commerce. '
      + 'Já administrei verbas de até R$ 400 mil por mês em Google Ads e Meta Ads, com foco em '
      + 'reduzir o custo por aquisição sem perder volume. Gosto de trabalhar perto do time de '
      + 'produto e de decidir por dado, não por palpite.';
    s.experience = [
      {
        company: 'Loja Marear', role: 'Analista de marketing pleno',
        start: '03/2022', end: '', current: true,
        description: 'Reduzi o custo por aquisição em 34% em oito meses, ajustando públicos e criativos.\n'
          + 'Montei o painel de métricas que o time comercial usa toda segunda-feira.\n'
          + 'Coordenei duas campanhas de Black Friday com verba de R$ 400 mil/mês.'
      },
      {
        company: 'Agência Nortear', role: 'Assistente de mídia paga',
        start: '01/2020', end: '02/2022', current: false,
        description: 'Atendi 11 contas simultâneas de varejo e serviços.\n'
          + 'Criei o modelo de relatório mensal adotado pela agência inteira.'
      }
    ];
    s.education = [
      { school: 'Universidade Católica de Santos', course: 'Publicidade e Propaganda', level: 'Graduação', start: '2015', end: '2019' }
    ];
    s.skills = [
      { name: 'Google Ads', level: 5 },
      { name: 'Meta Ads', level: 5 },
      { name: 'Google Analytics 4', level: 4 },
      { name: 'SQL básico', level: 3 },
      { name: 'Looker Studio', level: 4 }
    ];
    s.languages = [
      { name: 'Português', level: 'Nativo' },
      { name: 'Inglês', level: 'Avançado' },
      { name: 'Espanhol', level: 'Intermediário' }
    ];
    s.courses = [
      { name: 'Google Ads Search Certification', org: 'Google Skillshop', year: '2024' },
      { name: 'Análise de dados com SQL', org: 'Alura', year: '2023' }
    ];
    s.custom = [
      { title: 'Voluntariado', content: 'Mentoria de marketing para pequenos negócios do Mercado do Peixe, em Santos (2023–2024).' }
    ];
    return s;
  }

  /* ---------- API pública ---------- */
  global.CVStorage = {
    KEY: KEY,
    emptyState: emptyState,
    sampleState: sampleState,
    blankItem: blankItem,
    normalize: normalize,
    load: load,
    save: save,
    flush: flush,
    clear: clear,
    loadUI: loadUI,
    saveUI: saveUI,
    toJSON: toJSON,
    importJSON: importJSON,
    readFile: readFile,
    download: download,
    clamp: clamp
  };
})(window);
