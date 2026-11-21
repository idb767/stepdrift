/* StepDrift · 输入方式：文字输入 / 图片对照（纯输入层，不参与判定）
   图片只作对照参考；送入判定的始终是一框文字，且必须经用户勾选核对后才可用。 */
window.SD = window.SD || {};

SD.input = (function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LOCK_HINT = '请先核对图片与文字是否一致';

  var mode = 'text';
  var objectUrl = null;

  function confirmed() {
    var box = $('img-confirm');
    return !!(box && box.checked);
  }

  function locked() {
    return mode === 'image' && !confirmed();
  }

  function gate() {
    var btn = $('btn-run');
    var hint = $('input-hint');
    var isLocked = locked();
    btn.disabled = isLocked;
    btn.classList.toggle('is-locked', isLocked);
    if (isLocked) hint.textContent = LOCK_HINT;
    else if (hint.textContent === LOCK_HINT) hint.textContent = '';
  }

  function setMode(next) {
    mode = next;
    var isText = mode === 'text';
    $('pane-text').classList.toggle('hidden', !isText);
    $('pane-image').classList.toggle('hidden', isText);
    $('mode-text').classList.toggle('is-active', isText);
    $('mode-image').classList.toggle('is-active', !isText);
    $('mode-text').setAttribute('aria-selected', isText ? 'true' : 'false');
    $('mode-image').setAttribute('aria-selected', isText ? 'false' : 'true');
    var layout = document.querySelector('.layout');
    if (layout) layout.classList.toggle('is-compare', !isText);
    gate();
  }

  function showImage(file) {
    if (!file || !/^image\//.test(file.type)) {
      $('drop-tip').textContent = '只能选择图片文件（对照用）';
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    $('img-thumb').src = objectUrl;
    $('img-thumb').classList.remove('hidden');
    $('img-empty').classList.add('hidden');
    $('drop').classList.remove('is-over');
    $('drop-tip').textContent = file.name + ' · 点击图片可放大核对';
    $('img-confirm').checked = false;
    gate();
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('mode-text').addEventListener('click', function () { setMode('text'); });
    $('mode-image').addEventListener('click', function () { setMode('image'); });

    $('img-file').addEventListener('change', function (e) {
      showImage(e.target.files[0]);
      e.target.value = '';
    });

    var drop = $('drop');
    ['dragenter', 'dragover'].forEach(function (name) {
      drop.addEventListener(name, function (e) {
        e.preventDefault();
        drop.classList.add('is-over');
      });
    });
    drop.addEventListener('dragleave', function (e) {
      e.preventDefault();
      drop.classList.remove('is-over');
    });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      var files = e.dataTransfer && e.dataTransfer.files;
      showImage(files && files[0]);
    });

    $('img-confirm').addEventListener('change', gate);

    // 文字一改，先前的逐行核对即失效；换图同理
    $('img-input').addEventListener('input', function () {
      if (confirmed()) {
        $('img-confirm').checked = false;
        gate();
      }
    });

    var viewer = $('img-viewer');
    $('img-thumb').addEventListener('click', function () {
      if (!objectUrl) return;
      $('img-large').src = objectUrl;
      viewer.classList.remove('hidden');
    });
    viewer.addEventListener('click', function () { viewer.classList.add('hidden'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') viewer.classList.add('hidden');
    });

    gate();
  });

  return {
    mode: function () { return mode; },
    locked: locked,
    source: function () { return (mode === 'image' ? $('img-input') : $('input')).value; },
    toTextMode: function () { setMode('text'); },
    gate: gate
  };
})();
