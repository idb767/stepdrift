/* StepDrift · 三层结构化渲染：步骤指纹 / 偏航点定位 / 错因归档 */
window.SD = window.SD || {};

SD.render = (function () {
  'use strict';

  var STATUS = {
    pass:     { label: '通过',       color: '#2B6A56' },
    fail:     { label: '不成立',     color: '#AE3B2B' },
    doubt:    { label: '存疑',       color: '#9C7326' },
    unknown:  { label: '未判定',     color: '#8A857C' },
    affected: { label: '受上游影响', color: '#8A857C' }
  };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function results(root, analysis, archive) {
    root.innerHTML = '';

    /* ===== 判定摘要（结构化一句话，非聊天式评价） ===== */
    var summary = el('div', 'summary-line');
    summary.textContent = analysis.summary;
    root.appendChild(summary);

    /* ===== 第一层 · 步骤指纹 ===== */
    var sec1 = el('section', 'layer');
    sec1.appendChild(el('h2', 'layer-title', '第一层 · 步骤指纹'));

    var strip = el('div', 'strip');
    analysis.steps.forEach(function (s) {
      var cell = el('div', 'cell cell-' + s.status);
      cell.title = '第 ' + s.index + ' 步：' + STATUS[s.status].label;
      cell.textContent = s.index;
      strip.appendChild(cell);
    });
    sec1.appendChild(strip);

    var legend = el('div', 'legend');
    [['pass', '通过'], ['fail', '不成立'], ['doubt', '存疑'], ['unknown', '未判定'], ['affected', '受上游影响']]
      .forEach(function (pair) {
        var item = el('span', 'legend-item');
        item.appendChild(el('i', 'cell cell-' + pair[0]));
        item.appendChild(document.createTextNode(pair[1]));
        legend.appendChild(item);
      });
    sec1.appendChild(legend);

    var timeline = el('div', 'timeline');
    analysis.steps.forEach(function (s) {
      var row = el('div', 'tl-row tl-' + s.status);
      row.id = 'step-' + s.index;

      var dot = el('div', 'tl-dot', String(s.index));
      row.appendChild(dot);

      var body = el('div', 'tl-body');
      var head = el('div', 'tl-head');
      var raw = el('div', 'tl-raw');
      raw.innerHTML = SD.latex.renderInline(s.raw);
      head.appendChild(raw);
      body.appendChild(head);

      var meta = el('div', 'tl-meta');
      var badge = el('span', 'badge badge-' + s.status, STATUS[s.status].label);
      meta.appendChild(badge);
      s.driftIds.forEach(function (anchor) {
        var card = analysis.cards.filter(function (c) { return c.anchor === anchor; })[0];
        var tag = el('button', 'drift-tag', card ? card.driftId : '偏航点');
        tag.type = 'button';
        tag.addEventListener('click', function () {
          var target = document.getElementById(anchor);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        meta.appendChild(tag);
      });
      body.appendChild(meta);

      if (s.checks.length) {
        var ul = el('ul', 'checks');
        s.checks.forEach(function (c) {
          var li = el('li');
          li.innerHTML = SD.latex.renderInline(c);
          ul.appendChild(li);
        });
        body.appendChild(ul);
      }
      row.appendChild(body);
      timeline.appendChild(row);
    });
    sec1.appendChild(timeline);
    root.appendChild(sec1);

    /* ===== 第二层 · 偏航点定位 ===== */
    var sec2 = el('section', 'layer');
    sec2.appendChild(el('h2', 'layer-title', '第二层 · 偏航点定位'));
    if (!analysis.cards.length) {
      sec2.appendChild(el('p', 'muted', '本次未定位到偏航点。未判定的步骤不代表正确。'));
    }
    analysis.cards.forEach(function (card) {
      var box = el('article', 'drift-card');
      box.id = card.anchor;

      var top = el('div', 'drift-top');
      top.appendChild(el('span', 'drift-id', card.driftId));
      top.appendChild(el('span', 'drift-locate', card.locate));
      top.appendChild(el('span', 'drift-tag-label', card.tag));
      box.appendChild(top);

      box.appendChild(el('h3', 'drift-title', card.title));
      box.appendChild(el('p', 'drift-diagnosis', card.diagnosis));

      var gap = el('div', 'gap-block');
      gap.appendChild(el('span', 'gap-label', '缺的条件'));
      gap.appendChild(el('p', null, card.gap));
      box.appendChild(gap);

      var ev = el('div', 'evidence');
      card.evidence.forEach(function (line) {
        var p = el('p', 'evidence-line');
        p.innerHTML = SD.latex.renderInline(line);
        ev.appendChild(p);
      });
      box.appendChild(ev);

      var det = el('details', 'theorem');
      det.appendChild(el('summary', null, '定理卡片'));
      var tb = el('div', 'theorem-body');
      tb.appendChild(el('p', 'theorem-core', card.theorem.core));
      tb.appendChild(el('p', 'theorem-sub', '需要同时满足的条件'));
      var ul = el('ul');
      card.theorem.conditions.forEach(function (c) { ul.appendChild(el('li', null, c)); });
      tb.appendChild(ul);
      tb.appendChild(el('p', 'theorem-sub', '反例'));
      tb.appendChild(el('p', null, card.theorem.counterexample));
      tb.appendChild(el('p', 'theorem-sub', '怎么修'));
      tb.appendChild(el('p', null, card.theorem.fix));
      det.appendChild(tb);
      box.appendChild(det);

      sec2.appendChild(box);
    });
    root.appendChild(sec2);

    /* ===== 第三层 · 错因归档 ===== */
    var sec3 = el('section', 'layer');
    sec3.appendChild(el('h2', 'layer-title', '第三层 · 错因归档'));
    sec3.appendChild(el('p', 'muted', '本机累计检查 ' + archive.runs + ' 次（localStorage，仅本机，无需登录）'));

    var max = 1;
    SD.archive.CATEGORIES.forEach(function (c) { max = Math.max(max, archive.tags[c] || 0); });

    var heat = el('div', 'heat');
    SD.archive.CATEGORIES.forEach(function (cat) {
      var total = archive.tags[cat] || 0;
      var cur = archive.current[cat] || 0;
      var row = el('div', 'heat-row');
      row.appendChild(el('span', 'heat-name', cat));
      var track = el('div', 'heat-track');
      var bar = el('div', 'heat-bar' + (cur ? ' heat-bar-hit' : ''));
      bar.style.width = Math.round(total / max * 100) + '%';
      track.appendChild(bar);
      row.appendChild(track);
      row.appendChild(el('span', 'heat-num', (cur ? '本次 +' + cur + ' / ' : '') + '累计 ' + total));
      heat.appendChild(row);
    });
    sec3.appendChild(heat);
    root.appendChild(sec3);
  }

  return { results: results };
})();
