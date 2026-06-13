import { randomUUID } from 'node:crypto';

import { hashPassword, validateAccountPayload } from '../api/auth.mjs';
import { createConfiguredDatabase } from '../api/database-factory.mjs';
import { dataProtection, root } from './runtime-security.mjs';

if (process.env.SASHA_BOOTSTRAP_ENABLED !== 'true') {
  throw new Error('Set SASHA_BOOTSTRAP_ENABLED=true to run the one-time owner bootstrap.');
}

const payload = {
  organizationName: process.env.SASHA_BOOTSTRAP_ORGANIZATION,
  displayName: process.env.SASHA_BOOTSTRAP_DISPLAY_NAME,
  username: process.env.SASHA_BOOTSTRAP_USERNAME,
  password: process.env.SASHA_BOOTSTRAP_PASSWORD
};
const validation = validateAccountPayload(payload, { setup: true });
if (!validation.valid) {
  throw new Error(`Invalid bootstrap owner settings: ${validation.errors.join('; ')}`);
}

const database = await createConfiguredDatabase({
  environment: process.env,
  root,
  dataProtection
});

try {
  const existingUsers = await database.countUsers();
  if (existingUsers > 0) {
    const existing = await database.getUserByUsername(validation.value.username);
    if (!existing) {
      throw new Error('Owner bootstrap refused because another account already exists.');
    }
    console.log(JSON.stringify({
      status: 'already-configured',
      organizationId: existing.organizationId,
      username: existing.username
    }, null, 2));
  } else {
    const password = await hashPassword(validation.value.password);
    const result = await database.createOrganizationOwner({
      organizationId: `org-${randomUUID()}`,
      organizationName: validation.value.organizationName,
      userId: `user-${randomUUID()}`,
      displayName: validation.value.displayName,
      username: validation.value.username,
      passwordHash: password.hash,
      passwordSalt: password.salt
    });
    console.log(JSON.stringify({
      status: 'created',
      organizationId: result.user.organizationId,
      username: result.user.username
    }, null, 2));
  }
} finally {
  await database.close();
}
