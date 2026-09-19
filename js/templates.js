/* =============================================================
   Vitae — modelos de currículo.
   Cada modelo devolve HTML + CSS próprios. Nada aqui toca o
   estado nem o DOM da aplicação: entra `state`, sai string.
   Exposto em window.CVTemplates.
   ============================================================= */
(function (global) {
  'use strict';

  /* ---------- utilitários de texto ---------- */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function has(value) {
    return typeof value === 'string' ? value.trim() !== '' : !!value;
  }

  /* Quebra a descrição em bullets: uma linha, um item. */
  function bullets(text) {
    if (!has(text)) return '';
    var lines = String(text).split(/\r?\n/)
      .map(function (l) { return l.replace(/^[-•*\u2022]\s*/, '').trim(); })
      .filter(function (l) { return l !== ''; });
    if (!lines.length) return '';
    return '<ul class="cv-bullets">' + lines.map(function (l) {
      return '<li>' + esc(l) + '</li>';
    }).join('') + '</ul>';
  }

  /* Parágrafos livres (seções customizadas). */
  function paragraphs(text) {
    if (!has(text)) return '';
    return String(text).split(/\r?\n+/).filter(function (l) { return l.trim(); })
      .map(function (l) { return '<p class="cv-p">' + esc(l.trim()) + '</p>'; }).join('');
  }

  function period(item) {
    var start = has(item.start) ? esc(item.start) : '';
    var end = item.current ? 'atual' : (has(item.end) ? esc(item.end) : '');
    if (start && end) return start + ' – ' + end;
    return start || end || '';
  }

  /* Listas não vazias: o modelo nunca imprime uma seção fantasma. */
  function filled(list, keys) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (item) {
      return keys.some(function (k) { return has(item[k]); });
    });
  }

  function contactItems(p) {
    var out = [];
    if (has(p.email)) out.push({ k: 'email', v: p.email });
    if (has(p.phone)) out.push({ k: 'phone', v: p.phone });
    if (has(p.city)) out.push({ k: 'city', v: p.city });
    if (has(p.linkedin)) out.push({ k: 'linkedin', v: p.linkedin });
    if (has(p.website)) out.push({ k: 'website', v: p.website });
    return out;
  }

  function photoTag(state, cls) {
    var p = state.personal;
    if (!state.settings.showPhoto || !has(p.photo)) return '';
    var zoom = Number(p.photoZoom) || 100;
    return '<div class="' + cls + '"><img src="' + esc(p.photo) + '" alt="Foto de '
      + esc(p.name || 'candidato') + '" style="transform:scale(' + (zoom / 100) + ')"></div>';
  }

  function levelDots(n, total) {
    var out = '';
    for (var i = 1; i <= (total || 5); i++) {
      out += '<span class="cv-dot' + (i <= n ? ' is-on' : '') + '"></span>';
    }
    return '<span class="cv-dots">' + out + '</span>';
  }

  function levelBar(n, total) {
    var pct = Math.round((n / (total || 5)) * 100);
    return '<span class="cv-bar"><span class="cv-bar__fill" style="width:' + pct + '%"></span></span>';
  }

  /* ---------- blocos reutilizáveis ---------- */

  function sectionTitle(text) {
    return '<h2 class="cv-section-title">' + esc(text) + '</h2>';
  }

  function experienceEntries(list, opts) {
    opts = opts || {};
    return list.map(function (item) {
      var head = '<div class="cv-entry__head">'
        + '<div><h3 class="cv-entry__role">' + esc(item.role || '') + '</h3>'
        + (has(item.company) ? '<p class="cv-entry__org">' + esc(item.company) + '</p>' : '')
        + '</div>'
        + (period(item) ? '<span class="cv-entry__when">' + period(item) + '</span>' : '')
        + '</div>';
      return '<article class="cv-entry' + (opts.timeline ? ' cv-entry--timeline' : '') + '">'
        + head + bullets(item.description) + '</article>';
    }).join('');
  }

  function educationEntries(list) {
    return list.map(function (item) {
      return '<article class="cv-entry">'
        + '<div class="cv-entry__head">'
        + '<div><h3 class="cv-entry__role">' + esc(item.course || '') + '</h3>'
        + '<p class="cv-entry__org">' + esc([item.school, item.level].filter(has).join(' · ')) + '</p></div>'
        + (period(item) ? '<span class="cv-entry__when">' + period(item) + '</span>' : '')
        + '</div></article>';
    }).join('');
  }

  function courseEntries(list) {
    return '<ul class="cv-plain">' + list.map(function (item) {
      var meta = [item.org, item.year].filter(has).map(esc).join(' · ');
      return '<li><strong>' + esc(item.name || '') + '</strong>'
        + (meta ? '<span class="cv-plain__meta">' + meta + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  function languageEntries(list) {
    return '<ul class="cv-plain">' + list.map(function (item) {
      return '<li><strong>' + esc(item.name || '') + '</strong>'
        + (has(item.level) ? '<span class="cv-plain__meta">' + esc(item.level) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  function skillList(list, style) {
    if (style === 'tags') {
      return '<div class="cv-tags">' + list.map(function (s) {
        return '<span class="cv-tag">' + esc(s.name) + '</span>';
      }).join('') + '</div>';
    }
    return '<ul class="cv-skills">' + list.map(function (s) {
      var gauge = style === 'dots' ? levelDots(s.level) : levelBar(s.level);
      return '<li class="cv-skill"><span class="cv-skill__name">' + esc(s.name) + '</span>' + gauge + '</li>';
    }).join('') + '</ul>';
  }

  function customBlocks(list) {
    return list.map(function (c) {
      return '<section class="cv-block">' + sectionTitle(c.title || 'Outros') + paragraphs(c.content) + '</section>';
    }).join('');
  }

  /* Coleta o conteúdo já filtrado uma única vez por render. */
  function collect(state) {
    return {
      personal: state.personal,
      summary: state.summary,
      experience: filled(state.experience, ['company', 'role', 'description']),
      education: filled(state.education, ['school', 'course']),
      skills: filled(state.skills, ['name']),
      languages: filled(state.languages, ['name']),
      courses: filled(state.courses, ['name']),
      custom: filled(state.custom, ['title', 'content']),
      contacts: contactItems(state.personal)
    };
  }

  function contactLine(contacts, sep) {
    return contacts.map(function (c) { return esc(c.v); }).join(sep || ' · ');
  }

  /* =============================================================
     CSS base — vale para todos os modelos.
     Medidas em mm/px reais: é este elemento que vira o PDF.
     ============================================================= */
  var BASE_CSS = [
    '.cv-page{',
    '  font-family: var(--cv-font);',
    '  font-size: var(--cv-fs);',
    '  line-height: 1.45;',
    '  color: #1e2124;',
    '  --cv-pad: var(--cv-margin);',
    '}',
    '.cv-page *{box-sizing:border-box;}',
    '.cv-page h1,.cv-page h2,.cv-page h3,.cv-page p,.cv-page ul{margin:0;padding:0;}',
    '.cv-page ul{list-style:none;}',
    '.cv-name{font-size:2.05em;line-height:1.08;font-weight:700;letter-spacing:-.015em;}',
    '.cv-role{font-size:1.06em;font-weight:500;}',
    '.cv-section-title{font-size:.86em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--cv-primary);margin-bottom:.55em;}',
    '.cv-block + .cv-block{margin-top:1.25em;}',
    '.cv-entry + .cv-entry{margin-top:.85em;}',
    '.cv-entry__head{display:flex;justify-content:space-between;align-items:baseline;gap:1em;}',
    '.cv-entry__role{font-size:1em;font-weight:700;}',
    '.cv-entry__org{font-size:.94em;color:#4a5057;}',
    '.cv-entry__when{font-size:.85em;color:#6b7178;white-space:nowrap;}',
    '.cv-bullets{margin-top:.35em;}',
    '.cv-bullets li{position:relative;padding-left:1em;margin-bottom:.16em;}',
    '.cv-bullets li::before{content:"";position:absolute;left:0;top:.62em;width:4px;height:4px;border-radius:50%;background:var(--cv-primary);}',
    '.cv-p + .cv-p{margin-top:.35em;}',
    '.cv-plain li{display:flex;justify-content:space-between;gap:.8em;margin-bottom:.22em;}',
    '.cv-plain strong{font-weight:600;}',
    '.cv-plain__meta{color:#6b7178;font-size:.9em;text-align:right;}',
    '.cv-skill{display:flex;align-items:center;justify-content:space-between;gap:.7em;margin-bottom:.34em;}',
    '.cv-skill__name{flex:1;min-width:0;}',
    '.cv-dots{display:flex;gap:3px;flex:none;}',
    '.cv-dot{width:6px;height:6px;border-radius:50%;background:rgba(0,0,0,.16);}',
    '.cv-dot.is-on{background:var(--cv-primary);}',
    '.cv-bar{flex:none;width:34%;height:4px;border-radius:2px;background:rgba(0,0,0,.12);overflow:hidden;}',
    '.cv-bar__fill{display:block;height:100%;background:var(--cv-primary);}',
    '.cv-tags{display:flex;flex-wrap:wrap;gap:.3em .4em;}',
    '.cv-tag{border:1px solid rgba(0,0,0,.16);border-radius:3px;padding:.12em .5em;font-size:.9em;}',
    '.cv-summary{color:#33383d;}',
    '.cv-photo img{width:100%;height:100%;object-fit:cover;display:block;}',
    '.cv-photo{overflow:hidden;background:rgba(0,0,0,.06);}'
  ].join('\n');

  /* =============================================================
     1. MODERNO — faixa colorida + coluna lateral
     ============================================================= */
  var moderno = {
    id: 'moderno',
    name: 'Moderno',
    tag: 'Faixa colorida e lateral',
    css: [
      '.cv--moderno .cv-head{background:var(--cv-primary);color:#fff;padding:calc(var(--cv-pad) * .72) var(--cv-pad);display:flex;align-items:center;gap:6mm;}',
      '.cv--moderno .cv-head__photo{width:26mm;height:26mm;border-radius:50%;border:2px solid rgba(255,255,255,.55);flex:none;}',
      '.cv--moderno .cv-head .cv-role{opacity:.9;margin-top:.15em;}',
      '.cv--moderno .cv-body{display:flex;align-items:stretch;min-height:calc(297mm - 42mm);}',
      '.cv--moderno .cv-aside{width:34%;flex:none;background:var(--cv-tint);padding:calc(var(--cv-pad) * .8) calc(var(--cv-pad) * .7);}',
      '.cv--moderno .cv-main{flex:1;min-width:0;padding:calc(var(--cv-pad) * .8) var(--cv-pad);}',
      '.cv--moderno .cv-contact li{margin-bottom:.32em;word-break:break-word;}',
      '.cv--moderno .cv-contact .cv-contact__k{display:block;font-size:.78em;color:var(--cv-secondary);letter-spacing:.04em;}'
    ].join('\n'),
    render: function (d, state) {
      var aside = '';
      if (d.contacts.length) {
        aside += '<section class="cv-block">' + sectionTitle('Contato')
          + '<ul class="cv-contact">' + d.contacts.map(function (c) {
            return '<li><span class="cv-contact__k">' + labelOf(c.k) + '</span>' + esc(c.v) + '</li>';
          }).join('') + '</ul></section>';
      }
      if (d.skills.length) aside += '<section class="cv-block">' + sectionTitle('Habilidades') + skillList(d.skills, 'bar') + '</section>';
      if (d.languages.length) aside += '<section class="cv-block">' + sectionTitle('Idiomas') + languageEntries(d.languages) + '</section>';
      if (d.courses.length) aside += '<section class="cv-block">' + sectionTitle('Cursos') + courseEntries(d.courses) + '</section>';

      var main = '';
      if (has(d.summary)) main += '<section class="cv-block">' + sectionTitle('Resumo') + '<p class="cv-summary">' + esc(d.summary) + '</p></section>';
      if (d.experience.length) main += '<section class="cv-block">' + sectionTitle('Experiência profissional') + experienceEntries(d.experience) + '</section>';
      if (d.education.length) main += '<section class="cv-block">' + sectionTitle('Formação acadêmica') + educationEntries(d.education) + '</section>';
      main += customBlocks(d.custom);

      return '<header class="cv-head">'
        + photoTag(state, 'cv-photo cv-head__photo')
        + '<div><h1 class="cv-name">' + esc(d.personal.name || 'Seu nome') + '</h1>'
        + (has(d.personal.title) ? '<p class="cv-role">' + esc(d.personal.title) + '</p>' : '')
        + '</div></header>'
        + '<div class="cv-body"><aside class="cv-aside">' + aside + '</aside>'
        + '<div class="cv-main">' + main + '</div></div>';
    }
  };

  function labelOf(key) {
    return { email: 'E-mail', phone: 'Telefone', city: 'Local', linkedin: 'LinkedIn', website: 'Site' }[key] || '';
  }

  /* =============================================================
     2. CLÁSSICO — coluna única, sem gráficos, legível por ATS
     ============================================================= */
  var classico = {
    id: 'classico',
    name: 'Clássico',
    tag: 'Aprovado por ATS',
    css: [
      '.cv--classico{padding:var(--cv-pad);}',
      '.cv--classico .cv-head{text-align:center;padding-bottom:.8em;border-bottom:1.5px solid #222;}',
      '.cv--classico .cv-name{font-size:1.9em;letter-spacing:0;}',
      '.cv--classico .cv-role{font-weight:600;color:#333;margin-top:.1em;}',
      '.cv--classico .cv-contactline{margin-top:.45em;font-size:.92em;color:#3a3f45;}',
      '.cv--classico .cv-block{margin-top:1.2em;}',
      '.cv--classico .cv-section-title{color:#111;border-bottom:1px solid #999;padding-bottom:.25em;letter-spacing:.06em;}',
      '.cv--classico .cv-bullets li::before{background:#444;}',
      '.cv--classico .cv-entry__when{color:#3a3f45;}'
    ].join('\n'),
    render: function (d) {
      var out = '<header class="cv-head"><h1 class="cv-name">' + esc(d.personal.name || 'Seu nome') + '</h1>'
        + (has(d.personal.title) ? '<p class="cv-role">' + esc(d.personal.title) + '</p>' : '')
        + (d.contacts.length ? '<p class="cv-contactline">' + contactLine(d.contacts, ' | ') + '</p>' : '')
        + '</header>';
      if (has(d.summary)) out += '<section class="cv-block">' + sectionTitle('Resumo profissional') + '<p class="cv-summary">' + esc(d.summary) + '</p></section>';
      if (d.experience.length) out += '<section class="cv-block">' + sectionTitle('Experiência profissional') + experienceEntries(d.experience) + '</section>';
      if (d.education.length) out += '<section class="cv-block">' + sectionTitle('Formação acadêmica') + educationEntries(d.education) + '</section>';
      if (d.skills.length) {
        out += '<section class="cv-block">' + sectionTitle('Habilidades') + '<p>'
          + d.skills.map(function (s) { return esc(s.name); }).join(', ') + '</p></section>';
      }
      if (d.languages.length) {
        out += '<section class="cv-block">' + sectionTitle('Idiomas') + '<p>'
          + d.languages.map(function (l) { return esc(l.name) + (has(l.level) ? ' (' + esc(l.level) + ')' : ''); }).join(', ')
          + '</p></section>';
      }
      if (d.courses.length) out += '<section class="cv-block">' + sectionTitle('Cursos e certificações') + courseEntries(d.courses) + '</section>';
      out += customBlocks(d.custom);
      return out;
    }
  };

  /* =============================================================
     3. CRIATIVO — foto sobreposta, linha do tempo, tags
     ============================================================= */
  var criativo = {
    id: 'criativo',
    name: 'Criativo',
    tag: 'Linha do tempo',
    css: [
      '.cv--criativo .cv-head{background:linear-gradient(120deg,var(--cv-primary),var(--cv-secondary));color:#fff;padding:calc(var(--cv-pad) * .9) var(--cv-pad) calc(var(--cv-pad) * .7);}',
      '.cv--criativo .cv-head__row{display:flex;gap:6mm;align-items:center;}',
      '.cv--criativo .cv-head__photo{width:28mm;height:28mm;border-radius:14px;flex:none;box-shadow:0 6px 18px rgba(0,0,0,.25);}',
      '.cv--criativo .cv-contactline{margin-top:.6em;font-size:.9em;opacity:.92;}',
      '.cv--criativo .cv-main{padding:calc(var(--cv-pad) * .85) var(--cv-pad);}',
      '.cv--criativo .cv-cols{display:flex;gap:7mm;margin-top:1.25em;}',
      '.cv--criativo .cv-cols > *{flex:1;min-width:0;}',
      '.cv--criativo .cv-timeline{position:relative;padding-left:5.5mm;border-left:2px solid var(--cv-tint-strong);}',
      '.cv--criativo .cv-entry--timeline{position:relative;}',
      '.cv--criativo .cv-entry--timeline::before{content:"";position:absolute;left:-6.9mm;top:.42em;width:7px;height:7px;border-radius:50%;background:var(--cv-primary);box-shadow:0 0 0 3px #fff;}',
      '.cv--criativo .cv-entry + .cv-entry{margin-top:1em;}',
      '.cv--criativo .cv-tag{background:var(--cv-tint);border-color:transparent;color:var(--cv-secondary);border-radius:999px;padding:.18em .7em;}'
    ].join('\n'),
    render: function (d, state) {
      var out = '<header class="cv-head"><div class="cv-head__row">'
        + photoTag(state, 'cv-photo cv-head__photo')
        + '<div><h1 class="cv-name">' + esc(d.personal.name || 'Seu nome') + '</h1>'
        + (has(d.personal.title) ? '<p class="cv-role">' + esc(d.personal.title) + '</p>' : '')
        + (d.contacts.length ? '<p class="cv-contactline">' + contactLine(d.contacts) + '</p>' : '')
        + '</div></div></header><div class="cv-main">';

      if (has(d.summary)) out += '<section class="cv-block">' + sectionTitle('Sobre') + '<p class="cv-summary">' + esc(d.summary) + '</p></section>';
      if (d.experience.length) {
        out += '<section class="cv-block">' + sectionTitle('Trajetória')
          + '<div class="cv-timeline">' + experienceEntries(d.experience, { timeline: true }) + '</div></section>';
      }

      var colA = '', colB = '';
      if (d.education.length) colA += '<section class="cv-block">' + sectionTitle('Formação') + educationEntries(d.education) + '</section>';
      if (d.courses.length) colA += '<section class="cv-block">' + sectionTitle('Cursos') + courseEntries(d.courses) + '</section>';
      if (d.skills.length) colB += '<section class="cv-block">' + sectionTitle('Habilidades') + skillList(d.skills, 'tags') + '</section>';
      if (d.languages.length) colB += '<section class="cv-block">' + sectionTitle('Idiomas') + languageEntries(d.languages) + '</section>';
      if (colA || colB) out += '<div class="cv-cols"><div>' + colA + '</div><div>' + colB + '</div></div>';

      out += customBlocks(d.custom) + '</div>';
      return out;
    }
  };

  /* =============================================================
     4. MINIMALISTA — respiro, título da seção na coluna estreita
     ============================================================= */
  var minimalista = {
    id: 'minimalista',
    name: 'Minimalista',
    tag: 'Espaço e tipografia',
    css: [
      '.cv--minimalista{padding:calc(var(--cv-pad) * 1.5) calc(var(--cv-pad) * 1.15);}',
      '.cv--minimalista .cv-head{display:flex;gap:7mm;align-items:flex-end;margin-bottom:2.2em;}',
      '.cv--minimalista .cv-head__photo{width:24mm;height:24mm;border-radius:50%;flex:none;}',
      '.cv--minimalista .cv-name{font-size:2.6em;font-weight:600;letter-spacing:-.03em;}',
      '.cv--minimalista .cv-role{color:var(--cv-primary);font-weight:500;margin-top:.2em;}',
      '.cv--minimalista .cv-contactline{margin-top:.7em;font-size:.88em;color:#63696f;}',
      '.cv--minimalista .cv-block{display:flex;gap:6mm;padding-top:1.4em;border-top:1px solid #e8e6e0;margin-top:1.4em;}',
      '.cv--minimalista .cv-block:first-of-type{border-top:0;margin-top:0;padding-top:0;}',
      '.cv--minimalista .cv-section-title{flex:none;width:30mm;text-transform:none;letter-spacing:0;font-size:.92em;font-weight:600;color:#9aa0a6;margin:0;}',
      '.cv--minimalista .cv-block > :not(.cv-section-title){flex:1;min-width:0;}',
      '.cv--minimalista .cv-bullets li::before{background:#c2c6ca;}',
      '.cv--minimalista .cv-entry + .cv-entry{margin-top:1.1em;}'
    ].join('\n'),
    render: function (d, state) {
      function block(title, body) {
        return body ? '<section class="cv-block">' + sectionTitle(title) + '<div>' + body + '</div></section>' : '';
      }
      var out = '<header class="cv-head">'
        + photoTag(state, 'cv-photo cv-head__photo')
        + '<div><h1 class="cv-name">' + esc(d.personal.name || 'Seu nome') + '</h1>'
        + (has(d.personal.title) ? '<p class="cv-role">' + esc(d.personal.title) + '</p>' : '')
        + (d.contacts.length ? '<p class="cv-contactline">' + contactLine(d.contacts) + '</p>' : '')
        + '</div></header>';

      out += block('Resumo', has(d.summary) ? '<p class="cv-summary">' + esc(d.summary) + '</p>' : '');
      out += block('Experiência', d.experience.length ? experienceEntries(d.experience) : '');
      out += block('Formação', d.education.length ? educationEntries(d.education) : '');
      out += block('Habilidades', d.skills.length ? skillList(d.skills, 'tags') : '');
      out += block('Idiomas', d.languages.length ? languageEntries(d.languages) : '');
      out += block('Cursos', d.courses.length ? courseEntries(d.courses) : '');
      d.custom.forEach(function (c) { out += block(c.title || 'Outros', paragraphs(c.content)); });
      return out;
    }
  };

  /* =============================================================
     5. EXECUTIVO — sóbrio, centrado, para cargos sênior
     ============================================================= */
  var executivo = {
    id: 'executivo',
    name: 'Executivo',
    tag: 'Sênior e gerencial',
    css: [
      '.cv--executivo{padding:var(--cv-pad);}',
      '.cv--executivo .cv-head{display:flex;gap:6mm;align-items:center;border-bottom:3px double var(--cv-primary);padding-bottom:1em;}',
      '.cv--executivo .cv-head__photo{width:25mm;height:25mm;border-radius:4px;flex:none;}',
      '.cv--executivo .cv-head__text{flex:1;min-width:0;}',
      '.cv--executivo .cv-name{font-size:2.15em;font-weight:600;color:var(--cv-secondary);}',
      '.cv--executivo .cv-role{color:var(--cv-primary);font-weight:600;letter-spacing:.02em;}',
      '.cv--executivo .cv-contactline{margin-top:.5em;font-size:.88em;color:#5b6167;}',
      '.cv--executivo .cv-block{margin-top:1.25em;}',
      '.cv--executivo .cv-section-title{border-left:3px solid var(--cv-primary);padding-left:.6em;color:var(--cv-secondary);}',
      '.cv--executivo .cv-entry__role{color:var(--cv-secondary);}',
      '.cv--executivo .cv-foot{display:flex;gap:7mm;margin-top:1.25em;}',
      '.cv--executivo .cv-foot > *{flex:1;min-width:0;margin-top:0;}'
    ].join('\n'),
    render: function (d, state) {
      var out = '<header class="cv-head">'
        + photoTag(state, 'cv-photo cv-head__photo')
        + '<div class="cv-head__text"><h1 class="cv-name">' + esc(d.personal.name || 'Seu nome') + '</h1>'
        + (has(d.personal.title) ? '<p class="cv-role">' + esc(d.personal.title) + '</p>' : '')
        + (d.contacts.length ? '<p class="cv-contactline">' + contactLine(d.contacts, ' · ') + '</p>' : '')
        + '</div></header>';

      if (has(d.summary)) out += '<section class="cv-block">' + sectionTitle('Perfil executivo') + '<p class="cv-summary">' + esc(d.summary) + '</p></section>';
      if (d.experience.length) out += '<section class="cv-block">' + sectionTitle('Experiência') + experienceEntries(d.experience) + '</section>';
      if (d.education.length) out += '<section class="cv-block">' + sectionTitle('Formação') + educationEntries(d.education) + '</section>';

      var a = d.skills.length ? '<section class="cv-block">' + sectionTitle('Competências') + skillList(d.skills, 'dots') + '</section>' : '';
      var b = '';
      if (d.languages.length) b += '<section class="cv-block">' + sectionTitle('Idiomas') + languageEntries(d.languages) + '</section>';
      if (d.courses.length) b += '<section class="cv-block">' + sectionTitle('Certificações') + courseEntries(d.courses) + '</section>';
      if (a || b) out += '<div class="cv-foot"><div>' + a + '</div><div>' + b + '</div></div>';

      out += customBlocks(d.custom);
      return out;
    }
  };

  /* =============================================================
     6. COMPACTO — duas colunas densas, para currículo longo
     ============================================================= */
  var compacto = {
    id: 'compacto',
    name: 'Compacto',
    tag: 'Muito conteúdo',
    css: [
      '.cv--compacto{padding:calc(var(--cv-pad) * .85);font-size:calc(var(--cv-fs) * .94);line-height:1.38;}',
      '.cv--compacto .cv-head{display:flex;gap:5mm;align-items:center;background:var(--cv-tint);padding:4mm 5mm;border-radius:3px;}',
      '.cv--compacto .cv-head__photo{width:20mm;height:20mm;border-radius:50%;flex:none;}',
      '.cv--compacto .cv-name{font-size:1.75em;}',
      '.cv--compacto .cv-role{color:var(--cv-primary);font-weight:600;font-size:1em;}',
      '.cv--compacto .cv-contactline{font-size:.86em;color:#5b6167;margin-top:.3em;}',
      '.cv--compacto .cv-grid{display:flex;gap:6mm;margin-top:1.1em;}',
      '.cv--compacto .cv-col--main{flex:1.72;min-width:0;}',
      '.cv--compacto .cv-col--side{flex:1;min-width:0;}',
      '.cv--compacto .cv-block + .cv-block{margin-top:1em;}',
      '.cv--compacto .cv-section-title{font-size:.8em;margin-bottom:.4em;border-bottom:1px solid var(--cv-tint-strong);padding-bottom:.2em;}',
      '.cv--compacto .cv-entry + .cv-entry{margin-top:.65em;}',
      '.cv--compacto .cv-bullets li{margin-bottom:.1em;}'
    ].join('\n'),
    render: function (d, state) {
      var main = '';
      if (has(d.summary)) main += '<section class="cv-block">' + sectionTitle('Resumo') + '<p class="cv-summary">' + esc(d.summary) + '</p></section>';
      if (d.experience.length) main += '<section class="cv-block">' + sectionTitle('Experiência') + experienceEntries(d.experience) + '</section>';
      main += customBlocks(d.custom);

      var side = '';
      if (d.education.length) side += '<section class="cv-block">' + sectionTitle('Formação') + educationEntries(d.education) + '</section>';
      if (d.skills.length) side += '<section class="cv-block">' + sectionTitle('Habilidades') + skillList(d.skills, 'dots') + '</section>';
      if (d.languages.length) side += '<section class="cv-block">' + sectionTitle('Idiomas') + languageEntries(d.languages) + '</section>';
      if (d.courses.length) side += '<section class="cv-block">' + sectionTitle('Cursos') + courseEntries(d.courses) + '</section>';

      return '<header class="cv-head">'
        + photoTag(state, 'cv-photo cv-head__photo')
        + '<div><h1 class="cv-name">' + esc(d.personal.name || 'Seu nome') + '</h1>'
        + (has(d.personal.title) ? '<p class="cv-role">' + esc(d.personal.title) + '</p>' : '')
        + (d.contacts.length ? '<p class="cv-contactline">' + contactLine(d.contacts) + '</p>' : '')
        + '</div></header>'
        + '<div class="cv-grid"><div class="cv-col--main">' + main + '</div>'
        + '<div class="cv-col--side">' + side + '</div></div>';
    }
  };

  var ALL = [moderno, classico, criativo, minimalista, executivo, compacto];

  var BY_ID = ALL.reduce(function (acc, t) { acc[t.id] = t; return acc; }, {});

  /* ---------- miniaturas dos modelos (SVG, herdam a cor escolhida) ---------- */
  function thumb(id, primary) {
    var p = esc(primary);
    var g = '#d8d6d0';
    var parts = {
      moderno: '<rect width="70" height="20" fill="' + p + '"/><circle cx="14" cy="10" r="6" fill="#fff" opacity=".7"/><rect x="24" y="6" width="30" height="4" fill="#fff"/><rect x="24" y="13" width="20" height="3" fill="#fff" opacity=".65"/>'
        + '<rect y="20" width="24" height="79" fill="' + p + '" opacity=".13"/>'
        + '<rect x="4" y="26" width="16" height="3" fill="' + p + '"/><rect x="4" y="33" width="14" height="2.5" fill="' + g + '"/><rect x="4" y="38" width="16" height="2.5" fill="' + g + '"/><rect x="4" y="48" width="16" height="3" fill="' + p + '"/><rect x="4" y="55" width="12" height="2.5" fill="' + g + '"/>'
        + '<rect x="29" y="26" width="20" height="3" fill="' + p + '"/><rect x="29" y="33" width="36" height="2.5" fill="' + g + '"/><rect x="29" y="38" width="32" height="2.5" fill="' + g + '"/><rect x="29" y="48" width="22" height="3" fill="' + p + '"/><rect x="29" y="55" width="36" height="2.5" fill="' + g + '"/><rect x="29" y="60" width="30" height="2.5" fill="' + g + '"/><rect x="29" y="70" width="20" height="3" fill="' + p + '"/><rect x="29" y="77" width="34" height="2.5" fill="' + g + '"/>',
      classico: '<rect x="20" y="8" width="30" height="4.5" fill="#333"/><rect x="26" y="16" width="18" height="2.5" fill="#888"/><rect x="18" y="22" width="34" height="1.6" fill="#aaa"/><rect x="8" y="30" width="54" height="1.6" fill="#333"/>'
        + '<rect x="8" y="35" width="20" height="3" fill="#333"/><rect x="8" y="42" width="54" height="2.4" fill="' + g + '"/><rect x="8" y="47" width="48" height="2.4" fill="' + g + '"/><rect x="8" y="56" width="22" height="3" fill="#333"/><rect x="8" y="63" width="54" height="2.4" fill="' + g + '"/><rect x="8" y="68" width="50" height="2.4" fill="' + g + '"/><rect x="8" y="77" width="18" height="3" fill="#333"/><rect x="8" y="84" width="46" height="2.4" fill="' + g + '"/>',
      criativo: '<rect width="70" height="26" fill="' + p + '"/><rect x="6" y="6" width="14" height="14" rx="4" fill="#fff" opacity=".75"/><rect x="25" y="8" width="30" height="4" fill="#fff"/><rect x="25" y="15" width="22" height="3" fill="#fff" opacity=".7"/>'
        + '<rect x="10" y="34" width="1.6" height="34" fill="' + p + '" opacity=".4"/><circle cx="10.8" cy="38" r="2.6" fill="' + p + '"/><circle cx="10.8" cy="54" r="2.6" fill="' + p + '"/>'
        + '<rect x="17" y="36" width="30" height="2.8" fill="#555"/><rect x="17" y="42" width="44" height="2.2" fill="' + g + '"/><rect x="17" y="52" width="26" height="2.8" fill="#555"/><rect x="17" y="58" width="42" height="2.2" fill="' + g + '"/>'
        + '<rect x="8" y="76" width="16" height="6" rx="3" fill="' + p + '" opacity=".2"/><rect x="27" y="76" width="20" height="6" rx="3" fill="' + p + '" opacity=".2"/><rect x="50" y="76" width="13" height="6" rx="3" fill="' + p + '" opacity=".2"/>',
      minimalista: '<rect x="10" y="14" width="40" height="6" fill="#2b2f33"/><rect x="10" y="24" width="24" height="3" fill="' + p + '"/>'
        + '<rect x="10" y="38" width="52" height="1" fill="#e6e4de"/><rect x="10" y="44" width="14" height="2.6" fill="#a9aeb3"/><rect x="30" y="44" width="32" height="2.4" fill="' + g + '"/><rect x="30" y="49" width="28" height="2.4" fill="' + g + '"/>'
        + '<rect x="10" y="60" width="52" height="1" fill="#e6e4de"/><rect x="10" y="66" width="14" height="2.6" fill="#a9aeb3"/><rect x="30" y="66" width="32" height="2.4" fill="' + g + '"/><rect x="30" y="71" width="24" height="2.4" fill="' + g + '"/>'
        + '<rect x="10" y="82" width="52" height="1" fill="#e6e4de"/><rect x="10" y="88" width="14" height="2.6" fill="#a9aeb3"/><rect x="30" y="88" width="26" height="2.4" fill="' + g + '"/>',
      executivo: '<rect x="8" y="8" width="14" height="14" fill="' + p + '" opacity=".25"/><rect x="27" y="9" width="32" height="5" fill="#2b2f33"/><rect x="27" y="17" width="20" height="3" fill="' + p + '"/><rect x="8" y="28" width="54" height="2" fill="' + p + '"/>'
        + '<rect x="8" y="36" width="2" height="4" fill="' + p + '"/><rect x="13" y="36" width="20" height="3" fill="#2b2f33"/><rect x="8" y="44" width="54" height="2.4" fill="' + g + '"/><rect x="8" y="49" width="48" height="2.4" fill="' + g + '"/>'
        + '<rect x="8" y="58" width="2" height="4" fill="' + p + '"/><rect x="13" y="58" width="22" height="3" fill="#2b2f33"/><rect x="8" y="66" width="54" height="2.4" fill="' + g + '"/>'
        + '<rect x="8" y="78" width="24" height="2.6" fill="#2b2f33"/><rect x="38" y="78" width="24" height="2.6" fill="#2b2f33"/><rect x="8" y="84" width="24" height="2.2" fill="' + g + '"/><rect x="38" y="84" width="24" height="2.2" fill="' + g + '"/>',
      compacto: '<rect x="5" y="5" width="60" height="16" fill="' + p + '" opacity=".14"/><circle cx="14" cy="13" r="5.5" fill="' + p + '" opacity=".4"/><rect x="23" y="9" width="26" height="3.5" fill="#2b2f33"/><rect x="23" y="15" width="18" height="2.4" fill="' + p + '"/>'
        + '<rect x="5" y="27" width="18" height="2.4" fill="' + p + '"/><rect x="5" y="32" width="36" height="2" fill="' + g + '"/><rect x="5" y="36" width="33" height="2" fill="' + g + '"/><rect x="5" y="40" width="36" height="2" fill="' + g + '"/><rect x="5" y="47" width="16" height="2.4" fill="' + p + '"/><rect x="5" y="52" width="36" height="2" fill="' + g + '"/><rect x="5" y="56" width="30" height="2" fill="' + g + '"/><rect x="5" y="60" width="34" height="2" fill="' + g + '"/><rect x="5" y="64" width="28" height="2" fill="' + g + '"/>'
        + '<rect x="46" y="27" width="14" height="2.4" fill="' + p + '"/><rect x="46" y="32" width="19" height="2" fill="' + g + '"/><rect x="46" y="36" width="16" height="2" fill="' + g + '"/><rect x="46" y="43" width="14" height="2.4" fill="' + p + '"/><rect x="46" y="48" width="19" height="2" fill="' + g + '"/><rect x="46" y="52" width="17" height="2" fill="' + g + '"/><rect x="46" y="56" width="19" height="2" fill="' + g + '"/>'
    };
    return '<svg viewBox="0 0 70 99" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">'
      + '<rect width="70" height="99" fill="#fff"/>' + (parts[id] || '') + '</svg>';
  }

  /* ---------- pilha de fontes com fallback ---------- */
  var FONT_STACKS = {
    'Inter': '"Inter", system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
    'Lato': '"Lato", "Trebuchet MS", system-ui, Arial, sans-serif',
    'Poppins': '"Poppins", "Century Gothic", system-ui, Arial, sans-serif',
    'Source Serif 4': '"Source Serif 4", "Source Serif Pro", Georgia, "Times New Roman", serif',
    'Merriweather': '"Merriweather", Georgia, "Times New Roman", serif',
    'Georgia': 'Georgia, "Times New Roman", "Liberation Serif", serif'
  };

  var SIZE_PX = { s: 12.3, m: 13.3, l: 14.4 };

  /* ---------- API pública ---------- */
  function render(state) {
    var tpl = BY_ID[state.settings.template] || moderno;
    var data = collect(state);
    return {
      id: tpl.id,
      className: 'cv--' + tpl.id,
      html: tpl.render(data, state),
      css: BASE_CSS + '\n' + tpl.css
    };
  }

  global.CVTemplates = {
    list: ALL.map(function (t) { return { id: t.id, name: t.name, tag: t.tag }; }),
    thumb: thumb,
    render: render,
    fontStack: function (name) { return FONT_STACKS[name] || FONT_STACKS.Inter; },
    fontSize: function (size) { return (SIZE_PX[size] || SIZE_PX.m) + 'px'; },
    escape: esc
  };
})(window);
