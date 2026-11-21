/* StepDrift · 简陋 LaTeX 降级排版（无第三方库） */
window.SD = window.SD || {};

SD.latex = (function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function readGroup(s, i) {
    var depth = 0;
    for (var j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { depth--; if (depth === 0) return { body: s.slice(i + 1, j), next: j + 1 }; }
    }
    return { body: s.slice(i + 1), next: s.length };
  }

  var SYMBOLS = [
    [/\\operatorname\{([a-zA-Z]+)\}/g, '$1'],
    [/\\lim(?![a-zA-Z])/g, 'lim'],
    [/\\(bar|overline)\{?([A-Za-z])\}?/g, '$2̄'],
    [/\\to(?![a-zA-Z])/g, '→'], [/\\infty/g, '∞'],
    [/\\cap(?![a-zA-Z])/g, '∩'], [/\\cup(?![a-zA-Z])/g, '∪'],
    [/\\times(?![a-zA-Z])/g, '×'], [/\\cdot(?![a-zA-Z])/g, '·'],
    [/\\pi(?![a-zA-Z])/g, 'π'], [/\\le(?![a-zA-Z])/g, '≤'], [/\\ge(?![a-zA-Z])/g, '≥'], [/\\ne(?![a-zA-Z])/g, '≠'],
    [/\\pm(?![a-zA-Z])/g, '±'], [/\\in(?![a-zA-Z])/g, '∈'], [/\\subset(?![a-zA-Z])/g, '⊂'],
    [/\\Rightarrow(?![a-zA-Z])/g, '⇒'], [/\\Leftrightarrow(?![a-zA-Z])/g, '⇔'],
    [/\\(sin|cos|tan|ln|exp|log)(?![a-zA-Z])/g, '$1'],
    [/\\(left|right|,|;|!|:)/g, ''],
    [/\\ /g, ' ']
  ];

  function renderFormula(src) {
    var s = esc(src);

    // \frac{a}{b} → 上下结构，循环以支持嵌套
    var guard = 0;
    while (s.indexOf('\\frac') !== -1 && guard++ < 30) {
      var i = s.indexOf('\\frac');
      var p = i + 5;
      if (s[p] !== '{') { s = s.replace('\\frac', ''); continue; }
      var num = readGroup(s, p);
      if (s[num.next] !== '{') { s = s.slice(0, i) + s.slice(num.next); continue; }
      var den = readGroup(s, num.next);
      s = s.slice(0, i) +
          '<span class="tex-frac"><span class="tex-num">' + num.body + '</span>' +
          '<span class="tex-den">' + den.body + '</span></span>' + s.slice(den.next);
    }

    SYMBOLS.forEach(function (pair) { s = s.replace(pair[0], pair[1]); });

    guard = 0;
    while (/[\^_]\{/.test(s) && guard++ < 50) {
      var m = s.match(/([\^_])\{/);
      var c = m.index;
      var g = readGroup(s, c + 1);
      var tag = m[1] === '^' ? 'sup' : 'sub';
      s = s.slice(0, c) + '<' + tag + '>' + g.body + '</' + tag + '>' + s.slice(g.next);
    }
    s = s.replace(/([\^_])([0-9A-Za-z+\-∞])/g, function (_, kind, ch) {
      var tag = kind === '^' ? 'sup' : 'sub';
      return '<' + tag + '>' + ch + '</' + tag + '>';
    });

    s = s.replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '');
    return '<span class="tex">' + s + '</span>';
  }

  /* 普通文本 + $...$ 混合渲染；非公式部分一律转义 */
  function renderInline(text) {
    var parts = String(text).split(/\$([^$]+)\$/);
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      out += (i % 2 === 0) ? esc(parts[i]) : renderFormula(parts[i]);
    }
    return out;
  }

  return { renderInline: renderInline, renderFormula: renderFormula, esc: esc };
})();
