import Dexie from 'dexie';

export const db = new Dexie('MaintenanceDB');
let _syncWriteFlag = false;

export function setSyncWriteFlag(value) {
  _syncWriteFlag = Boolean(value);
}

export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Schemas with versioning for future migrations
db.version(1).stores({
  bairros: '++id, nome, cor',
  clientes: '++id, bairroId, nome, endereco, tipo, telefone, whatsapp',
  equipamentos: '++id, clienteId, marca, modelo, btu, localizacao, ultimaManutencao, proximaManutencao',
  manutencoes: '++id, equipamentoId, dataRealizada, descricao, proximaData'
});

db.version(2).stores({
  unidades: '++id, clienteId, apartamento, proprietario, telefone',
  equipamentos: '++id, clienteId, unidadeId, marca, modelo, btu, localizacao, ultimaManutencao, proximaManutencao'
});

db.version(3).stores({
  manutencoes: '++id, equipamentoId, dataRealizada, descricao, proximaData, valor, formaPagamento'
});

db.version(4).stores({
  materiais: '++id, nome, categoria, estoque, precoUnitario',
  materiaisUsados: '++id, manutencaoId, materialId, quantidade',
  orcamentos: '++id, clienteId, equipamentoId, dataOrcamento, descricao, valor, status',
  comunicacao: '++id, clienteId, tipo, conteudo, dataCriacao, enviado',
  analytics: '++id, mes, ano, totalFaturado, totalRecebido, totalPendente'
});

export async function seedDatabase() {
  const bairroCount = await db.bairros.count();
  if (bairroCount === 0) {
    const bairros = [
      "Aeroclube", "Água Fria", "Altiplano", "Alto do Mateus", "Bairro dos Estados", 
      "Bairro dos Ipês", "Bancários", "Bessa", "Brisamar", "Cabo Branco", 
      "Castelo Branco", "Centro", "Cristo Redentor", "Cruz das Armas", "Cuiá", 
      "Ernesto Geisel", "Expedicionários", "Funcionários", "Gramame", "Grotão", 
      "Ilha do Bispo", "Indústrias", "Jaguaribe", "Jardim Oceania", "José Américo", 
      "Manaíra", "Mandacaru", "Miramar", "Oitizeiro", "Padre Zé", "Rangel", 
      "Roger", "Tambaú", "Tambauzinho", "Tambiá", "Torre", "Varadouro", 
      "Valentina de Figueiredo", "Portal do Sol", "Jardim Luna", "João Agripino"
    ].map(nome => ({
      nome,
      cor: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
    }));
    
    for (const b of bairros) {
      const bId = await db.bairros.add(b);
      await db.clientes.add({
        bairroId: bId,
        nome: `Edifício ${b.nome} Prime`,
        endereco: `Av. Principal, 100 - ${b.nome}`,
        tipo: 'Edifício',
        telefone: '83 99999-0000',
        whatsapp: '83 99999-0000'
      });
    }
  }
}

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
  const materiaisUsados = await db.materiaisUsados?.where('manutencaoId').equals(manutencaoId).toArray() || [];
  return { manutencao, ...details, materiaisUsados };
}

export async function getEquipmentsByClient(clienteId) {
  return await db.equipamentos.where('clienteId').equals(clienteId).toArray();
}

export async function getMaintenanceByPeriod(startDate, endDate) {
  const all = await db.manutencoes.toArray();
  return all.filter(m => {
    const date = new Date(m.dataRealizada);
    return date >= startDate && date <= endDate;
  });
}

export async function calculateMonthlyRevenue(month, year) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  const manutencoes = await getMaintenanceByPeriod(startDate, endDate);
  return {
    totalBruto: manutencoes.reduce((sum, m) => sum + (Number(m.valor) || 0), 0),
    recebido: manutencoes.filter(m => m.formaPagamento !== 'Prazo (30 dias)').reduce((sum, m) => sum + (Number(m.valor) || 0), 0),
    pendente: manutencoes.filter(m => m.formaPagamento === 'Prazo (30 dias)').reduce((sum, m) => sum + (Number(m.valor) || 0), 0),
    count: manutencoes.length
  };
}

export async function getOverdueEquipments() {
  const eqs = await db.equipamentos.toArray();
  const today = new Date();
  return eqs.filter(e => e.proximaManutencao && new Date(e.proximaManutencao) <= today);
}

export async function getUpcomingEquipments(daysAhead = 7) {
  const eqs = await db.equipamentos.toArray();
  const today = new Date();
  const deadline = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return eqs.filter(e => {
    if (!e.proximaManutencao) return false;
    const date = new Date(e.proximaManutencao);
    return date > today && date <= deadline;
  });
}

export async function exportDatabase() {
  const backup = {
    version: 4,
    timestamp: new Date().toISOString(),
    data: {
      bairros: await db.bairros.toArray(),
      clientes: await db.clientes.toArray(),
      equipamentos: await db.equipamentos.toArray(),
      unidades: await db.unidades?.toArray() || [],
      manutencoes: await db.manutencoes.toArray(),
      materiais: await db.materiais?.toArray() || [],
      materiaisUsados: await db.materiaisUsados?.toArray() || [],
      orcamentos: await db.orcamentos?.toArray() || [],
      comunicacao: await db.comunicacao?.toArray() || []
    }
  };
  return JSON.stringify(backup, null, 2);
}

export async function importDatabase(jsonData) {
  try {
    const backup = JSON.parse(jsonData);
    await db.bairros.clear();
    await db.clientes.clear();
    await db.equipamentos.clear();
    await db.unidades?.clear();
    await db.manutencoes.clear();
    for (const table of Object.keys(backup.data)) {
      if (db[table] && backup.data[table].length > 0) {
        await db[table].bulkAdd(backup.data[table]);
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
