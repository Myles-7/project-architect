const fs = require('fs');
const path = require('path');
console.log('CWD:', process.cwd());
// find files mentioning "必须指向实际原文"
function searchDir(dir) {
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (file === 'node_modules' || file === '.git' || file === '.workspace') continue;
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        searchDir(full);
      } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.json')) {
        const text = fs.readFileSync(full, 'utf8');
        if (text.includes('必须指向实际原文')) {
          console.log('Found match in:', full);
        }
      }
    }
  } catch (e) {}
}
searchDir('D:/桌面/项目构思/packages');
