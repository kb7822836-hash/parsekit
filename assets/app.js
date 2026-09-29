// Parsekit — shared client-side logic. Each block only runs if its page has the matching elements.

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------- JSON Formatter & Validator ---------------- */
  const fmtInput = document.getElementById('fmt-input');
  if (fmtInput) {
    const fmtOutput = document.getElementById('fmt-output');
    const fmtStatus = document.getElementById('fmt-status');
    const fmtIndent = document.getElementById('fmt-indent');

    function setStatus(el, message, kind) {
      el.textContent = message;
      el.className = 'status-line' + (kind ? ' ' + kind : '');
    }

    function runFormat(minify) {
      const raw = fmtInput.value.trim();
      if (!raw) {
        fmtOutput.textContent = '';
        setStatus(fmtStatus, 'Paste some JSON above to get started.', '');
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        const indent = minify ? 0 : parseInt(fmtIndent.value, 10);
        fmtOutput.textContent = JSON.stringify(parsed, null, indent);
        setStatus(fmtStatus, minify ? 'Minified successfully.' : 'Valid JSON — formatted successfully.', 'ok');
      } catch (err) {
        fmtOutput.textContent = '';
        setStatus(fmtStatus, 'Invalid JSON — ' + humanizeJsonError(err, raw), 'error');
      }
    }

    function humanizeJsonError(err, raw) {
      const msg = err.message || 'could not parse.';
      const posMatch = msg.match(/position (\d+)/);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const before = raw.slice(0, pos);
        const line = before.split('\n').length;
        const col = pos - before.lastIndexOf('\n');
        return `${msg} (line ${line}, column ${col})`;
      }
      return msg;
    }

    document.getElementById('fmt-run').addEventListener('click', () => runFormat(false));
    document.getElementById('fmt-minify').addEventListener('click', () => runFormat(true));
    document.getElementById('fmt-clear').addEventListener('click', () => {
      fmtInput.value = '';
      fmtOutput.textContent = '';
      setStatus(fmtStatus, '', '');
      fmtInput.focus();
    });
    document.getElementById('fmt-copy').addEventListener('click', () => {
      if (!fmtOutput.textContent) return;
      navigator.clipboard.writeText(fmtOutput.textContent);
      setStatus(fmtStatus, 'Copied to clipboard.', 'ok');
    });
    fmtIndent.addEventListener('change', () => { if (fmtOutput.textContent) runFormat(false); });
    document.getElementById('fmt-sample').addEventListener('click', () => {
      fmtInput.value = '{"name":"Ali","age":24,"active":true,"roles":["admin","editor"]}';
      runFormat(false);
    });
  }

  /* ---------------- JSON to CSV Converter ---------------- */
  const csvInput = document.getElementById('csv-input');
  if (csvInput) {
    const csvOutput = document.getElementById('csv-output');
    const csvStatus = document.getElementById('csv-status');
    const csvDownload = document.getElementById('csv-download');

    function flattenValue(v) {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    }

    function toCsv(rows) {
      const headers = Array.from(rows.reduce((set, row) => {
        Object.keys(row).forEach(k => set.add(k));
        return set;
      }, new Set()));

      const escapeCell = (val) => {
        const s = flattenValue(val);
        if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      };

      const lines = [headers.map(escapeCell).join(',')];
      rows.forEach(row => {
        lines.push(headers.map(h => escapeCell(row[h])).join(','));
      });
      return lines.join('\n');
    }

    function setStatus(el, message, kind) {
      el.textContent = message;
      el.className = 'status-line' + (kind ? ' ' + kind : '');
    }

    let lastCsv = '';

    document.getElementById('csv-sample').addEventListener('click', () => {
      csvInput.value = '[{"name":"Ali","city":"Jhelum"},{"name":"Sara","city":"Lahore"}]';
    });

    document.getElementById('csv-run').addEventListener('click', () => {
      const raw = csvInput.value.trim();
      if (!raw) {
        setStatus(csvStatus, 'Paste a JSON array of objects above.', '');
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        if (!rows.every(r => typeof r === 'object' && r !== null && !Array.isArray(r))) {
          setStatus(csvStatus, 'Input must be an array of flat objects, e.g. [{"name":"Ali"}].', 'error');
          csvOutput.textContent = '';
          return;
        }
        lastCsv = toCsv(rows);
        csvOutput.textContent = lastCsv;
        csvDownload.disabled = false;
        setStatus(csvStatus, `Converted ${rows.length} row${rows.length === 1 ? '' : 's'} successfully.`, 'ok');
      } catch (err) {
        csvOutput.textContent = '';
        csvDownload.disabled = true;
        setStatus(csvStatus, 'Invalid JSON — ' + (err.message || 'could not parse.'), 'error');
      }
    });

    document.getElementById('csv-clear').addEventListener('click', () => {
      csvInput.value = '';
      csvOutput.textContent = '';
      lastCsv = '';
      csvDownload.disabled = true;
      setStatus(csvStatus, '', '');
      csvInput.focus();
    });

    csvDownload.addEventListener('click', () => {
      if (!lastCsv) return;
      const blob = new Blob([lastCsv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'parsekit-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  /* ---------------- Merge JSON Files ---------------- */
  const mergeA = document.getElementById('merge-a');
  if (mergeA) {
    const mergeB = document.getElementById('merge-b');
    const mergeOutput = document.getElementById('merge-output');
    const mergeStatus = document.getElementById('merge-status');
    const mergeDownload = document.getElementById('merge-download');

    function setStatus(el, message, kind) {
      el.textContent = message;
      el.className = 'status-line' + (kind ? ' ' + kind : '');
    }

    function deepMergeObjects(a, b) {
      const result = { ...a };
      for (const key of Object.keys(b)) {
        if (
          typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key]) &&
          typeof b[key] === 'object' && b[key] !== null && !Array.isArray(b[key])
        ) {
          result[key] = deepMergeObjects(result[key], b[key]);
        } else {
          result[key] = b[key];
        }
      }
      return result;
    }

    let lastMerged = null;

    document.getElementById('merge-sample').addEventListener('click', () => {
      mergeA.value = '{"user":{"name":"Ali","age":24}}';
      mergeB.value = '{"user":{"age":25,"city":"Jhelum"}}';
    });

    document.getElementById('merge-run').addEventListener('click', () => {
      const rawA = mergeA.value.trim();
      const rawB = mergeB.value.trim();
      if (!rawA || !rawB) {
        setStatus(mergeStatus, 'Paste JSON into both panels.', '');
        return;
      }
      try {
        const parsedA = JSON.parse(rawA);
        const parsedB = JSON.parse(rawB);
        let merged;
        if (Array.isArray(parsedA) && Array.isArray(parsedB)) {
          merged = [...parsedA, ...parsedB];
        } else if (
          typeof parsedA === 'object' && parsedA !== null && !Array.isArray(parsedA) &&
          typeof parsedB === 'object' && parsedB !== null && !Array.isArray(parsedB)
        ) {
          merged = deepMergeObjects(parsedA, parsedB);
        } else {
          setStatus(mergeStatus, 'Both inputs must be the same shape: two objects, or two arrays.', 'error');
          mergeOutput.textContent = '';
          return;
        }
        lastMerged = merged;
        mergeOutput.textContent = JSON.stringify(merged, null, 2);
        mergeDownload.disabled = false;
        const kind = Array.isArray(merged) ? 'arrays concatenated' : 'objects deep-merged (right side wins on conflicts)';
        setStatus(mergeStatus, `Merged successfully — ${kind}.`, 'ok');
      } catch (err) {
        mergeOutput.textContent = '';
        mergeDownload.disabled = true;
        setStatus(mergeStatus, 'Invalid JSON in one of the panels — ' + (err.message || 'could not parse.'), 'error');
      }
    });

    document.getElementById('merge-clear').addEventListener('click', () => {
      mergeA.value = '';
      mergeB.value = '';
      mergeOutput.textContent = '';
      lastMerged = null;
      mergeDownload.disabled = true;
      setStatus(mergeStatus, '', '');
      mergeA.focus();
    });

    mergeDownload.addEventListener('click', () => {
      if (lastMerged === null) return;
      const blob = new Blob([JSON.stringify(lastMerged, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'parsekit-merged.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }
});
