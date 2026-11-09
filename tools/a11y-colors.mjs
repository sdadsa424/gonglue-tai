import fs from 'node:fs';
const css = fs.readFileSync('assets/style.css', 'utf8');
const vars = {};
for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) vars[m[1]] = m[2];
const lum = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const v = [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const cr = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return +((x + 0.05) / (y + 0.05)).toFixed(2);
};
console.log('bg', vars.bg, 'bg-2', vars['bg-2'], 'card', vars.card);
for (const k of ['text', 'muted', 'dim']) {
  if (!vars[k]) continue;
  console.log(k.padEnd(6), vars[k], 'on bg', cr(vars[k], vars.bg), '| card', cr(vars[k], vars.card));
}

// 小于 12px 的字号
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
const small = [];
for (const r of rules) {
  const m = r[2].match(/font-size:\s*(1[01](?:\.\d+)?px)/);
  if (m) small.push(r[1].trim().split('\n').pop().trim().slice(0, 54) + ' → ' + m[1]);
}
console.log('\n<12px 字号规则：' + small.length);
small.slice(0, 10).forEach((s) => console.log('  ' + s));
