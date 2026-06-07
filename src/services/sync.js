import { db, setSyncWriteFlag } from './db.js';

// Definir quando o backend estiver pronto
const BACKEND_URL = null; // ex: 'https://api.arconect.com.br'

const SYNC_INTERVAL_MS = 30_000;
const LAST_SYNC_KEY   = 'jampa_last_sync_at';
const TOKEN_KEY       = 'jampa_auth_token';
const DELETED_LOG_KEY = 'jampa_deleted_log';

// ---------------------------------------------------------------------------
// Log de deleções (registros removidos localmente ainda não enviados ao servidor)
// ---------------------------------------------------------------------------

export function logDelete(table, id) {
  if (!BACKEND_URL) return;
  try {
    const log = JSON.parse(localStorage.getItem(DELETED_LOG_KEY) || '[]');
    log.push({ table, id, deletedAt: new Date().toISOString() });
    localStorage.setItem(DELETED_LOG_KEY, JSON.stringify(log));
  } catch {}
}

function getDeletedLog() {
  try { return JSON.parse(localStorage.getItem(DELETED_LOG_KEY) || '[]'); } catch { return []; }
}

function clearDeletedLog() {
  localStorage.removeItem(DELETED_LOG_KEY);
}

// ---------------------------------------------------------------------------
// Leitura de registros dirty
// ---------------------------------------------------------------------------

async function getDirtyRecords() {
  const result = [];
  for (const table of db.tables) {
    try {
      const rows = await db[table.name].toArray();
      rows.filter((r) => r._dirty).forEach((r) => result.push({ table: table.name, data: r }));
    } catch {}
  }
  return result;
}

// ---------------------------------------------------------------------------
// Marcar como sincronizado (sem re-disparar hooks)
// ---------------------------------------------------------------------------

async function markSynced(byTable) {
  const syncedAt = new Date().toISOString();
  setSyncWriteFlag(true);
  try {
    await db.transaction('rw', db.tables, async () => {
      for (const [tableName, ids] of Object.entries(byTable)) {
        await db[tableName].where('id').anyOf(ids).modify({ _dirty: false, syncedAt });
      }
    });
  } finally {
    setSyncWriteFlag(false);
  }
}

// ---------------------------------------------------------------------------
// Push: envia dirty + deleções ao servidor
// ---------------------------------------------------------------------------

async function push(token) {
  const dirty   = await getDirtyRecords();
  const deleted = getDeletedLog();
  if (!dirty.length && !deleted.length) return 0;

  const res = await fetch(`${BACKEND_URL}/api/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ upserts: dirty, deletes: deleted }),
  });

  if (!res.ok) throw new Error(`push ${res.status}`);

  // Agrupar por tabela para o bulkUpdate
  const byTable = {};
  dirty.forEach(({ table, data }) => {
    (byTable[table] ??= []).push(data.id);
  });
  await markSynced(byTable);
  clearDeletedLog();

  return dirty.length + deleted.length;
}

// ---------------------------------------------------------------------------
// Pull: recebe alterações do servidor desde o último sync
// ---------------------------------------------------------------------------

async function pull(token) {
  const since = localStorage.getItem(LAST_SYNC_KEY);
  const qs    = since ? `?since=${encodeURIComponent(since)}` : '';

  const res = await fetch(`${BACKEND_URL}/api/sync/pull${qs}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`pull ${res.status}`);

  const { records = [], serverTime } = await res.json();

  setSyncWriteFlag(true);
  try {
    for (const { table, operation, data } of records) {
      if (!db[table]) continue;

      if (operation === 'delete') {
        await db[table].delete(data.id);
        continue;
      }

      // Upsert: só aplica se o servidor for mais recente que o local
      const local       = await db[table].get(data.id);
      const serverNewer = !local || new Date(data.updatedAt) >= new Date(local.updatedAt);
      if (serverNewer) {
        await db[table].put({ ...data, _dirty: false });
      }
    }
  } finally {
    setSyncWriteFlag(false);
  }

  if (serverTime) localStorage.setItem(LAST_SYNC_KEY, serverTime);
  return records.length;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

let _syncing = false;

export const syncService = {
  isOnline() {
    return navigator.onLine;
  },

  /** Retorna quantos registros ainda não foram sincronizados */
  async pendingCount() {
    let count = 0;
    for (const table of db.tables) {
      try {
        const rows = await db[table.name].toArray();
        count += rows.filter((r) => r._dirty).length;
      } catch {}
    }
    count += getDeletedLog().length;
    return count;
  },

  /** Executa um ciclo completo de sync (push → pull) */
  async sync() {
    if (_syncing || !this.isOnline() || !BACKEND_URL) return null;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    _syncing = true;
    try {
      const pushed = await push(token);
      const pulled = await pull(token);
      console.info(`[ArConect sync] ↑${pushed} ↓${pulled}`);
      return { pushed, pulled };
    } catch (err) {
      console.warn('[ArConect sync]', err.message);
      return null;
    } finally {
      _syncing = false;
    }
  },

  /** Inicia o listener de conexão e o intervalo periódico */
  start() {
    const run = () => this.sync();
    window.addEventListener('online', run);
    setInterval(run, SYNC_INTERVAL_MS);
    if (this.isOnline()) run();
  },

  // Mantido por compatibilidade com chamadas antigas
  watchConnection() {
    this.start();
  },
};
