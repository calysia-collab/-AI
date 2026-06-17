import { randomUUID } from 'node:crypto';

function fixtureFields() {
  return [
    { name: 'company', label: '保險公司', value: '示範人壽', confidence: 0.98 },
    { name: 'policyNumber', label: '保單號碼', value: 'TW-2026-061188', confidence: 0.91 },
    { name: 'type', label: '險種', value: '終身壽險', confidence: 0.94 },
    { name: 'startDate', label: '契約始期', value: '2021-08-15', confidence: 0.9 },
    { name: 'paymentYears', label: '繳費年期', value: '20 年', confidence: 0.88 },
    { name: 'coverage', label: '主約保額', value: '2,000,000', confidence: 0.93 },
    { name: 'premium', label: '年繳保費', value: '48,600', confidence: 0.89 },
    {
      name: 'summary',
      label: '保障摘要',
      value: '身故保險金 200 萬元；住院日額 2,000 元；手術醫療最高 10 萬元。',
      confidence: 0.84
    }
  ];
}

function createProvider(environment = process.env) {
  const configured = String(environment.SASHA_OCR_PROVIDER || '').trim().toLowerCase();
  const endpoint = String(environment.SASHA_OCR_ENDPOINT || '').trim();
  if (configured === 'fixture' || (!configured && environment.NODE_ENV !== 'production')) {
    return {
      name: 'fixture',
      extract: async () => fixtureFields()
    };
  }
  if (configured === 'http' && endpoint) {
    return {
      name: 'http',
      async extract({ attachment, buffer }) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(environment.SASHA_OCR_API_KEY
              ? { Authorization: `Bearer ${environment.SASHA_OCR_API_KEY}` }
              : {})
          },
          body: JSON.stringify({
            fileName: attachment.originalName,
            mediaType: attachment.mediaType,
            imageBase64: buffer.toString('base64')
          }),
          signal: AbortSignal.timeout(
            Math.max(5_000, Number(environment.SASHA_OCR_TIMEOUT_MS) || 60_000)
          )
        });
        if (!response.ok) throw new Error(`OCR_PROVIDER_HTTP_${response.status}`);
        const payload = await response.json();
        if (!Array.isArray(payload.fields)) throw new Error('OCR_PROVIDER_INVALID_RESPONSE');
        return payload.fields.map((field) => ({
          name: String(field.name || ''),
          label: String(field.label || field.name || ''),
          value: String(field.value || ''),
          confidence: Math.min(Math.max(Number(field.confidence || 0), 0), 1)
        }));
      }
    };
  }
  return {
    name: configured || 'unconfigured',
    extract: async () => {
      throw new Error('OCR_PROVIDER_NOT_CONFIGURED');
    }
  };
}

export function createOcrService({
  database,
  attachmentStorage,
  environment = process.env
}) {
  const provider = createProvider(environment);
  const running = new Set();

  async function process(organizationId, jobId, accessUserId = null) {
    if (running.has(jobId)) return;
    running.add(jobId);
    const startedAt = new Date().toISOString();
    try {
      await database.setOcrJobResult(organizationId, jobId, {
        status: 'processing',
        startedAt
      });
      const job = await database.getOcrJob(organizationId, jobId);
      if (!job) return;
      const attachment = await database.getOrganizationAttachment(
        organizationId,
        job.attachmentId,
        accessUserId
      );
      if (!attachment || attachment.status !== 'clean') {
        throw new Error('OCR_ATTACHMENT_NOT_CLEAN');
      }
      const fields = await provider.extract({
        attachment,
        buffer: await attachmentStorage.read(attachment)
      });
      await database.setOcrJobResult(organizationId, jobId, {
        status: 'review_required',
        fields,
        startedAt,
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('OCR processing failed.', error);
      await database.setOcrJobResult(organizationId, jobId, {
        status: 'failed',
        errorCode: String(error?.message || 'OCR_PROCESSING_FAILED').slice(0, 120),
        startedAt,
        completedAt: new Date().toISOString()
      }).catch(() => {});
    } finally {
      running.delete(jobId);
    }
  }

  async function create({
    organizationId,
    actorUserId,
    attachmentId,
    customerId,
    accessUserId
  }) {
    const attachment = await database.getOrganizationAttachment(
      organizationId,
      attachmentId,
      accessUserId
    );
    if (!attachment || attachment.status !== 'clean') {
      throw new Error('OCR_ATTACHMENT_NOT_CLEAN');
    }
    if (attachment.customerId && attachment.customerId !== customerId) {
      throw new Error('OCR_CUSTOMER_MISMATCH');
    }
    const result = await database.createOcrJob(
      organizationId,
      actorUserId,
      { attachmentId, customerId, provider: provider.name }
    );
    setImmediate(() => process(organizationId, result.item.id, accessUserId));
    return result.item;
  }

  async function approve({
    organizationId,
    actorUserId,
    jobId,
    accessUserId
  }) {
    const job = await database.getOcrJob(organizationId, jobId);
    if (!job) return { notFound: true };
    if (job.status !== 'review_required') return { conflict: true, item: job };
    const values = Object.fromEntries(job.fields.map((field) => [field.name, field.value]));
    const customer = await database.getOrganizationCustomer(
      organizationId,
      job.customerId,
      accessUserId
    );
    if (!customer) throw new Error('CUSTOMER_ACCESS_DENIED');
    const policyId = `policy-ocr-${jobId}`;
    let policy = await database.getOrganizationPolicy(
      organizationId,
      policyId,
      accessUserId
    );
    if (!policy) {
      const result = await database.createOrganizationPolicy(
        organizationId,
        actorUserId,
        {
          id: policyId,
          customerId: job.customerId,
          customer: customer.name,
          company: values.company || '待確認',
          policyNumber: values.policyNumber || '',
          type: values.type || '',
          startDate: values.startDate || '',
          paymentYears: values.paymentYears || '',
          coverage: values.coverage || '',
          premium: values.premium || '',
          summary: values.summary || '',
          updated: new Date().toISOString().slice(0, 10).replaceAll('-', '/')
        },
        accessUserId
      );
      policy = result.item;
    }
    const approval = await database.approveOcrJob(
      organizationId,
      actorUserId,
      jobId,
      policy.id
    );
    return { ...approval, policy };
  }

  async function resumePending() {
    const jobs = await database.listRecoverableOcrJobs();
    for (const job of jobs) {
      setImmediate(() => process(job.organizationId, job.id));
    }
    return jobs.length;
  }

  return {
    approve,
    create,
    process,
    provider: provider.name,
    resumePending
  };
}
