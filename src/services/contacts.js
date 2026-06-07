export function isContactPickerSupported() {
  return 'contacts' in navigator && 'ContactsManager' in window;
}

export async function pickContactsFromDevice() {
  if (!isContactPickerSupported()) {
    throw new Error('Contact Picker API nao suportada neste navegador.');
  }

  const availableProperties = await navigator.contacts.getProperties();
  const properties = ['name', 'tel'].filter((property) => availableProperties.includes(property));

  if (!properties.includes('tel')) {
    throw new Error('Este navegador nao liberou telefones dos contatos.');
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
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headers = splitCSVLine(lines[0]).map((header) => header.trim().toLowerCase());
  const nameIndex = findHeader(headers, ['nome', 'name', 'contato', 'contact']);
  const phoneIndex = findHeader(headers, ['telefone', 'phone', 'tel', 'celular', 'whatsapp']);

  return lines.slice(1)
    .map((line) => {
      const columns = splitCSVLine(line);
      return normalizeContact({
        name: [columns[nameIndex] || columns[0]],
        tel: [columns[phoneIndex] || columns[1]]
      });
    })
    .filter((contact) => contact.name && contact.phone);
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
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
