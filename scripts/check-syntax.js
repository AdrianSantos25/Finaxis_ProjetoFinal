const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const pug = require('pug');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function checkJs(file) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

function checkPug(file) {
  pug.compileFile(file);
}

function main() {
  const root = process.cwd();
  const files = walk(path.join(root, 'src')).concat(walk(path.join(root, 'scripts')));
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  const pugFiles = files.filter((f) => f.endsWith('.pug'));

  const errors = [];

  for (const file of jsFiles) {
    try {
      checkJs(file);
    } catch (err) {
      errors.push(`JS: ${path.relative(root, file)}\n${String(err.stderr || err.message)}`);
    }
  }

  for (const file of pugFiles) {
    try {
      checkPug(file);
    } catch (err) {
      errors.push(`PUG: ${path.relative(root, file)}\n${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(errors.join('\n\n'));
    process.exit(1);
  }

  console.log(`OK: ${jsFiles.length} ficheiros JS e ${pugFiles.length} ficheiros Pug validados.`);
}

main();
