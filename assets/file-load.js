/* Parsekit: adds "Open file" and drag-and-drop to input boxes.
   Files are read in the browser with FileReader and are never uploaded. */
(function () {
  var MAX_BYTES = 10 * 1024 * 1024;
  var all = document.querySelectorAll('textarea');
  var targets = [];
  for (var i = 0; i < all.length; i++) {
    var t = all[i];
    if (t.readOnly) continue;
    if (all.length === 1 || /(input|-a|-b)$/.test(t.id)) targets.push(t);
  }
  targets.forEach(attach);

  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function track() {
    if (typeof gtag === 'function') {
      gtag('event', 'file_open', { page_path: location.pathname });
    }
  }

  function attach(ta) {
    if (!ta.parentNode) return;

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 10px;border-bottom:1px solid #d8d8d8;background:#faf9f5;font-size:12px;';

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.txt,.csv,.yaml,.yml,.log,application/json,text/plain,text/csv';
    fileInput.style.display = 'none';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Open file';
    btn.setAttribute('aria-label', 'Open a file from your device');
    btn.style.cssText = 'font:inherit;font-size:12px;padding:3px 10px;border:1px solid #b9b9b9;border-radius:4px;background:#fff;cursor:pointer;';

    var note = document.createElement('span');
    note.style.cssText = 'color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    note.textContent = 'or drop a file here. It is read in your browser, not uploaded.';

    bar.appendChild(btn);
    bar.appendChild(note);
    bar.appendChild(fileInput);
    ta.parentNode.insertBefore(bar, ta);

    function setNote(msg, isErr) {
      note.textContent = msg;
      note.style.color = isErr ? '#b3261e' : '#555';
    }

    function load(file) {
      if (!file) return;
      if (file.size > MAX_BYTES) {
        setNote(file.name + ' is larger than 10 MB. Use a smaller file, or cut it down first.', true);
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        ta.value = String(reader.result);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        setNote(file.name + ' (' + fmtSize(file.size) + ') loaded in your browser.', false);
        track();
      };
      reader.onerror = function () {
        setNote('Could not read ' + file.name + '.', true);
      };
      reader.readAsText(file);
    }

    btn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      load(fileInput.files && fileInput.files[0]);
      fileInput.value = '';
    });

    ta.addEventListener('dragover', function (e) {
      e.preventDefault();
      ta.style.outline = '2px dashed #2a9db0';
    });
    ta.addEventListener('dragleave', function () { ta.style.outline = ''; });
    ta.addEventListener('drop', function (e) {
      e.preventDefault();
      ta.style.outline = '';
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      load(f);
    });
  }
})();
