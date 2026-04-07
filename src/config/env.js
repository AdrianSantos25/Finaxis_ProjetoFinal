function parseBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing = [];

  if (isProduction) {
    const required = ['SESSION_SECRET', 'APP_BASE_URL', 'DB_HOST', 'DB_USER', 'DB_NAME'];
    for (const key of required) {
      if (!process.env[key] || !String(process.env[key]).trim()) {
        missing.push(key);
      }
    }

    if (!process.env.SESSION_SECRET || String(process.env.SESSION_SECRET).length < 32) {
      missing.push('SESSION_SECRET(min:32)');
    }
  }

  if (missing.length > 0) {
    throw new Error(`Variaveis de ambiente obrigatorias em falta: ${missing.join(', ')}`);
  }
}

function getSessionCookieSettings() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? 'lax' : 'strict',
    maxAge: 24 * 60 * 60 * 1000
  };
}

module.exports = {
  parseBoolean,
  validateEnvironment,
  getSessionCookieSettings
};
