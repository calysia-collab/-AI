import { createConfiguredDatabase } from '../api/database-factory.mjs';
import { createAttachmentStorage } from '../api/attachment-storage.mjs';
import { join } from 'node:path';
import { dataProtection, root } from './runtime-security.mjs';

const database = await createConfiguredDatabase({
  environment: process.env,
  root,
  dataProtection
});
try {
  const status = await database.dataProtectionStatus();
  const attachmentStorage = createAttachmentStorage({
    root: process.env.SASHA_ATTACHMENT_DIR || join(root, '.data', 'attachments'),
    dataProtection,
    scanner: null
  });
  const attachmentFiles = await attachmentStorage.protectionStatus(
    await database.listAttachmentsForMaintenance()
  );
  if (status.plaintextValues > 0) {
    throw new Error(
      `Sensitive data audit found ${status.plaintextValues} plaintext values.`
    );
  }
  const oldKeyValues = Object.entries(status.byKeyId)
    .filter(([keyId]) => keyId !== status.currentKeyId)
    .reduce((total, [, count]) => total + count, 0);
  console.log(JSON.stringify({
    status: (
      oldKeyValues
      || attachmentFiles.oldKeyFiles
      || attachmentFiles.plaintextFiles
      || attachmentFiles.missingFiles
    ) ? 'rotation-incomplete' : 'ok',
    ...status,
    oldKeyValues,
    attachmentFiles
  }, null, 2));
  if (
    oldKeyValues
    || attachmentFiles.oldKeyFiles
    || attachmentFiles.plaintextFiles
    || attachmentFiles.missingFiles
  ) {
    process.exitCode = 2;
  }
} finally {
  await database.close();
}
