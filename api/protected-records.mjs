function text(value) {
  return value === null || value === undefined ? '' : String(value);
}

function context(organizationId, entityType, entityId, field) {
  return {
    organizationId: text(organizationId),
    entityType,
    entityId: text(entityId),
    field
  };
}

function protectValue(dataProtection, value, encryptionContext) {
  const normalized = text(value);
  if (!dataProtection) return normalized;
  if (dataProtection.isProtectedText(normalized)) {
    if (!dataProtection.needsRotation(normalized)) return normalized;
    return dataProtection.protectText(
      dataProtection.unprotectText(normalized, encryptionContext),
      encryptionContext
    );
  }
  return dataProtection.protectText(normalized, encryptionContext);
}

function unprotectValue(dataProtection, value, encryptionContext) {
  if (!dataProtection) return text(value);
  return dataProtection.unprotectText(value, encryptionContext);
}

export function protectCustomerFields(dataProtection, organizationId, item) {
  const entityId = item.id;
  return {
    name: protectValue(dataProtection, item.name, context(organizationId, 'customer', entityId, 'name')),
    phone: protectValue(dataProtection, item.phone, context(organizationId, 'customer', entityId, 'phone')),
    email: protectValue(dataProtection, item.email, context(organizationId, 'customer', entityId, 'email')),
    birthdayCiphertext: protectValue(
      dataProtection,
      item.birthdayCiphertext ?? item.birthday,
      context(organizationId, 'customer', entityId, 'birthday')
    ),
    needs: protectValue(dataProtection, item.needs, context(organizationId, 'customer', entityId, 'needs')),
    note: protectValue(dataProtection, item.note, context(organizationId, 'customer', entityId, 'note'))
  };
}

export function unprotectCustomerFields(dataProtection, row) {
  const organizationId = row.organization_id;
  const entityId = row.id;
  return {
    name: unprotectValue(dataProtection, row.name, context(organizationId, 'customer', entityId, 'name')),
    phone: unprotectValue(dataProtection, row.phone, context(organizationId, 'customer', entityId, 'phone')),
    email: unprotectValue(dataProtection, row.email, context(organizationId, 'customer', entityId, 'email')),
    birthday: unprotectValue(
      dataProtection,
      row.birthday_ciphertext ?? row.birthday,
      context(organizationId, 'customer', entityId, 'birthday')
    ),
    needs: unprotectValue(dataProtection, row.needs, context(organizationId, 'customer', entityId, 'needs')),
    note: unprotectValue(dataProtection, row.note, context(organizationId, 'customer', entityId, 'note'))
  };
}

export function protectPolicyFields(dataProtection, organizationId, item) {
  const entityId = item.id;
  return {
    customerName: protectValue(
      dataProtection,
      item.customerName ?? item.customer,
      context(organizationId, 'policy', entityId, 'customerName')
    ),
    policyNumber: protectValue(
      dataProtection,
      item.policyNumber,
      context(organizationId, 'policy', entityId, 'policyNumber')
    ),
    startDateCiphertext: protectValue(
      dataProtection,
      item.startDateCiphertext ?? item.startDate,
      context(organizationId, 'policy', entityId, 'startDate')
    ),
    coverage: protectValue(
      dataProtection,
      item.coverage,
      context(organizationId, 'policy', entityId, 'coverage')
    ),
    premium: protectValue(
      dataProtection,
      item.premium,
      context(organizationId, 'policy', entityId, 'premium')
    ),
    summary: protectValue(
      dataProtection,
      item.summary,
      context(organizationId, 'policy', entityId, 'summary')
    )
  };
}

export function unprotectPolicyFields(dataProtection, row) {
  const organizationId = row.organization_id;
  const entityId = row.id;
  return {
    customer: unprotectValue(
      dataProtection,
      row.customer_name,
      context(organizationId, 'policy', entityId, 'customerName')
    ),
    policyNumber: unprotectValue(
      dataProtection,
      row.policy_number,
      context(organizationId, 'policy', entityId, 'policyNumber')
    ),
    startDate: unprotectValue(
      dataProtection,
      row.start_date_ciphertext ?? row.start_date,
      context(organizationId, 'policy', entityId, 'startDate')
    ),
    coverage: unprotectValue(
      dataProtection,
      row.coverage,
      context(organizationId, 'policy', entityId, 'coverage')
    ),
    premium: unprotectValue(
      dataProtection,
      row.premium,
      context(organizationId, 'policy', entityId, 'premium')
    ),
    summary: unprotectValue(
      dataProtection,
      row.summary,
      context(organizationId, 'policy', entityId, 'summary')
    )
  };
}

export function protectEventFields(dataProtection, organizationId, item) {
  const entityId = item.id;
  return {
    title: protectValue(dataProtection, item.title, context(organizationId, 'event', entityId, 'title')),
    detail: protectValue(dataProtection, item.detail, context(organizationId, 'event', entityId, 'detail')),
    note: protectValue(dataProtection, item.note, context(organizationId, 'event', entityId, 'note'))
  };
}

export function unprotectEventFields(dataProtection, row) {
  const organizationId = row.organization_id;
  const entityId = row.id;
  return {
    title: unprotectValue(dataProtection, row.title, context(organizationId, 'event', entityId, 'title')),
    detail: unprotectValue(dataProtection, row.detail, context(organizationId, 'event', entityId, 'detail')),
    note: unprotectValue(dataProtection, row.note, context(organizationId, 'event', entityId, 'note'))
  };
}

