const crypto = require('crypto');

const size = Number(process.argv[2] || 48);
if (!Number.isInteger(size) || size < 32) {
  console.error('Use um tamanho inteiro >= 32 bytes. Exemplo: node scripts/generate-session-secret.js 48');
  process.exit(1);
}

const secret = crypto.randomBytes(size).toString('hex');
console.log(secret);
