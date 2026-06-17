import { inflateRawSync } from 'node:zlib';

const maximumRows = 50_000;

function decodeXml(value) {
  return String(value || '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function parseCsvRows(source) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(source || '').replace(/^\uFEFF/, '');
  for (let index = 0; index <= input.length; index += 1) {
    const character = input[index] ?? '\n';
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      field = '';
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
    } else {
      field += character;
    }
  }
  return rows;
}

function findEndOfCentralDirectory(buffer) {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('INVALID_XLSX_ARCHIVE');
}

function unzipEntries(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('INVALID_XLSX_DIRECTORY');
    }
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString('utf8')
      .replaceAll('\\', '/');
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error('INVALID_XLSX_LOCAL_HEADER');
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    if (compression === 0) {
      entries.set(name, Buffer.from(compressed));
    } else if (compression === 8) {
      entries.set(name, inflateRawSync(compressed));
    } else {
      throw new Error('UNSUPPORTED_XLSX_COMPRESSION');
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function columnIndex(cellReference) {
  const letters = String(cellReference || '').match(/^[A-Z]+/i)?.[0]?.toUpperCase() || 'A';
  let result = 0;
  for (const character of letters) {
    result = result * 26 + character.charCodeAt(0) - 64;
  }
  return result - 1;
}

function xmlText(node) {
  return decodeXml(
    [...String(node || '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((match) => match[1])
      .join('')
  );
}

function parseXlsxRows(buffer) {
  const entries = unzipEntries(buffer);
  const sharedStrings = entries.has('xl/sharedStrings.xml')
    ? [...entries.get('xl/sharedStrings.xml').toString('utf8').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)]
        .map((match) => xmlText(match[1]))
    : [];
  const worksheetName = [...entries.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }))[0];
  if (!worksheetName) throw new Error('XLSX_WORKSHEET_NOT_FOUND');
  const worksheet = entries.get(worksheetName).toString('utf8');
  const rows = [];
  for (const rowMatch of worksheet.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1];
      const body = cellMatch[2];
      const reference = attributes.match(/\br="([^"]+)"/)?.[1] || `A${rows.length + 1}`;
      const type = attributes.match(/\bt="([^"]+)"/)?.[1] || '';
      const raw = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1] || '';
      let value = decodeXml(raw);
      if (type === 's') value = sharedStrings[Number(raw)] || '';
      if (type === 'inlineStr') value = xmlText(body);
      row[columnIndex(reference)] = value;
    }
    if (row.some((value) => text(value).trim())) rows.push(row);
  }
  return rows;
}

function text(value) {
  return value === null || value === undefined ? '' : String(value);
}

function normalizeHeader(value) {
  return text(value)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s_./\\()-]+/g, '');
}

const headerMappings = {
  id: ['id', '客戶id', '客戶編號', '編號'],
  name: ['name', '姓名', '客戶姓名', '客戶'],
  phone: ['phone', 'mobile', '手機', '手機號碼', '電話', '聯絡電話'],
  email: ['email', '電子郵件', '信箱'],
  birthday: ['birthday', 'birthdate', '生日', '出生日期'],
  ownerUserId: ['owneruserid', '顧問帳號id', '負責顧問id'],
  owner: ['owner', 'advisor', '負責顧問', '業務員'],
  stage: ['stage', '服務階段', '階段'],
  nextFollowUp: ['nextfollowup', '下次追蹤', '下次追蹤日期'],
  needs: ['needs', '保障需求', '主要保障需求'],
  note: ['note', '備註', '服務備註']
};

function mapRows(rows) {
  if (!rows.length) return [];
  const propertyByHeader = new Map();
  for (const [property, aliases] of Object.entries(headerMappings)) {
    for (const alias of aliases) propertyByHeader.set(normalizeHeader(alias), property);
  }
  const headers = rows[0].map((header) => propertyByHeader.get(normalizeHeader(header)) || null);
  if (!headers.includes('name')) throw new Error('IMPORT_NAME_COLUMN_REQUIRED');
  const items = [];
  for (const row of rows.slice(1)) {
    const item = {};
    headers.forEach((property, index) => {
      if (property) item[property] = text(row[index]).trim();
    });
    if (!item.name && !Object.values(item).some(Boolean)) continue;
    item.stage ||= '新名單';
    items.push(item);
    if (items.length > maximumRows) throw new Error('IMPORT_ROW_LIMIT_EXCEEDED');
  }
  return items;
}

export function parseTabularImport(buffer, format) {
  const normalizedFormat = text(format).toLowerCase();
  const rows = normalizedFormat === 'csv'
    ? parseCsvRows(Buffer.from(buffer).toString('utf8'))
    : normalizedFormat === 'xlsx'
      ? parseXlsxRows(Buffer.from(buffer))
      : null;
  if (!rows) throw new Error('UNSUPPORTED_IMPORT_FORMAT');
  return mapRows(rows);
}

export function csvEscape(value) {
  const normalized = text(value);
  return /[",\r\n]/.test(normalized)
    ? `"${normalized.replaceAll('"', '""')}"`
    : normalized;
}
