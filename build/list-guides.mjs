import fs from 'node:fs';
let s = fs.readFileSync('assets/data.js', 'utf8');
const cut = s.indexOf(']\n\n/* Node');
if (cut > 0) s = s.slice(0, cut + 1);
const re = /\{\s*id:\s*'([a-z0-9-]+)'\s*,\s*game:\s*'([a-z0-9]+)'/g;
let m; const ids = [];
while ((m = re.exec(s))) ids.push([m[1], m[2]]);
console.log('总数:', ids.length);
console.log('luna2:', ids.filter(x => x[1] === 'luna2').map(x => x[0]).join(', '));
console.log('yxlc:', ids.filter(x => x[1] === 'yxlc').map(x => x[0]).join(', '));
// 打印一个 luna2 条目的完整结构
const one = s.match(/\{\s*id:\s*'luna2-skill'[\s\S]*?\n  \},/);
console.log(one ? one[0] : 'sample not found');
