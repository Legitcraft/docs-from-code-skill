const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const { execFileSync } = require('child_process');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'build' || e.name === '__pycache__') continue;
      out.push(...walk(p));
    } else if (/\.(ts|tsx|js|jsx|py)$/i.test(e.name)) out.push(p);
  }
  return out;
}

function leadingDoc(sf, node) {
  const ranges = ts.getLeadingCommentRanges(sf.text, node.pos);
  if (!ranges) return '';
  for (let i = ranges.length - 1; i >= 0; i--) {
    const r = ranges[i];
    const txt = sf.text.slice(r.pos, r.end);
    if (txt.startsWith('/**')) {
      return txt.replace(/^\/\*\*|\*\/$/g, '').replace(/^\s*\* ?/gm, '').trim();
    }
  }
  return '';
}

function kindOf(node) {
  if (ts.isFunctionDeclaration(node)) return 'function';
  if (ts.isClassDeclaration(node)) return 'class';
  if (ts.isInterfaceDeclaration(node)) return 'interface';
  if (ts.isTypeAliasDeclaration(node)) return 'type';
  if (ts.isEnumDeclaration(node)) return 'enum';
  if (ts.isVariableStatement(node)) return 'const';
  return null;
}

function nameOf(node) {
  if (node.name && node.name.text) return node.name.text;
  if (node.declarations && node.declarations[0] && node.declarations[0].name) {
    return node.declarations[0].name.text || node.declarations[0].name.id?.text || '';
  }
  return '(anonymous)';
}

function signatureOf(node, sf) {
  const start = node.pos;
  const end = node.body ? node.body.pos : node.end;
  return sf.text.slice(start, end).trim().replace(/\s+/g, ' ').slice(0, 140);
}

function parseTags(doc) {
  const lines = (doc || '').split('\n');
  const descLines = [];
  const params = [];
  let returns = null;
  const examples = [];
  for (const raw of lines) {
    const line = raw.trim();
    let m = line.match(/^@param\s+(?:\{([^}]*)\}\s+)?(\S+)(?:\s+-?\s*(.*))?$/);
    if (m) { params.push({ type: m[1] || '', name: m[2], desc: m[3] || '' }); continue; }
    m = line.match(/^@returns?\s+(?:\{([^}]*)\}\s+)?(.*)$/);
    if (m) { returns = { type: m[1] || '', desc: m[2] || '' }; continue; }
    m = line.match(/^@example\s*(.*)$/);
    if (m) { examples.push(m[1] || ''); continue; }
    descLines.push(raw);
  }
  return { desc: descLines.join('\n').trim(), params, returns, examples };
}

function extract(filePath, root) {
  if (/\.py$/i.test(filePath)) {
    try {
      const raw = execFileSync('python', [path.join(__dirname, 'py_extract.py'), filePath], { encoding: 'utf8' });
      const symbols = JSON.parse(raw).map(s => ({ ...s, tags: { params: [], returns: null, examples: [] } }));
      // parse simple python doc tags
      symbols.forEach(s => {
        const t = parseTags(s.doc);
        s.doc = t.desc;
        s.tags = { params: t.params, returns: t.returns, examples: t.examples };
      });
      return { file: path.relative(root, filePath).replace(/\\/g, '/'), symbols };
    } catch (e) {
      return { file: path.relative(root, filePath).replace(/\\/g, '/'), symbols: [] };
    }
  }
  const src = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true);
  const symbols = [];
  for (const stmt of sf.statements) {
    const kind = kindOf(stmt);
    if (!kind) continue;
    const t = parseTags(leadingDoc(sf, stmt));
    symbols.push({
      kind,
      name: nameOf(stmt),
      doc: t.desc,
      tags: { params: t.params, returns: t.returns, examples: t.examples },
      sig: signatureOf(stmt, sf),
    });
  }
  return { file: path.relative(root, filePath).replace(/\\/g, '/'), symbols };
}

const root = path.resolve(process.argv[2] || process.cwd());
const outDir = path.resolve(process.argv[3] || path.join(root, 'docs'));
const files = fs.statSync(root).isDirectory() ? walk(root) : [root];

const data = files.map(f => extract(f, root)).filter(d => d.symbols.length);

const css = `:root{--bg:#ffffff;--sidebar:#fafafa;--card:#ffffff;--fg:#374151;--heading:#111827;--muted:#6b7280;--accent:#2563eb;--border:#e5e7eb;--code:#f6f8fa;--codefg:#24292f;--radius:6px}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.layout{display:grid;grid-template-columns:260px 1fr 230px;min-height:100vh}
.sidebar{background:var(--sidebar);border-right:1px solid var(--border);padding:22px 14px;position:sticky;top:0;height:100vh;overflow:auto}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;color:var(--heading);margin:0 0 14px;padding:0 8px;font-size:15px}.dot{width:18px;height:18px;border-radius:4px;background:var(--accent);display:grid;place-items:center;color:#fff;font-size:11px;font-weight:700}
.search{width:100%;border:1px solid var(--border);background:#fff;color:var(--fg);padding:8px 12px;border-radius:var(--radius);margin-bottom:16px;font-size:14px;outline:none}.search:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(37,99,235,.12)}
.sidebar h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:18px 8px 8px;font-weight:600}
.sidebar ul{list-style:none;margin:0;padding:0}.sidebar li{margin:1px 0}.sidebar a{display:block;padding:6px 10px;border-radius:6px;color:var(--fg);font-size:14px}.sidebar a:hover{background:#eef2ff;color:var(--accent)}.sidebar .count{color:var(--muted);font-size:12px;margin-left:6px}
.content{padding:40px 56px 80px;max-width:880px}.content h1{font-size:32px;font-weight:700;color:var(--heading);margin:0 0 6px;letter-spacing:-.01em}.content h2{font-size:22px;font-weight:600;color:var(--heading);margin:36px 0 12px;border-bottom:1px solid var(--border);padding-bottom:8px}
.intro{color:var(--muted);margin:0 0 32px;font-size:15px}
.card{border:1px solid var(--border);border-radius:8px;padding:18px 20px;margin:14px 0;background:#fff}
.card .head{display:flex;align-items:center;gap:10px;margin-bottom:8px}.badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;background:#eef2ff;color:var(--accent)}
.name{font-size:16px;font-weight:600;color:var(--heading)}.doc{color:var(--fg);white-space:pre-wrap;margin:8px 0;line-height:1.6}
.params{list-style:none;margin:10px 0;padding:0}.params li{padding:8px 0;font-size:14px;border-bottom:1px solid var(--border)}.params li:last-child{border-bottom:0}.params code{color:var(--accent);font-weight:600;background:var(--code);padding:1px 5px;border-radius:4px;font-family:ui-monospace,Consolas,monospace}
.returns{margin:10px 0;padding:8px 12px;background:#f8fafc;border-left:3px solid var(--accent);font-size:14px;border-radius:0 4px 4px 0}
.example{margin:10px 0;padding:12px;background:var(--code);border:1px solid var(--border);border-radius:var(--radius);font-family:ui-monospace,Consolas,monospace;font-size:13px;color:var(--codefg);white-space:pre-wrap}
.sig{margin-top:12px;padding:12px;background:var(--code);border:1px solid var(--border);border-radius:var(--radius);font-family:ui-monospace,Consolas,monospace;font-size:13px;color:var(--muted);white-space:pre-wrap;word-break:break-word}
.toc{position:sticky;top:0;height:100vh;overflow:auto;padding:32px 16px;border-left:1px solid var(--border)}.toc h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 10px;font-weight:600}.toc ul{list-style:none;margin:0;padding:0}.toc li{margin:3px 0}.toc a{font-size:13px;color:var(--muted);display:block;padding:3px 0}.toc a:hover{color:var(--accent)}
@media (max-width:1100px){.layout{grid-template-columns:240px 1fr}.toc{display:none}}@media (max-width:760px){.layout{grid-template-columns:1fr}.sidebar{position:relative;height:auto}}`;

const navLinks = data.map(d => `<li><a href="#${encodeURIComponent(d.file)}">${esc(d.file)} <span class="count">${d.symbols.length}</span></a></li>`).join('\n');

const sections = data.map(d => {
  const cards = d.symbols.map(s => {
    const params = (s.tags?.params || []).map(x => `<li><code>${esc(x.name)}</code> <span class="file">${esc(x.type)}</span> ${esc(x.desc)}</li>`).join('');
    const ret = s.tags?.returns ? `<div class="returns"><strong>Returns</strong> <code>${esc(s.tags.returns.type)}</code> ${esc(s.tags.returns.desc)}</div>` : '';
    const ex = (s.tags?.examples || []).map(x => `<div class="example">${esc(x)}</div>`).join('');
    return `
    <article class="card">
      <div class="head"><span class="badge">${esc(s.kind)}</span><span class="name">${esc(s.name)}</span></div>
      ${s.doc ? `<div class="doc">${esc(s.doc)}</div>` : ''}
      ${params ? `<ul class="params">${params}</ul>` : ''}
      ${ret}
      ${ex}
      <div class="sig">${esc(s.sig)}</div>
    </article>`;
  }).join('');
  return `<section id="${encodeURIComponent(d.file)}">\n    <h2>${esc(d.file)}</h2>\n    <div class="grid">${cards}</div>\n  </section>`;
}).join('\n');

const tocLinks = data.map(d => `<li><a href="#${encodeURIComponent(d.file)}">${esc(d.file)}</a></li>`).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>docs-from-code</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
<div class="layout">
<aside class="sidebar">
  <div class="brand"><span class="dot"></span>docs-from-code</div>
  <input class="search" id="q" placeholder="Search…"/>
  <h3>Files</h3>
  <nav><ul>${navLinks}</ul></nav>
</aside>
<div class="content">
  <h1>Documentation</h1>
  <p class="intro">Auto-generated from JS/TS/Python source and JSDoc. ${data.length} files · ${data.reduce((n,d)=>n+d.symbols.length,0)} symbols.</p>
  ${sections}
</div>
<aside class="toc">
  <h3>On this page</h3>
  <ul>${tocLinks}</ul>
</aside>
</div>
<script>
const q=document.getElementById('q');
q.addEventListener('input',()=>{const v=q.value.toLowerCase();document.querySelectorAll('.sidebar nav li').forEach(li=>{li.style.display=li.textContent.toLowerCase().includes(v)?'':'none';});
document.querySelectorAll('.content section').forEach(s=>{s.style.display=s.textContent.toLowerCase().includes(v)?'':'none';});});
</script>
</body></html>`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log(`Wrote ${path.join(outDir,'index.html')} (${data.length} files)`);
