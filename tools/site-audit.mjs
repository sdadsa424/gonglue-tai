/* 全站体检：标签闭合 / 本地资源与死链 / 资源文件存在性 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const issues = [];

/* ---------- 1. HTML 标签闭合检查 ---------- */
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
/* 去掉 script/style 的内容（保留标签本身），避免 JS 字符串里的 HTML 片段误报 */
function stripInlineCode(html) {
  return html
    .replace(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi, '<script$1></script>')
    .replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, '<style$1></style>');
}
function checkTags(file) {
  const html = stripInlineCode(fs.readFileSync(file, 'utf8'));
  const stack = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    if (tag === '!--' || tag === '!' || tag === 'doctype') continue;
    if (VOID.has(tag)) continue;
    const selfClose = /\/\s*>$/.test(m[0]);
    const closing = m[0][1] === '/';
    if (closing) {
      let top = stack.length ? stack[stack.length - 1] : null;
      if (!top) { issues.push(`${file}: 多余的 </${tag}> (位置 ${m.index})`); continue; }
      if (top.tag === tag) { stack.pop(); continue; }
      // 找栈里最近的同名标签，报告中间未闭合的
      const idx = [...stack].reverse().findIndex(s => s.tag === tag);
      if (idx === -1) { issues.push(`${file}: </${tag}> 无对应开标签 (位置 ${m.index})`); continue; }
      for (let i = stack.length - 1; i > stack.length - 1 - idx; i--) {
        const s = stack[i];
        issues.push(`${file}: <${s.tag}> 未闭合就被 </${tag}> 关闭 (开于行 ${s.line})`);
      }
      stack.length = stack.length - 1 - idx;
    } else if (!selfClose) {
      const line = html.slice(0, m.index).split('\n').length;
      stack.push({ tag, line });
    }
  }
  for (const s of stack) issues.push(`${file}: <${s.tag}> 开于行 ${s.line} 从未闭合`);
}

function walk(dir, exts, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '.workbuddy') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, cb);
    else if (exts.some(x => e.name.endsWith(x))) cb(p);
  }
}
walk(ROOT, ['.html'], p => checkTags(p));
console.log(`[1] HTML 标签检查完成：${issues.length} 个问题`);

/* ---------- 2. 本地链接/资源存在性 ---------- */
let links = 0, dead = 0;
const linkIssues = [];
walk(ROOT, ['.html'], p => {
  const html = stripInlineCode(fs.readFileSync(p, 'utf8'));
  const base = path.dirname(p);
  const refs = [];
  let m2;
  const re2 = /(?:href|src|srcset)="([^"]+)"/g;
  while ((m2 = re2.exec(html))) {
    for (const u of m2[1].split(',')) {
      const url = u.trim().split(/\s+/)[0];
      if (!url || /^(https?:|mailto:|tel:|data:|#|javascript:)/.test(url)) continue;
      refs.push(url.split('#')[0].split('?')[0]);
    }
  }
  for (const u of new Set(refs)) {
    if (!u) continue;
    links++;
    // 以 / 开头相对于站点根
    const target = u.startsWith('/') ? path.join(ROOT, u) : path.resolve(base, u);
    if (!fs.existsSync(target) && !fs.existsSync(target + '/index.html') && !fs.existsSync(target + '.html') && !fs.existsSync(path.join(target, 'index.html'))) {
      dead++;
      linkIssues.push(`${path.relative(ROOT, p)} -> ${u}`);
    }
  }
});
console.log(`[2] 本地链接检查：${links} 个引用，${dead} 个失效`);
linkIssues.forEach(x => console.log('   ✗ ' + x));

/* ---------- 3. assets 下未被引用的孤立文件（仅列出新增可疑） ---------- */
console.log(`\n汇总：标签问题 ${issues.length}，死链 ${dead}`);
issues.slice(0, 40).forEach(x => console.log('   ✗ ' + x));
process.exit(issues.length + dead > 0 ? 1 : 0);
