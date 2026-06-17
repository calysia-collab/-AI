import { randomUUID } from 'node:crypto';

import { csvEscape, parseTabularImport } from './tabular-import.mjs';
import { validateCustomerPayload } from './validation.mjs';

const batchSize = 50;

function waitForTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

function normalizeImportCustomer(row, index, session) {
  const generatedId = !row.id;
  return {
    id: row.id || `customer-${randomUUID()}`,
    name: String(row.name || '').trim(),
    phone: String(row.phone || '').trim(),
    email: String(row.email || '').trim(),
    birthday: String(row.birthday || '').trim(),
    ownerUserId: row.ownerUserId || session.defaultOwnerUserId || '',
    owner: row.owner || session.defaultOwner || '',
    stage: row.stage || '新名單',
    nextFollowUp: row.nextFollowUp || '',
    needs: row.needs || '',
    note: row.note || '',
    importRow: row.importRow || index + 2,
    generatedImportId: row.generatedImportId === true || generatedId
  };
}

export function createImportJobService(database) {
  const running = new Set();

  async function processJob(organizationId, actorUserId, jobId, session) {
    if (running.has(jobId)) return;
    running.add(jobId);
    let processed = 0;
    let imported = 0;
    let previousFailed = 0;
    let previousErrorCsv = '';
    const errors = [];
    try {
      const payload = await database.getImportJobPayload(organizationId, jobId);
      if (!payload) return;
      const current = await database.getImportJob(organizationId, jobId);
      if (!current || !['queued', 'processing'].includes(current.status)) return;
      processed = Math.min(current.processed || 0, payload.rows.length);
      imported = current.imported || 0;
      previousFailed = current.failed || 0;
      previousErrorCsv = payload.errorCsv || '';
      await database.updateImportJob(organizationId, jobId, {
        status: 'processing',
        processed,
        imported,
        failed: previousFailed,
        startedAt: new Date().toISOString()
      });
      for (let index = processed; index < payload.rows.length; index += 1) {
        const raw = payload.rows[index];
        const latest = await database.getImportJob(organizationId, jobId);
        if (!latest || latest.cancelRequested) {
          await database.updateImportJob(organizationId, jobId, {
            status: 'cancelled',
            processed,
            imported,
            failed: previousFailed + errors.length,
            errorCsv: mergeErrorCsv(previousErrorCsv, buildErrorCsv(errors)),
            completedAt: new Date().toISOString()
          });
          return;
        }
        const item = normalizeImportCustomer(raw, index, session);
        const validation = validateCustomerPayload(item);
        if (!validation.valid) {
          errors.push({
            row: item.importRow,
            id: item.id,
            name: item.name,
            error: validation.errors.join('；')
          });
        } else {
          try {
            await database.createOrganizationCustomer(
              organizationId,
              actorUserId,
              item,
              null
            );
            imported += 1;
          } catch (error) {
            const duplicate = error?.code === '23505'
              || String(error?.message || '').includes('UNIQUE');
            const recovered = duplicate
              && item.generatedImportId
              && await database.getOrganizationCustomer(organizationId, item.id, null);
            if (recovered) {
              imported += 1;
            } else {
              errors.push({
                row: item.importRow,
                id: item.id,
                name: item.name,
                error: duplicate ? '客戶編號已存在' : '資料寫入失敗'
              });
            }
          }
        }
        processed += 1;
        if (processed % batchSize === 0 || processed === payload.rows.length) {
          await database.updateImportJob(organizationId, jobId, {
            status: 'processing',
            processed,
            imported,
            failed: previousFailed + errors.length
          });
          await waitForTurn();
        }
      }
      await database.updateImportJob(organizationId, jobId, {
        status: errors.length ? 'completed_with_errors' : 'completed',
        processed,
        imported,
        failed: previousFailed + errors.length,
        errorCsv: mergeErrorCsv(previousErrorCsv, buildErrorCsv(errors)),
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Customer import job failed.', error);
      await database.updateImportJob(organizationId, jobId, {
        status: 'failed',
        processed,
        imported,
        failed: previousFailed + errors.length + 1,
        errorCsv: mergeErrorCsv(previousErrorCsv, buildErrorCsv([
          ...errors,
          { row: '', id: '', name: '', error: '匯入工作發生未預期錯誤' }
        ])),
        completedAt: new Date().toISOString()
      }).catch(() => {});
    } finally {
      running.delete(jobId);
    }
  }

  function buildErrorCsv(errors) {
    if (!errors.length) return '';
    return [
      ['資料列', '客戶編號', '客戶姓名', '錯誤原因'],
      ...errors.map((item) => [item.row, item.id, item.name, item.error])
    ].map((row) => row.map(csvEscape).join(',')).join('\r\n');
  }

  function mergeErrorCsv(previous, current) {
    if (!previous) return current;
    if (!current) return previous;
    return `${previous.trimEnd()}\r\n${current.split(/\r?\n/).slice(1).join('\r\n')}`;
  }

  async function create({
    organizationId,
    actorUserId,
    fileName,
    format,
    buffer,
    defaultOwnerUserId,
    defaultOwner
  }) {
    const rows = parseTabularImport(buffer, format);
    if (!rows.length) throw new Error('IMPORT_HAS_NO_ROWS');
    const preparedRows = rows.map((row, index) => normalizeImportCustomer(row, index, {
      defaultOwnerUserId,
      defaultOwner
    }));
    const result = await database.createImportJob(
      organizationId,
      actorUserId,
      { fileName, format, rows: preparedRows }
    );
    setImmediate(() => {
      processJob(organizationId, actorUserId, result.item.id, {
        defaultOwnerUserId,
        defaultOwner
      });
    });
    return result.item;
  }

  async function resumePending() {
    const jobs = await database.listRecoverableImportJobs();
    for (const job of jobs) {
      setImmediate(() => {
        processJob(job.organizationId, job.uploadedBy, job.id, {
          defaultOwnerUserId: '',
          defaultOwner: ''
        });
      });
    }
    return jobs.length;
  }

  return {
    create,
    processJob,
    resumePending
  };
}
