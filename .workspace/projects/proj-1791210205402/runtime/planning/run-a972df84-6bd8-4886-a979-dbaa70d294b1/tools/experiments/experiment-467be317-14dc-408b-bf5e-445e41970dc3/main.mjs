
const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (f === 'node_modules' || f === '.git' || f === '.workspace') continue;
    try {
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        searchDir(full, query);
      } else if (f.endsWith('.ts') || f.endsWith('.js')) {
        const content = fs.readFileSync(full, 'utf-8');
        if (content.includes(query)) {
          console.log('Found in:', full);
        }
      }
    } catch (e) {}
  }
}

// Search in parent directory (repo root)
searchDir('D:\\桌面\\项目构思\\packages', '必须指向实际原文');
