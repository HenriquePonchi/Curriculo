/* =============================================================
   Vitae — exportação em PDF.
   Estratégia: rasterizar a própria folha do preview com
   html2canvas e fatiar a imagem em páginas A4 no jsPDF. O corte
   procura uma faixa de pixels vazia perto do limite da página,
   para não partir uma linha de texto ao meio.
   Exposto em window.CVPdf.
   ============================================================= */
(function (global) {
  'use strict';

  var MM_PER_PAGE_W = 210;
  var MM_PER_PAGE_H = 297;

  /* Nome do arquivo: curriculo-nome-da-pessoa.pdf */
  function slugify(name) {
    var base = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return base || 'sem-nome';
  }

  function fileName(state) {
    return 'curriculo-' + slugify(state.personal && state.personal.name) + '.pdf';
  }

  /* Escala de rasterização: nitidez sem estourar a memória do celular. */
  function pickScale(pageEl) {
    var dpr = global.devicePixelRatio || 1;
    var wanted = Math.max(2, Math.min(3, dpr * 1.5));
    var area = pageEl.offsetWidth * pageEl.offsetHeight * wanted * wanted;
    // Safari em iOS trava acima de ~16M px por canvas.
    var maxArea = 16000000;
    if (area > maxArea) wanted = Math.max(1.5, Math.sqrt(maxArea / (pageEl.offsetWidth * pageEl.offsetHeight)));
    return wanted;
  }

  /* Constrói uma cópia da folha fora da tela, sem transformações
     de zoom nem as guias de quebra, para virar imagem. */
  function buildClone(pageEl) {
    var host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;background:#fff;';

    var clone = pageEl.cloneNode(true);
    clone.style.transform = 'none';
    clone.style.boxShadow = 'none';
    clone.style.margin = '0';
    Array.prototype.forEach.call(clone.querySelectorAll('.cv-page__break'), function (el) {
      el.parentNode.removeChild(el);
    });

    host.appendChild(clone);
    document.body.appendChild(host);
    return { host: host, clone: clone };
  }

  /* Procura, subindo a partir de `target`, uma linha de pixels
     praticamente uniforme — ou seja, sem texto atravessando. */
  function findBreakRow(ctx, canvasW, target, minRow, window_) {
    var limit = Math.max(minRow + 20, target - window_);
    var step = 2;
    var sampleCount = 60;

    for (var y = target; y > limit; y -= step) {
      if (isRowClear(ctx, canvasW, y, sampleCount)) {
        // Confirma que a vizinhança também está limpa (evita cortar
        // no vão entre duas linhas de um mesmo parágrafo).
        if (isRowClear(ctx, canvasW, y - 2, sampleCount) && isRowClear(ctx, canvasW, y - 4, sampleCount)) {
          return y;
        }
      }
    }
    return target; // nada limpo por perto: corta no limite mesmo
  }

  /* Uma linha é "limpa" quando a cor quase não muda ao longo dela.
     Faixas laterais coloridas (sidebar) provocam poucos saltos e são
     aceitas; texto provoca muitos e reprova a linha. */
  function isRowClear(ctx, canvasW, y, samples) {
    if (y < 1) return false;
    var data;
    try {
      data = ctx.getImageData(0, y, canvasW, 1).data;
    } catch (err) {
      return false; // canvas manchado por imagem externa: sem corte fino
    }

    var stepX = Math.max(1, Math.floor(canvasW / samples));
    var jumps = 0;
    var prev = null;

    for (var x = 0; x < canvasW; x += stepX) {
      var i = x * 4;
      var r = data[i], g = data[i + 1], b = data[i + 2];
      if (prev) {
        if (Math.abs(r - prev[0]) > 14 || Math.abs(g - prev[1]) > 14 || Math.abs(b - prev[2]) > 14) {
          jumps++;
          if (jumps > 3) return false;
        }
      }
      prev = [r, g, b];
    }
    return true;
  }

  /* Recorta um trecho vertical do canvas em um canvas novo. */
  function sliceCanvas(source, top, height) {
    var out = document.createElement('canvas');
    out.width = source.width;
    out.height = height;
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, 0, top, source.width, height, 0, 0, source.width, height);
    return out;
  }

  function ready() {
    return !!(global.html2canvas && global.jspdf && global.jspdf.jsPDF);
  }

  /* Conta quantas páginas A4 o conteúdo atual ocupa (para a interface). */
  function pageCount(pageEl) {
    var pxPerMm = pageEl.offsetWidth / MM_PER_PAGE_W;
    var pageH = MM_PER_PAGE_H * pxPerMm;
    return Math.max(1, Math.ceil((pageEl.scrollHeight - 2) / pageH));
  }

  /**
   * Gera e baixa o PDF.
   * @param {HTMLElement} pageEl elemento .cv-page do preview
   * @param {Object} state estado do currículo (para o nome do arquivo)
   * @returns {Promise<{pages:number,file:string}>}
   */
  function exportPdf(pageEl, state) {
    if (!ready()) {
      return Promise.reject(new Error('As bibliotecas de PDF não carregaram. Verifique a conexão e recarregue a página.'));
    }

    var built = buildClone(pageEl);
    var scale = pickScale(pageEl);

    var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();

    return fontsReady
      .then(function () {
        return global.html2canvas(built.clone, {
          scale: scale,
          backgroundColor: '#ffffff',
          useCORS: true,
          allowTaint: false,
          logging: false,
          windowWidth: built.clone.offsetWidth,
          scrollX: 0,
          scrollY: 0
        });
      })
      .then(function (canvas) {
        var JsPDF = global.jspdf.jsPDF;
        var pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

        var pxPerMm = canvas.width / MM_PER_PAGE_W;
        var fullPageH = Math.floor(MM_PER_PAGE_H * pxPerMm);
        var searchWindow = Math.floor(fullPageH * 0.12); // até 12% da página procurando respiro

        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        var offset = 0;
        var pages = 0;
        var remaining = canvas.height;

        while (remaining > 1) {
          var sliceH;
          if (remaining <= fullPageH + 4) {
            sliceH = remaining;
          } else {
            var target = offset + fullPageH;
            var cut = findBreakRow(ctx, canvas.width, target, offset, searchWindow);
            sliceH = cut - offset;
            if (sliceH < fullPageH * 0.5) sliceH = fullPageH; // corte absurdo: ignora
          }

          var piece = sliceCanvas(canvas, offset, Math.min(sliceH, remaining));
          var imgH = (piece.height / pxPerMm);
          if (pages > 0) pdf.addPage();
          pdf.addImage(piece.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, MM_PER_PAGE_W, imgH, undefined, 'FAST');

          offset += piece.height;
          remaining -= piece.height;
          pages++;

          if (pages > 20) break; // trava de segurança
        }

        var name = fileName(state);
        pdf.save(name);
        return { pages: pages, file: name };
      })
      .then(function (result) {
        cleanup(built);
        return result;
      })
      .catch(function (err) {
        cleanup(built);
        throw err;
      });
  }

  function cleanup(built) {
    if (built && built.host && built.host.parentNode) built.host.parentNode.removeChild(built.host);
  }

  global.CVPdf = {
    exportPdf: exportPdf,
    pageCount: pageCount,
    fileName: fileName,
    slugify: slugify,
    ready: ready
  };
})(window);
