const fs = require('fs');
const path = require('path');

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      const content = fs.readFileSync(p, 'utf8');
      const lines = content.split('\n');
      lines.forEach((l, i) => {
        if (/key=\{[^}]*\}/.test(l)) {
          if (l.includes('input') || l.includes('evidence') || l.includes('ref') || l.includes('item') || l.includes('`')) {
            console.log(`${p}:${i + 1}: ${l.trim()}`);
          }
        }
      });
    }
  }
}

walk('apps/web/src');
