const fs = require('fs');
const path = require('path');

function parseEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Ficheiro nao encontrado: ${envPath}`);
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const data = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    data[key] = value;
  }

  return data;
}

function isMissing(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function validate(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function main() {
  const envArg = process.argv[2] || '.env';
  const envPath = path.resolve(process.cwd(), envArg);
  const env = parseEnvFile(envPath);

  const required = [
    'NODE_ENV',
    'APP_BASE_URL',
    'SESSION_SECRET',
    'DB_HOST',
    'DB_USER',
    'DB_NAME',
    'DB_PORT',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASS',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_PRO',
    'STRIPE_PRICE_BUSINESS'
  ];

  const errors = [];

  for (const key of required) {
    if (isMissing(env[key])) errors.push(`${key}: em falta`);
  }

  if (!isMissing(env.NODE_ENV) && env.NODE_ENV !== 'production') {
    errors.push('NODE_ENV: deve ser production');
  }

  if (!isMissing(env.APP_BASE_URL) && !validate(env.APP_BASE_URL)) {
    errors.push('APP_BASE_URL: URL invalida');
  }

  if (!isMissing(env.SESSION_SECRET) && env.SESSION_SECRET.length < 64) {
    errors.push('SESSION_SECRET: recomendado >= 64 caracteres');
  }

  if (!isMissing(env.SMTP_SECURE) && !['true', 'false'].includes(env.SMTP_SECURE.toLowerCase())) {
    errors.push('SMTP_SECURE: use true ou false');
  }

  if (!isMissing(env.STRIPE_PRICE_PRO) && !env.STRIPE_PRICE_PRO.startsWith('price_')) {
    errors.push('STRIPE_PRICE_PRO: formato esperado price_...');
  }

  if (!isMissing(env.STRIPE_PRICE_BUSINESS) && !env.STRIPE_PRICE_BUSINESS.startsWith('price_')) {
    errors.push('STRIPE_PRICE_BUSINESS: formato esperado price_...');
  }

  if (errors.length > 0) {
    console.error('Validacao de producao falhou:');
    for (const err of errors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  console.log(`OK: ambiente ${envArg} valido para producao.`);
}

main();
