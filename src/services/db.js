import { supabase } from '../lib/supabase.js';

// ──────────────────────────────────────────────
// Conversão camelCase ↔ snake_case
// ──────────────────────────────────────────────

function toSnake(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function toCamel(str) {
  return str.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
}

function rowToCamel(row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'owner_id') continue;
    out[toCamel(k)] = v;
  }
  return out;
}

function rowToSnake(obj) {
  if (!obj) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[toSnake(k)] = v;
  }
  return out;
}

// ──────────────────────────────────────────────
// Owner ID — fallback sempre confiável
// ──────────────────────────────────────────────

let _ownerId = null;

supabase.auth.onAuthStateChange((_event, session) => {
  _ownerId = session?.user?.id ?? null;
});

export function setOwnerId(id) {
  _ownerId = id ?? null;
}

async function getOwnerId() {
  if (_ownerId) return _ownerId;
  const { data: { session } } = await supabase.auth.getSession();
  _ownerId = session?.user?.id ?? null;
  return _ownerId;
}

// ──────────────────────────────────────────────
// Factory de tabela — API compatível com Dexie
// ──────────────────────────────────────────────

function makeTable(tableName) {
  const q = () => supabase.from(tableName);

  return {
    async toArray() {
      const uid = await getOwnerId();
      const { data, error } = await q().select('*').eq('owner_id', uid);
      if (error) throw error;
      return data.map(rowToCamel);
    },

    async get(id) {
      const uid = await getOwnerId();
      const { data, error } = await q().select('*').eq('owner_id', uid).eq('id', id).maybeSingle();
      if (error) throw error;
      return rowToCamel(data);
    },

    async add(item) {
      const uid = await getOwnerId();
      const { id: _strip, ...rest } = item;
      const payload = { ...rowToSnake(rest), owner_id: uid };
      const { data, error } = await q().insert(payload).select('id').single();
      if (error) throw error;
      return data.id;
    },

    async update(id, changes) {
      const uid = await getOwnerId();
      const { id: _sid, owner_id: _own, ...rest } = changes;
      const { error } = await q().update(rowToSnake(rest)).eq('owner_id', uid).eq('id', id);
      if (error) throw error;
    },

    async delete(id) {
      const uid = await getOwnerId();
      const { error } = await q().delete().eq('owner_id', uid).eq('id', id);
      if (error) throw error;
    },

    async count() {
      const uid = await getOwnerId();
      const { count, error } = await q().select('*', { count: 'exact', head: true }).eq('owner_id', uid);
      if (error) throw error;
      return count ?? 0;
    },

    async bulkAdd(items) {
      if (!items?.length) return;
      const uid = await getOwnerId();
      const payload = items.map(({ id: _strip, ...rest }) => ({
        ...rowToSnake(rest),
        owner_id: uid
      }));
      const { error } = await q().insert(payload);
      if (error) throw error;
    },

    async clear() {
      const uid = await getOwnerId();
      const { error } = await q().delete().eq('owner_id', uid);
      if (error) throw error;
    },

    async put(item) {
      const uid = await getOwnerId();
      const payload = { ...rowToSnake(item), owner_id: uid };
      const { error } = await q().upsert(payload);
      if (error) throw error;
    },

    filter(fn) {
      return {
        async first() {
          const uid = await getOwnerId();
          const { data, error } = await q().select('*').eq('owner_id', uid);
          if (error) throw error;
          return data.map(rowToCamel).find(fn) ?? null;
        },
        async toArray() {
          const uid = await getOwnerId();
          const { data, error } = await q().select('*').eq('owner_id', uid);
          if (error) throw error;
          return data.map(rowToCamel).filter(fn);
        }
      };
    },

    where(field) {
      const col = toSnake(field);
      return {
        equals(value) {
          return {
            async toArray() {
              const uid = await getOwnerId();
              const { data, error } = await q().select('*').eq('owner_id', uid).eq(col, value);
              if (error) throw error;
              return data.map(rowToCamel);
            },
            async delete() {
              const uid = await getOwnerId();
              const { error } = await q().delete().eq('owner_id', uid).eq(col, value);
              if (error) throw error;
            },
            async first() {
              const uid = await getOwnerId();
              const { data, error } = await q().select('*').eq('owner_id', uid).eq(col, value).limit(1).maybeSingle();
              if (error) throw error;
              return rowToCamel(data);
            }
          };
        },
        above(value) {
          return {
            async toArray() {
              const uid = await getOwnerId();
              const { data, error } = await q().select('*').eq('owner_id', uid).gt(col, value);
              if (error) throw error;
              return data.map(rowToCamel);
            }
          };
        },
        anyOf(values) {
          return {
            async toArray() {
              const uid = await getOwnerId();
              const { data, error } = await q().select('*').eq('owner_id', uid).in(col, values);
              if (error) throw error;
              return data.map(rowToCamel);
            },
            async modify(changes) {
              const uid = await getOwnerId();
              const { id: _s, owner_id: _o, ...rest } = changes;
              const { error } = await q().update(rowToSnake(rest)).eq('owner_id', uid).in(col, values);
              if (error) throw error;
            }
          };
        }
      };
    }
  };
}

// ──────────────────────────────────────────────
// Instâncias de tabela
// ──────────────────────────────────────────────

export const db = {
  clientes:        makeTable('clientes'),
  unidades:        makeTable('unidades'),
  equipamentos:    makeTable('equipamentos'),
  manutencoes:     makeTable('manutencoes'),
  materiais:       makeTable('materiais'),
  materiaisUsados: makeTable('materiais_usados'),
  orcamentos:      makeTable('orcamentos'),
  comunicacao:     makeTable('comunicacao'),
  analytics:       makeTable('analytics'),
};

// ──────────────────────────────────────────────
// Utilitários
// ──────────────────────────────────────────────

export function generateId() {
  return crypto.randomUUID();
}

export async function seedDatabase() {}
export function setSyncWriteFlag() {}

// ──────────────────────────────────────────────
// Queries compostas
// ──────────────────────────────────────────────

export async function getEquipmentWithDetails(equipamentoId) {
  const equipamento = await db.equipamentos.get(equipamentoId);
  if (!equipamento) return null;
  const cliente = await db.clientes.get(equipamento.clienteId);
  const unidade = equipamento.unidadeId ? await db.unidades.get(equipamento.unidadeId) : null;
  return { equipamento, cliente, unidade };
}

export async function getMaintenanceWithDetails(manutencaoId) {
  const manutencao = await db.manutencoes.get(manutencaoId);
  if (!manutencao) return null;
  const details = await getEquipmentWithDetails(manutencao.equipamentoId);
  return { manutencao, ...details };
}

export async function getEquipmentsByClient(clienteId) {
  return db.equipamentos.where('clienteId').equals(clienteId).toArray();
}

export async function getMaintenanceByPeriod(startDate, endDate) {
  const uid = await getOwnerId();
  const { data, error } = await supabase
    .from('manutencoes')
    .select('*')
    .eq('owner_id', uid)
    .gte('data_realizada', startDate.toISOString())
    .lte('data_realizada', endDate.toISOString());
  if (error) throw error;
  return data.map(rowToCamel);
}

export async function calculateMonthlyRevenue(month, year) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);
  const manutencoes = await getMaintenanceByPeriod(startDate, endDate);
  return {
    totalBruto: manutencoes.reduce((sum, m) => sum + (Number(m.valor) || 0), 0),
    recebido:   manutencoes.filter(m => m.formaPagamento !== 'Prazo (30 dias)').reduce((sum, m) => sum + (Number(m.valor) || 0), 0),
    pendente:   manutencoes.filter(m => m.formaPagamento === 'Prazo (30 dias)').reduce((sum, m) => sum + (Number(m.valor) || 0), 0),
    count: manutencoes.length
  };
}

export async function getOverdueEquipments() {
  const uid = await getOwnerId();
  const { data, error } = await supabase
    .from('equipamentos')
    .select('*')
    .eq('owner_id', uid)
    .not('proxima_manutencao', 'is', null)
    .lte('proxima_manutencao', new Date().toISOString());
  if (error) throw error;
  return data.map(rowToCamel);
}

export async function getUpcomingEquipments(daysAhead = 7) {
  const uid = await getOwnerId();
  const today = new Date();
  const deadline = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from('equipamentos')
    .select('*')
    .eq('owner_id', uid)
    .not('proxima_manutencao', 'is', null)
    .gt('proxima_manutencao', today.toISOString())
    .lte('proxima_manutencao', deadline.toISOString());
  if (error) throw error;
  return data.map(rowToCamel);
}

export async function exportDatabase() {
  const [clientes, equipamentos, unidades, manutencoes] = await Promise.all([
    db.clientes.toArray(),
    db.equipamentos.toArray(),
    db.unidades.toArray(),
    db.manutencoes.toArray(),
  ]);
  return JSON.stringify({
    version: 6,
    timestamp: new Date().toISOString(),
    data: { clientes, equipamentos, unidades, manutencoes, materiais: [], materiaisUsados: [], orcamentos: [], comunicacao: [] }
  }, null, 2);
}

export async function importDatabase(jsonData) {
  try {
    const backup = JSON.parse(jsonData);
    const { data } = backup;
    await db.manutencoes.clear();
    await db.equipamentos.clear();
    await db.unidades.clear();
    await db.clientes.clear();
    if (data.clientes?.length)     await db.clientes.bulkAdd(data.clientes);
    if (data.unidades?.length)     await db.unidades.bulkAdd(data.unidades);
    if (data.equipamentos?.length) await db.equipamentos.bulkAdd(data.equipamentos);
    if (data.manutencoes?.length)  await db.manutencoes.bulkAdd(data.manutencoes);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
