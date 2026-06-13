export function assertProductionReadiness(environment = process.env) {
  if (environment.NODE_ENV !== 'production') return;
  const required = [
    'SASHA_DATABASE_URL',
    'SASHA_MASTER_KEY',
    'SASHA_DATA_KEYS',
    'SASHA_DATA_KEY_ID',
    'SASHA_CLAMD_HOST'
  ];
  const missing = required.filter((name) => !String(environment[name] || '').trim());
  if (missing.length) {
    throw new Error(`Production configuration is missing: ${missing.join(', ')}`);
  }
  if (environment.SASHA_COOKIE_SECURE !== 'true') {
    throw new Error('Production requires SASHA_COOKIE_SECURE=true.');
  }
  if (environment.SASHA_TRUST_PROXY !== 'true') {
    throw new Error('Production requires SASHA_TRUST_PROXY=true behind the HTTPS proxy.');
  }
  if (environment.SASHA_ATTACHMENT_ALLOW_UNSCANNED === 'true') {
    throw new Error('Production cannot allow unscanned attachments.');
  }
  if (String(environment.SASHA_DATABASE_SSL || '').toLowerCase() !== 'verify-full') {
    throw new Error('Production requires SASHA_DATABASE_SSL=verify-full.');
  }
}

