export function isContactPickerSupported() {
  return Boolean(window.isSecureContext && 'contacts' in navigator && 'ContactsManager' in window);
}

export function getContactPickerUnavailableReason() {
  if (!window.isSecureContext) {
    return 'A seleção direta de contatos só funciona em acesso seguro (HTTPS ou localhost). Use a importação por arquivo .vcf/.csv neste acesso.';
  }
  if (!('contacts' in navigator) || !('ContactsManager' in window)) {
    return 'Este navegador não permite selecionar contatos diretamente. Exporte seus contatos como .vcf ou .csv e importe pelo arquivo.';
  }
  return 'A seleção direta de contatos não está disponível neste navegador. Use a importação por arquivo .vcf/.csv.';
}

export async function pickContactsFromDevice() {
  if (!isContactPickerSupported()) {
    throw new Error(getContactPickerUnavailableReason());
  }

  const availableProperties = await navigator.contacts.getProperties();
  const properties = ['name', 'tel'].filter((property) => availableProperties.includes(property));

  if (!properties.includes('tel')) {
    throw new Error('Este navegador não liberou telefones dos contatos.');
  }

  return navigator.contacts.select(properties, { multiple: true });
}

export async function parseContactsFile(file) {
  const text = await file.text();
  const extension = file.name.split('.').pop().toLowerCase();

  if (extension === 'vcf' || text.includes('BEGIN:VCARD')) {
    return parseVCard(text);
  }

  return parseCSV(text);
}

function parseVCard(text) {
  return text
    .split(/END:VCARD/i)
    .map((card) => {
      const name = readVCardField(card, 'FN') || readVCardField(card, 'N');
      const tel = readVCardField(card, 'TEL');
      return normalizeContact({ name: [name].filter(Boolean), tel: [tel].filter(Boolean) });
    })
    .filter((contact) => contact.name && contact.phone);
}

function readVCardField(card, field) {
  const line = card
    .split(/\r?\n/)
    .find((item) => item.toUpperCase().startsWith(field) || item.toUpperCase().startsWith(`${field};`));

  if (!line) return '';
  return line.slice(line.indexOf(':') + 1).replace(/\\,/g, ',').replace(/\\;/g, ';').trim();
}

function parseCSV(text) {
  const lines = text.split(new RegExp('\\r?\\n')).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const delimiter = detectCSVDelimiter(lines[0]);
  const headers = splitCSVLine(lines[0], delimiter).map((header) => header.trim().toLowerCase());
  const nameIndex = findHeader(headers, ['nome', 'name', 'contato', 'contact', 'nome completo', 'full name']);
  const phoneIndex = findHeader(headers, ['telefone', 'phone', 'tel', 'celular', 'whatsapp', 'mobile', 'phone 1 - value']);

  return lines.slice(1)
    .map((line) => {
      const columns = splitCSVLine(line, delimiter);
      return normalizeContact({
        name: [columns[nameIndex] || columns[0]],
        tel: [columns[phoneIndex] || columns[1]]
      });
    })
    .filter((contact) => contact.name && contact.phone);
}

function detectCSVDelimiter(headerLine) {
  const candidates = [',', ';', '	'];
  return candidates
    .map((delimiter) => ({ delimiter, count: splitCSVLine(headerLine, delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function splitCSVLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }

  result.push(current.trim());
  return result;
}

function findHeader(headers, names) {
  const index = headers.findIndex((header) => names.includes(header));
  return index >= 0 ? index : -1;
}

export function normalizeContact(contact) {
  const rawName = Array.isArray(contact.name) ? contact.name[0] : contact.name;
  const rawPhone = Array.isArray(contact.tel) ? contact.tel[0] : contact.tel;
  const phone = String(rawPhone || '').replace(/[^\d+]/g, '');

  return {
    name: String(rawName || '').trim(),
    phone
  };
}
