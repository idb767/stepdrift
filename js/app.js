/* StepDrift · 交互入口：样例、判定、上传、判定边界弹窗 */
(function () {
  'use strict';

  var SAMPLES = SD.samples;

  var $ = function (id) { return document.getElementById(id); };

  function run(text) {
    var analysis = SD.engine.analyze(text);
    var tags = analysis.cards.map(function (c) { return c.tag; });
    var archive = SD.archive.recordRun(tags);
    $('empty-state').classList.add('hidden');
    $('results').classList.remove('hidden');
    SD.render.results($('results'), analysis, archive);
    if (window.innerWidth < 960) {
      $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function runSample(sample) {
    if (SD.input) SD.input.toTextMode();
    $('input').value = sample.text;
    if (SD.preview) SD.preview.refresh();
    $('input-hint').textContent = '';
    run(sample.text);
  }

  // 样例 chips
  SAMPLES.forEach(function (s) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = s.name;
    b.addEventListener('click', function () { runSample(s); });
    $('samples').appendChild(b);
  });

  $('btn-run').addEventListener('click', function () {
    if (SD.input && SD.input.locked()) { SD.input.gate(); return; }
    var text = (SD.input ? SD.input.source() : $('input').value).trim();
    if (!text) {
      $('input-hint').textContent = SD.input && SD.input.mode() === 'image'
        ? '请先在右侧录入推导步骤，或点上方任意样例。'
        : '请先粘贴推导步骤，或点上方任意样例。';
      return;
    }
    $('input-hint').textContent = '';
    run(text);
  });

  $('btn-demo').addEventListener('click', function () { runSample(SAMPLES[0]); });

  $('file').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      if (SD.input) SD.input.toTextMode();
      $('input').value = reader.result;
      if (SD.preview) SD.preview.refresh();
    };
    reader.readAsText(f);
    e.target.value = '';
  });

  // 判定边界弹窗
  $('btn-boundary').addEventListener('click', function () { $('boundary-modal').classList.remove('hidden'); });
  $('btn-close-boundary').addEventListener('click', function () { $('boundary-modal').classList.add('hidden'); });
  $('boundary-modal').addEventListener('click', function (e) {
    if (e.target === $('boundary-modal')) $('boundary-modal').classList.add('hidden');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') $('boundary-modal').classList.add('hidden');
  });
})();
