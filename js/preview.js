/* StepDrift · 公式预览（纯 UI 补丁，不参与任何判定）
   说明：页面没有真正的 KaTeX。SD.katex 是对 js/latex.js 降级排版器的 katex 兼容包装，
   只提供 renderToString(expr, { displayMode, throwOnError }) 这一个签名。
   渲染器缺失或抛错时，预览区显示降级文案，绝不回退成裸源码。 */
window.SD = window.SD || {};

SD.katex = (function () {
  'use strict';

  function renderToString(expr, options) {
    var opts = options || {};
    if (!SD.latex || typeof SD.latex.renderFormula !== 'function') {
      throw new Error('renderer-unavailable');
    }
    if (typeof expr !== 'string') throw new Error('bad-input');
    var html = SD.latex.renderFormula(expr);
    if (opts.displayMode) return '<span class="tex-block">' + html + '</span>';
    return html;
  }

  return { renderToString: renderToString, version: 'compat-shim' };
})();

SD.preview = (function () {
  'use strict';

  var DEGRADE_TEXT = '预览暂不可用，判定不受影响';
  var EMPTY_TEXT = '输入后，这里会实时排版。';
  var FAIL_TEXT = '（这一段公式无法排版）';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* 预览专用补强：只作用于预览区，不改 latex.js，因此不影响结果区排版 */
  function enhance(expr) {
    var s = String(expr), guard = 0;
    while (/\\sqrt\s*\{/.test(s) && guard++ < 20) {
      var i = s.search(/\\sqrt\s*\{/);
      var open = s.indexOf('{', i);
      var close = s.indexOf('}', open);
      if (close === -1) break;
      s = s.slice(0, i) + '√(' + s.slice(open + 1, close) + ')' + s.slice(close + 1);
    }
    s = s.replace(/\\sqrt\s*([0-9a-zA-Z])/g, '√($1)');
    return s;
  }

  // 残缺 LaTeX 可能残留 \command；预览宁可说「无法排版」，也不露裸源码
  function hasResidualCommand(html) {
    var text = html.replace(/<[^>]*>/g, '');
    return /\\[a-zA-Z]/.test(text) || /[{}]/.test(text);
  }

  /* 一个步骤块：$...$ 走渲染器，$ 之外的文字转义保留，换行保留 */
  function renderBlock(text) {
    var parts = String(text).split(/(\$[^$]*\$)/);
    var out = '';
    parts.forEach(function (p) {
      if (!p) return;
      var isFormula = p.length > 2 && p.charAt(0) === '$' && p.charAt(p.length - 1) === '$' &&
                      p.indexOf('$', 1) === p.length - 1;
      if (isFormula) {
        var inner = p.slice(1, -1);
        var html = null;
        try {
          html = SD.katex.renderToString(enhance(inner), { displayMode: false, throwOnError: false });
        } catch (e) {
          html = null;
        }
        out += (html == null || hasResidualCommand(html))
          ? '<span class="pv-fail">' + FAIL_TEXT + '</span>'
          : html;
      } else {
        out += esc(p).replace(/\n/g, '<br>');
      }
    });
    return out;
  }

  /* 按「第N步」切成步骤块；没有标记时整段作为一块 */
  function splitBlocks(text) {
    var blocks = String(text).split(/(?=第\s*\d+\s*步)/);
    return blocks.filter(function (b) { return b.trim() !== ''; });
  }

  function attach(taId, bodyId) {
    var timer = null;

    function refresh() {
      var target = document.getElementById(bodyId);
      if (!target) return;
      var input = document.getElementById(taId);
      var text = input ? input.value : '';

      if (!SD.latex || typeof SD.katex.renderToString !== 'function') {
        target.className = 'preview-body preview-degrade';
        target.textContent = DEGRADE_TEXT;
        return;
      }
      target.className = 'preview-body';
      if (!text.trim()) {
        target.innerHTML = '<p class="pv-empty">' + EMPTY_TEXT + '</p>';
        return;
      }
      target.innerHTML = splitBlocks(text).map(function (b) {
        return '<div class="pv-step">' + renderBlock(b) + '</div>';
      }).join('');
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(refresh, 150);
    }

    function bind() {
      var input = document.getElementById(taId);
      if (input) input.addEventListener('input', schedule);
      refresh();
    }

    return { refresh: refresh, schedule: schedule, bind: bind };
  }

  var text = attach('input', 'livePreviewBody');
  var img = attach('img-input', 'img-preview-body');

  document.addEventListener('DOMContentLoaded', function () {
    text.bind();
    img.bind();
  });

  return {
    refresh: text.refresh,
    schedule: text.schedule,
    text: text,
    image: img
  };
})();
