import process from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  hashPassword,
  validatePasswordPayload,
  verifyPassword
} from '../api/auth.mjs';
import { createConfiguredDatabase } from '../api/database-factory.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function parseRecoveryArguments(args) {
  const options = {
    confirm: false,
    disableMfa: false,
    username: ''
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = String(args[index]);
    if (argument === '--confirm') {
      options.confirm = true;
    } else if (argument === '--disable-mfa') {
      options.disableMfa = true;
    } else if (argument.startsWith('--username=')) {
      options.username = argument.slice('--username='.length).trim().toLowerCase();
    } else if (argument === '--username') {
      options.username = String(args[index + 1] || '').trim().toLowerCase();
      index += 1;
    } else {
      throw new Error(`不支援的參數：${argument}`);
    }
  }
  if (!options.username) {
    throw new Error('請使用 --username 指定要復原的登入帳號。');
  }
  return options;
}

export async function recoverAccount(database, {
  confirm = false,
  disableMfa = false,
  password = '',
  username
}) {
  const user = await database.getUserByUsername(String(username || '').trim().toLowerCase());
  if (!user || !user.active) throw new Error('ACCOUNT_NOT_FOUND_OR_INACTIVE');

  const preview = {
    account: {
      displayName: user.displayName,
      mfaEnabled: Boolean(user.mfaEnabled),
      role: user.role,
      username: user.username
    },
    action: confirm ? 'recover' : 'preview',
    disableMfa: Boolean(disableMfa)
  };
  if (!confirm) return preview;

  const validation = validatePasswordPayload({ password });
  if (!validation.valid) {
    const error = new Error('RECOVERY_PASSWORD_INVALID');
    error.details = validation.errors;
    throw error;
  }
  if (await verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    throw new Error('RECOVERY_PASSWORD_MUST_BE_NEW');
  }

  const nextPassword = await hashPassword(validation.value.password);
  const result = await database.recoverOrganizationUser(
    user.organizationId,
    user.id,
    nextPassword.hash,
    nextPassword.salt,
    { disableMfa }
  );
  if (result.notFound) throw new Error('ACCOUNT_NOT_FOUND_OR_INACTIVE');

  return {
    ...preview,
    status: 'recovered',
    sessionsInvalidated: true
  };
}

async function main() {
  const options = parseRecoveryArguments(process.argv.slice(2));
  const password = String(process.env.SASHA_RECOVERY_PASSWORD || '');
  if (options.confirm && !password) {
    throw new Error('正式復原前，請先設定暫時性的 SASHA_RECOVERY_PASSWORD 環境變數。');
  }

  const database = await createConfiguredDatabase({
    environment: process.env,
    root
  });
  try {
    const result = await recoverAccount(database, { ...options, password });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await database.close();
  }
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (entry === import.meta.url) {
  main().catch((error) => {
    const details = Array.isArray(error.details) ? `\n${error.details.join('\n')}` : '';
    console.error(`${error.message}${details}`);
    process.exitCode = 1;
  });
}
