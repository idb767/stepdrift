/* StepDrift · 错因归档（localStorage，仅本机） */
window.SD = window.SD || {};

SD.archive = (function () {
  'use strict';

  var KEY = 'stepdrift.archive.v1';

  var CATEGORIES = [
    '充分必要条件混淆',
    '定理适用条件未验证',
    '存在性判据缺失',
    '解结构判据缺失',
    '事件与对象语义误读',
    '变形不守恒',
    '推理链自相矛盾'
  ];

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { runs: 0, tags: {} };
      var d = JSON.parse(raw);
      return { runs: d.runs || 0, tags: d.tags || {} };
    } catch (e) {
      return { runs: 0, tags: {} };
    }
  }

  function recordRun(tags) {
    var d = load();
    d.runs += 1;
    var current = {};
    tags.forEach(function (t) {
      d.tags[t] = (d.tags[t] || 0) + 1;
      current[t] = (current[t] || 0) + 1;
    });
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    return { runs: d.runs, tags: d.tags, current: current };
  }

  return { load: load, recordRun: recordRun, CATEGORIES: CATEGORIES };
})();
