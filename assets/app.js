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

  /* ---------------- JSON to YAML Converter ---------------- */
  const yamlInput = document.getElementById('yaml-input');
  if (yamlInput) {
    const yamlOutput = document.getElementById('yaml-output');
    const yamlStatus = document.getElementById('yaml-status');
    const yamlIndent = document.getElementById('yaml-indent');
    const yamlDownload = document.getElementById('yaml-download');
    let lastYaml = '';

    const setYamlStatus = (message, kind) => {
      yamlStatus.textContent = message;
      yamlStatus.className = 'status-line' + (kind ? ' ' + kind : '');
    };

    const isContainer = (v) => v !== null && typeof v === 'object';
    const isEmptyContainer = (v) => Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0;

    function yamlString(s) {
      if (s === '') return '""';
      const risky =
        /^\s|\s$/.test(s) ||
        /[\n\r\t]/.test(s) ||
        /^[-?:,\[\]{}#&*!|>'"%@`]/.test(s) ||
        /: |\s#|:$/.test(s) ||
        /^(true|false|null|yes|no|on|off|y|n|~)$/i.test(s) ||
        /^[-+]?(\d[\d_]*\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s) ||
        /^0[xo]/i.test(s);
      return risky ? JSON.stringify(s) : s;
    }

    function yamlInline(v) {
      if (isContainer(v)) return Array.isArray(v) ? '[]' : '{}';
      if (v === null) return 'null';
      if (typeof v === 'boolean' || typeof v === 'number') return String(v);
      return yamlString(String(v));
    }

    function toYaml(v, unit, depth) {
      const pad = unit.repeat(depth);
      if (Array.isArray(v)) {
        if (!v.length) return pad + '[]';
        const marker = '-' + ' '.repeat(unit.length - 1);
        return v.map((item) => {
          if (isContainer(item) && !isEmptyContainer(item)) {
            const inner = toYaml(item, unit, depth + 1);
            return pad + marker + inner.slice(unit.length * (depth + 1));
          }
          return pad + '- ' + yamlInline(item);
        }).join('\n');
      }
      if (isContainer(v)) {
        const keys = Object.keys(v);
        if (!keys.length) return pad + '{}';
        return keys.map((k) => {
          const val = v[k];
          const key = yamlString(k);
          if (isContainer(val) && !isEmptyContainer(val)) {
            return pad + key + ':\n' + toYaml(val, unit, depth + 1);
          }
          return pad + key + ': ' + yamlInline(val);
        }).join('\n');
      }
      return pad + yamlInline(v);
    }

    const runYaml = () => {
      const raw = yamlInput.value.trim();
      if (!raw) {
        yamlOutput.textContent = '';
        setYamlStatus('Paste some JSON on the left to get started.', '');
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        lastYaml = toYaml(parsed, ' '.repeat(parseInt(yamlIndent.value, 10)), 0);
        yamlOutput.textContent = lastYaml;
        yamlDownload.disabled = false;
        setYamlStatus('Converted to YAML successfully.', 'ok');
      } catch (err) {
        yamlOutput.textContent = '';
        lastYaml = '';
        yamlDownload.disabled = true;
        setYamlStatus('Invalid JSON - ' + (err.message || 'could not parse.'), 'error');
      }
    };

    document.getElementById('yaml-run').addEventListener('click', runYaml);
    yamlIndent.addEventListener('change', () => { if (yamlOutput.textContent) runYaml(); });
    document.getElementById('yaml-sample').addEventListener('click', () => {
      yamlInput.value = '{"name":"Ali","age":24,"active":true,"roles":["admin","editor"],"address":{"city":"Jhelum","zip":null}}';
      runYaml();
    });
    document.getElementById('yaml-copy').addEventListener('click', () => {
      if (!lastYaml) return;
      navigator.clipboard.writeText(lastYaml);
      setYamlStatus('Copied to clipboard.', 'ok');
    });
    document.getElementById('yaml-clear').addEventListener('click', () => {
      yamlInput.value = '';
      yamlOutput.textContent = '';
      lastYaml = '';
      yamlDownload.disabled = true;
      setYamlStatus('', '');
      yamlInput.focus();
    });
    yamlDownload.addEventListener('click', () => {
      if (!lastYaml) return;
      const blob = new Blob([lastYaml + '\n'], { type: 'text/yaml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'parsekit-export.yaml';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  /* ---------------- Base64 Encode / Decode ---------------- */
  const b64Input = document.getElementById('b64-input');
  if (b64Input) {
    const b64Output = document.getElementById('b64-output');
    const b64Status = document.getElementById('b64-status');
    const b64UrlSafe = document.getElementById('b64-urlsafe');
    let lastB64 = '';

    const setB64Status = (message, kind) => {
      b64Status.textContent = message;
      b64Status.className = 'status-line' + (kind ? ' ' + kind : '');
    };

    const showB64 = (text) => {
      lastB64 = text;
      b64Output.textContent = text;
    };

    function encodeText(text, urlSafe) {
      const bytes = new TextEncoder().encode(text);
      let bin = '';
      bytes.forEach((b) => { bin += String.fromCharCode(b); });
      let out = btoa(bin);
      if (urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return out;
    }

    function decodeText(b64) {
      let s = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
      const rem = s.length % 4;
      if (rem === 1) throw new Error('the length is not valid for Base64');
      if (rem) s += '='.repeat(4 - rem);
      const bin = atob(s);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }

    document.getElementById('b64-encode').addEventListener('click', () => {
      const raw = b64Input.value;
      if (!raw) {
        showB64('');
        setB64Status('Type or paste some text to encode.', '');
        return;
      }
      try {
        showB64(encodeText(raw, b64UrlSafe.checked));
        setB64Status('Encoded to Base64' + (b64UrlSafe.checked ? ' (URL-safe)' : '') + ' successfully.', 'ok');
      } catch (err) {
        showB64('');
        setB64Status('Could not encode - ' + (err.message || 'unknown error.'), 'error');
      }
    });

    document.getElementById('b64-decode').addEventListener('click', () => {
      const raw = b64Input.value.trim();
      if (!raw) {
        showB64('');
        setB64Status('Paste some Base64 to decode.', '');
        return;
      }
      try {
        showB64(decodeText(raw));
        setB64Status('Decoded successfully.', 'ok');
      } catch (err) {
        showB64('');
        setB64Status('Invalid Base64, or the result is not valid UTF-8 text.', 'error');
      }
    });

    document.getElementById('b64-swap').addEventListener('click', () => {
      if (!lastB64) return;
      b64Input.value = lastB64;
      showB64('');
      setB64Status('Output moved to the input box.', 'ok');
    });

    document.getElementById('b64-sample').addEventListener('click', () => {
      b64Input.value = 'Hello, Parsekit! 123';
      showB64(encodeText(b64Input.value, b64UrlSafe.checked));
      setB64Status('Sample loaded and encoded. Press Decode after using output as input to reverse it.', 'ok');
    });

    document.getElementById('b64-copy').addEventListener('click', () => {
      if (!lastB64) return;
      navigator.clipboard.writeText(lastB64);
      setB64Status('Copied to clipboard.', 'ok');
    });

    document.getElementById('b64-clear').addEventListener('click', () => {
      b64Input.value = '';
      showB64('');
      setB64Status('', '');
      b64Input.focus();
    });
  }

  /* ---------------- JSON Diff ---------------- */
  const diffA = document.getElementById('diff-a');
  if (diffA) {
    const diffB = document.getElementById('diff-b');
    const diffOutput = document.getElementById('diff-output');
    const diffStatus = document.getElementById('diff-status');
    let lastDiff = '';

    const setDiffStatus = (message, kind) => {
      diffStatus.textContent = message;
      diffStatus.className = 'status-line' + (kind ? ' ' + kind : '');
    };

    const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

    function same(a, b) {
      if (a === b) return true;
      if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((x, i) => same(x, b[i]));
      }
      if (isObj(a) && isObj(b)) {
        const ka = Object.keys(a);
        const kb = Object.keys(b);
        return ka.length === kb.length && ka.every((k) => has(b, k) && same(a[k], b[k]));
      }
      return false;
    }

    const keyPath = (path, k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? path + '.' + k : path + '[' + JSON.stringify(k) + ']');

    function walk(a, b, path, out) {
      if (same(a, b)) return;
      if (isObj(a) && isObj(b)) {
        Object.keys(a).forEach((k) => {
          const p = keyPath(path, k);
          if (!has(b, k)) out.push({ t: 'del', p, v: a[k] });
          else walk(a[k], b[k], p, out);
        });
        Object.keys(b).forEach((k) => {
          if (!has(a, k)) out.push({ t: 'add', p: keyPath(path, k), v: b[k] });
        });
        return;
      }
      if (Array.isArray(a) && Array.isArray(b)) {
        const n = Math.max(a.length, b.length);
        for (let i = 0; i < n; i++) {
          const p = path + '[' + i + ']';
          if (i >= a.length) out.push({ t: 'add', p, v: b[i] });
          else if (i >= b.length) out.push({ t: 'del', p, v: a[i] });
          else walk(a[i], b[i], p, out);
        }
        return;
      }
      out.push({ t: 'chg', p: path, from: a, to: b });
    }

    function short(v) {
      let s = JSON.stringify(v);
      if (s === undefined) s = 'undefined';
      return s.length > 120 ? s.slice(0, 117) + '...' : s;
    }

    function runDiff() {
      const rawA = diffA.value.trim();
      const rawB = diffB.value.trim();
      diffOutput.textContent = '';
      lastDiff = '';
      if (!rawA || !rawB) {
        setDiffStatus('Paste JSON into both panels.', '');
        return;
      }
      let a, b;
      try { a = JSON.parse(rawA); } catch (err) {
        setDiffStatus('Left JSON is invalid - ' + (err.message || 'could not parse.'), 'error');
        return;
      }
      try { b = JSON.parse(rawB); } catch (err) {
        setDiffStatus('Right JSON is invalid - ' + (err.message || 'could not parse.'), 'error');
        return;
      }
      const out = [];
      walk(a, b, '$', out);
      if (!out.length) {
        setDiffStatus('No differences - both JSON documents are identical.', 'ok');
        return;
      }
      const lines = [];
      out.forEach((d) => {
        const text = d.t === 'add' ? '+ ' + d.p + ': ' + short(d.v)
          : d.t === 'del' ? '- ' + d.p + ': ' + short(d.v)
          : '~ ' + d.p + ': ' + short(d.from) + ' \u2192 ' + short(d.to);
        const line = document.createElement('span');
        line.className = 'diff-line diff-' + d.t;
        line.textContent = text;
        diffOutput.appendChild(line);
        lines.push(text);
      });
      lastDiff = lines.join('\n');
      const count = (t) => out.filter((d) => d.t === t).length;
      setDiffStatus(out.length + ' difference' + (out.length === 1 ? '' : 's') + ': ' + count('add') + ' added, ' + count('del') + ' removed, ' + count('chg') + ' changed.', 'ok');
    }

    document.getElementById('diff-run').addEventListener('click', runDiff);
    document.getElementById('diff-swap').addEventListener('click', () => {
      const t = diffA.value;
      diffA.value = diffB.value;
      diffB.value = t;
      if (diffA.value.trim() && diffB.value.trim()) runDiff();
    });
    document.getElementById('diff-sample').addEventListener('click', () => {
      diffA.value = '{"name":"Ali","age":24,"roles":["admin","editor"],"city":"Jhelum"}';
      diffB.value = '{"name":"Ali","age":25,"roles":["admin"],"country":"PK"}';
      runDiff();
    });
    document.getElementById('diff-copy').addEventListener('click', () => {
      if (!lastDiff) return;
      navigator.clipboard.writeText(lastDiff);
      setDiffStatus('Copied to clipboard.', 'ok');
    });
    document.getElementById('diff-clear').addEventListener('click', () => {
      diffA.value = '';
      diffB.value = '';
      diffOutput.textContent = '';
      lastDiff = '';
      setDiffStatus('', '');
      diffA.focus();
    });
  }

  /* ---------------- URL Encode / Decode ---------------- */
  const urlInput = document.getElementById('url-input');
  if (urlInput) {
    const urlOutput = document.getElementById('url-output');
    const urlStatus = document.getElementById('url-status');
    const urlMode = document.getElementById('url-mode');
    const urlPlus = document.getElementById('url-plus');
    let lastUrl = '';

    const setUrlStatus = (message, kind) => {
      urlStatus.textContent = message;
      urlStatus.className = 'status-line' + (kind ? ' ' + kind : '');
    };

    const showUrl = (text) => {
      lastUrl = text;
      urlOutput.textContent = text;
    };

    document.getElementById('url-encode').addEventListener('click', () => {
      const raw = urlInput.value;
      if (!raw) {
        showUrl('');
        setUrlStatus('Type or paste some text to encode.', '');
        return;
      }
      try {
        showUrl(urlMode.value === 'full' ? encodeURI(raw) : encodeURIComponent(raw));
        setUrlStatus('Encoded successfully (' + (urlMode.value === 'full' ? 'full URL' : 'component') + ' mode).', 'ok');
      } catch (err) {
        showUrl('');
        setUrlStatus('Could not encode - the text contains an invalid character sequence.', 'error');
      }
    });

    document.getElementById('url-decode').addEventListener('click', () => {
      let raw = urlInput.value.trim();
      if (!raw) {
        showUrl('');
        setUrlStatus('Paste a percent-encoded string to decode.', '');
        return;
      }
      if (urlPlus.checked) raw = raw.replace(/\+/g, ' ');
      try {
        showUrl(urlMode.value === 'full' ? decodeURI(raw) : decodeURIComponent(raw));
        setUrlStatus('Decoded successfully.', 'ok');
      } catch (err) {
        showUrl('');
        setUrlStatus('Invalid input - a % sign is not followed by two hex digits, or the bytes are not valid UTF-8.', 'error');
      }
    });

    document.getElementById('url-swap').addEventListener('click', () => {
      if (!lastUrl) return;
      urlInput.value = lastUrl;
      showUrl('');
      setUrlStatus('Output moved to the input box.', 'ok');
    });

    document.getElementById('url-sample').addEventListener('click', () => {
      urlInput.value = 'name=Ali Khan&city=Jhelum/Punjab?x=1';
      urlMode.value = 'component';
      showUrl(encodeURIComponent(urlInput.value));
      setUrlStatus('Sample loaded and encoded. Use output as input, then press Decode to reverse it.', 'ok');
    });

    document.getElementById('url-copy').addEventListener('click', () => {
      if (!lastUrl) return;
      navigator.clipboard.writeText(lastUrl);
      setUrlStatus('Copied to clipboard.', 'ok');
    });

    document.getElementById('url-clear').addEventListener('click', () => {
      urlInput.value = '';
      showUrl('');
      setUrlStatus('', '');
      urlInput.focus();
    });
  }

  /* ---------------- GA4 tool usage events ---------------- */
  [['fmt-run', 'json_formatter'], ['fmt-minify', 'json_minify'], ['csv-run', 'json_to_csv'], ['merge-run', 'merge_json'], ['yaml-run', 'json_to_yaml'], ['b64-encode', 'base64_encode'], ['b64-decode', 'base64_decode'], ['diff-run', 'json_diff'], ['url-encode', 'url_encode'], ['url-decode', 'url_decode']].forEach(([id, name]) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', () => {
        if (typeof gtag === 'function') gtag('event', 'tool_use', { tool_name: name, page_path: location.pathname });
      });
    }
  });

});
