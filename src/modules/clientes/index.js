/**
 * Modulo CLIENTES - gestao flexivel de clientes, locais e equipamentos
 */

import { db } from '../../services/db.js';
import { openModal, modalBody, CONSTANTS } from '../../services/ui.js';
import { authService } from '../../services/auth.js';
import { isContactPickerSupported, normalizeContact, parseContactsFile, pickContactsFromDevice } from '../../services/contacts.js';

let currentClientFilter = 'todos';

const CLIENT_TYPES = ['Pessoa Fisica', 'Condominio', 'Empresa', 'Comercial', 'Industrial'];
const SERVICE_TYPES = ['Limpeza', 'Carga de Gas', 'Manutencao Preventiva', 'Manutencao Corretiva', 'Instalacao', 'Desinstalacao', 'Outro'];

function toDateTimeInputValue(value = new Date()) {
  const date = new Date(value);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function toDateInputValue(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function formatDateOnly(value) {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return date.toLocaleDateString('pt-BR');
}

function formatDateTime(value) {
  if (!value) return '---';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function buildAddress(cliente) {
  if (!cliente) return '';

  const streetNumber = [cliente.logradouro, cliente.numero].filter(Boolean).join(', ');
  const cityState = [cliente.cidade, cliente.estado].filter(Boolean).join(' - ');
  const parts = [
    streetNumber,
    cliente.complemento,
    cliente.bairroEndereco,
    cityState,
    cliente.cep
  ].filter(Boolean);

  return parts.join(', ') || cliente.endereco || '';
}

function getClientGroup(cliente, bairro) {
  return cliente.grupo || cliente.rota || cliente.tag || cliente.bairroNome || bairro?.nome || 'Sem grupo';
}

function getDueStatus(equipamentos) {
  const dates = equipamentos
    .filter((equipamento) => equipamento.proximaManutencao)
    .map((equipamento) => new Date(equipamento.proximaManutencao));

  if (dates.length === 0) return { label: 'Sem agenda', color: 'rgba(255,255,255,0.45)', status: 'sem-agenda' };

  const nextDate = dates.sort((a, b) => a - b)[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  nextDate.setHours(0, 0, 0, 0);
  const diff = Math.ceil((nextDate - today) / 86400000);

  if (diff <= 0) return { label: 'Vencido', color: '#ff4d4d', status: 'vencido' };
  if (diff <= 15) return { label: `Em ${diff}d`, color: '#ff9d00', status: 'proximo' };
  return { label: `Em ${diff}d`, color: '#22c55e', status: 'ok' };
}

function clientMatchesFilter(cliente, dueStatus) {
  const type = normalizeText(cliente.tipo);
  if (currentClientFilter === 'todos') return true;
  if (currentClientFilter === 'proximos') return dueStatus.status === 'proximo';
  if (currentClientFilter === 'vencidos') return dueStatus.status === 'vencido';
  if (currentClientFilter === 'pessoa') return type.includes('pessoa') || type.includes('resid');
  if (currentClientFilter === 'condominio') return type.includes('condom') || type.includes('edif');
  if (currentClientFilter === 'empresa') return type.includes('empresa') || type.includes('comercial') || type.includes('industrial');
  return true;
}

async function getClientMaintenances(clienteId, equipamentos) {
  const equipmentIds = equipamentos.map((equipamento) => equipamento.id);
  const manutencoes = await db.manutencoes.toArray();

  return manutencoes
    .filter((manutencao) => manutencao.clientId === clienteId || equipmentIds.includes(manutencao.equipamentoId))
    .sort((a, b) => new Date(b.dataRealizada || b.dataAgendada || 0) - new Date(a.dataRealizada || a.dataAgendada || 0));
}

export function setClientFilter(filter) {
  currentClientFilter = filter;
  const mainContent = document.getElementById('main-content');
  const headerContent = document.getElementById('header-content');
  renderBairros(mainContent, headerContent);
}

/**
 * Renderizar pagina principal de clientes.
 * Mantem o nome renderBairros para compatibilidade com a navegacao atual.
 */
export async function renderBairros(mainContent, headerContent, searchTerm = '') {
  window.setClientFilter = setClientFilter;

  headerContent.innerHTML = '<h2 style="font-size: 20px; font-weight: 800; margin:0;">CLIENTES</h2>';

  let html = `
    <div class="page-header animate-in" style="padding: 0 20px;">
      <div class="search-box">
        <span class="material-symbols-rounded">search</span>
        <input type="text" id="b-search" placeholder="Buscar cliente, WhatsApp, tag..." value="${searchTerm}">
      </div>

      <div style="display:flex; gap:8px; overflow-x:auto; padding:14px 0; scrollbar-width:none;">
        ${[
          ['todos', 'TODOS'],
          ['pessoa', 'PESSOA'],
          ['condominio', 'CONDOMINIO'],
          ['empresa', 'EMPRESA'],
          ['proximos', 'PROXIMOS'],
          ['vencidos', 'VENCIDOS']
        ].map(([value, label]) => `
          <button class="pill ${currentClientFilter === value ? 'active' : ''}" onclick="window.setClientFilter('${value}')">${label}</button>
        `).join('')}
      </div>

      <div style="display: flex; gap: 10px; margin-bottom: 12px;">
        <button class="btn-primary" onclick="window.renderFullPropertyForm()" style="flex:1; font-size:10px;">+ NOVO CLIENTE</button>
        <button class="btn-primary" onclick="window.renderContactsImportForm()" style="flex:1; background:#0ea5e9; font-size:10px;">
          IMPORTAR AGENDA
        </button>
      </div>
    </div>
  `;

  const clientes = await db.clientes.toArray();
  const bairros = await db.bairros.toArray();

  html += '<div class="animate-in" style="display:flex; flex-direction:column; gap:12px; padding:0 20px;">';

  let visibleCount = 0;
  for (const cliente of clientes.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')))) {
    const equipamentos = await db.equipamentos.where('clienteId').equals(cliente.id).toArray();
    const bairro = cliente.bairroId ? bairros.find((item) => item.id === cliente.bairroId) : null;
    const group = getClientGroup(cliente, bairro);
    const dueStatus = getDueStatus(equipamentos);
    const searchable = [
      cliente.nome,
      cliente.whatsapp,
      cliente.tipo,
      buildAddress(cliente),
      group
    ].map(normalizeText).join(' ');

    if (searchTerm && !searchable.includes(normalizeText(searchTerm))) continue;
    if (!clientMatchesFilter(cliente, dueStatus)) continue;

    visibleCount += 1;
    const phone = cliente.whatsapp || '';
    const phoneDigits = String(phone).replace(/\D/g, '');
    const whatsapp = phoneDigits ? `
      <a href="https://wa.me/${phoneDigits}" target="_blank" class="icon-btn success" style="width:34px; height:34px;">
        <span class="material-symbols-rounded" style="font-size:16px;">chat</span>
      </a>
    ` : '';

    html += `
      <div class="card" style="margin:0; padding:15px;">
        <div style="display:flex; align-items:flex-start; gap:12px;">
          <div onclick="window.renderClientDetail(${cliente.id})" style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <h3 style="margin:0; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${cliente.nome || 'Sem nome'}</h3>
              <span style="font-size:8px; font-weight:900; padding:3px 7px; border-radius:20px; background:rgba(255,255,255,0.06); color:${dueStatus.color}; border:1px solid ${dueStatus.color};">${dueStatus.label}</span>
            </div>
            <p style="margin:0; font-size:10px; opacity:0.65; font-weight:700;">${cliente.tipo || 'Cliente'} • ${group}</p>
            <p style="margin:5px 0 0 0; font-size:10px; opacity:0.55; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${buildAddress(cliente) || 'Endereco nao informado'}</p>
            <p style="margin:8px 0 0 0; font-size:9px; color:var(--primary); font-weight:800;">${equipamentos.length} EQUIPAMENTO(S)</p>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            ${whatsapp}
            <button class="icon-btn" style="width:34px; height:34px; border:none;" onclick="window.deleteItem('cliente', ${cliente.id})">
              <span class="material-symbols-rounded" style="font-size:16px; color:#ff4d4d;">delete</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  if (visibleCount === 0) {
    html += `
      <div style="text-align:center; padding:40px 10px; opacity:0.45;">
        <span class="material-symbols-rounded" style="font-size:42px; display:block; margin-bottom:10px;">person_search</span>
        Nenhum cliente encontrado.
      </div>
    `;
  }

  mainContent.innerHTML = html + '</div>';

  const bSearch = document.getElementById('b-search');
  if (bSearch) bSearch.oninput = (event) => renderBairros(mainContent, headerContent, event.target.value);
}

/**
 * Compatibilidade: lista clientes de um bairro antigo em modal.
 */
export async function renderBairroDetail(bairroId) {
  const bairro = await db.bairros.get(bairroId);
  const clientes = await db.clientes.where('bairroId').equals(bairroId).toArray();

  openModal(`${bairro?.nome || 'Grupo'} - ${clientes.length} Clientes`);

  modalBody.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${clientes.map((cliente) => `
        <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; cursor:pointer;" onclick="window.renderClientDetail(${cliente.id})">
          <h4 style="margin:0; font-size:13px; font-weight:700;">${cliente.nome}</h4>
          <p style="margin:4px 0 0 0; font-size:10px; opacity:0.6;">${buildAddress(cliente)}</p>
        </div>
      `).join('') || '<p style="font-size:10px; opacity:0.5;">Nenhum cliente neste grupo.</p>'}
    </div>
  `;
}

export async function renderClientDetail(clienteId) {
  const cliente = await db.clientes.get(clienteId);
  if (!cliente) return;

  const equipamentos = await db.equipamentos.where('clienteId').equals(clienteId).toArray();
  const historico = await getClientMaintenances(clienteId, equipamentos);
  const bairro = cliente.bairroId ? await db.bairros.get(cliente.bairroId) : null;
  const group = getClientGroup(cliente, bairro);
  const phone = cliente.whatsapp || '';

  openModal(cliente.nome);

  modalBody.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div style="background:rgba(255,255,255,0.04); padding:12px; border-radius:8px;">
        <label style="font-size:9px; opacity:0.6; font-weight:700;">TIPO / GRUPO</label>
        <p style="margin:5px 0 0 0; font-size:12px;">${cliente.tipo || '-'} • ${group}</p>
      </div>
      <div style="background:rgba(255,255,255,0.04); padding:12px; border-radius:8px;">
        <label style="font-size:9px; opacity:0.6; font-weight:700;">ENDERECO</label>
        <p style="margin:5px 0 0 0; font-size:12px;">${buildAddress(cliente) || 'Nao informado'}</p>
      </div>
      <div style="background:rgba(255,255,255,0.04); padding:12px; border-radius:8px;">
        <label style="font-size:9px; opacity:0.6; font-weight:700;">CONTATO</label>
        <p style="margin:5px 0 0 0; font-size:12px;">
          ${phone ? `<a href="https://wa.me/${String(phone).replace(/\D/g, '')}" target="_blank" style="color:#25D366; text-decoration:none;">${phone}</a>` : 'Nao informado'}
        </p>
      </div>

      <div style="display:flex; gap:10px;">
        <button class="btn-primary" onclick="window.renderFullPropertyForm(${cliente.id})" style="margin-top:4px; background:#0ea5e9;">
          <span class="material-symbols-rounded" style="font-size:16px;">edit</span>
          EDITAR
        </button>
        <button class="btn-primary" onclick="window.renderClientServiceForm(${cliente.id})" style="margin-top:4px;">
          <span class="material-symbols-rounded" style="font-size:16px;">add_task</span>
          SERVICO
        </button>
      </div>

      <div style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <label style="font-size:11px; font-weight:800; color:var(--primary);">EQUIPAMENTOS</label>
          <button class="icon-btn" onclick="window.renderEquipmentForm(${cliente.id})" style="width:32px; height:32px; border:none;">
            <span class="material-symbols-rounded" style="font-size:16px; color:var(--primary);">add</span>
          </button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
          ${equipamentos.length > 0 ? equipamentos.map((equipamento) => `
            <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
              <div style="min-width:0;">
                <p style="margin:0; font-size:11px; font-weight:700;">${equipamento.marca} - ${equipamento.btu} BTU</p>
                <p style="margin:3px 0 0 0; font-size:9px; opacity:0.6;">${equipamento.localizacao || 'Local nao informado'}</p>
              </div>
              <button class="icon-btn" onclick="window.renderEquipmentForm(${cliente.id}, ${equipamento.id})" style="width:30px; height:30px; border:none; flex-shrink:0;">
                <span class="material-symbols-rounded" style="font-size:15px;">edit</span>
              </button>
            </div>
          `).join('') : '<p style="font-size:10px; opacity:0.5;">Nenhum equipamento cadastrado</p>'}
        </div>
      </div>

      <div style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
        <label style="font-size:11px; font-weight:800; color:var(--primary);">HISTORICO DO CLIENTE</label>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
          ${historico.length > 0 ? historico.map((servico) => {
            const equipamento = equipamentos.find((item) => item.id === servico.equipamentoId);
            return `
              <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border-left:3px solid #22c55e;">
                <div style="display:flex; justify-content:space-between; gap:8px;">
                  <p style="margin:0; font-size:11px; font-weight:800;">${servico.tipoServico || 'Servico'} ${servico.status === 'agendado' ? '(Agendado)' : ''}</p>
                  <p style="margin:0; font-size:9px; opacity:0.55;">${formatDateTime(servico.dataRealizada || servico.dataAgendada)}</p>
                </div>
                <p style="margin:5px 0 0 0; font-size:10px; opacity:0.75;">${servico.descricao || '-'}</p>
                <p style="margin:5px 0 0 0; font-size:9px; opacity:0.55;">${equipamento ? `${equipamento.marca} • ${equipamento.localizacao || 'Local nao informado'}` : 'Servico do cliente'}</p>
                ${servico.valor ? `<p style="margin:5px 0 0 0; font-size:10px; color:#22c55e; font-weight:800;">R$ ${Number(servico.valor).toFixed(2)}</p>` : ''}
                ${servico.status === 'agendado' ? `
                  <button class="btn-primary" onclick="window.renderCloseScheduledServiceForm(${servico.id})" style="font-size:9px; padding:9px; margin-top:8px; background:#22c55e;">FECHAR SERVICO</button>
                ` : ''}
              </div>
            `;
          }).join('') : '<p style="font-size:10px; opacity:0.5;">Nenhum servico registrado ainda</p>'}
        </div>
      </div>
    </div>
  `;
}

export async function renderClientServiceForm(clienteId, initialStatus = 'agendado', initialEquipmentId = null, initialDate = null, requireTimeOnly = false) {
  const cliente = await db.clientes.get(clienteId);
  const equipamentos = await db.equipamentos.where('clienteId').equals(clienteId).toArray();
  const isAdminEmpresa = authService.isAdmin() && authService.getBusinessMode() === 'empresa';
  const tecnicos = isAdminEmpresa ? authService.getUsers().filter((u) => u.role === 'tecnico') : [];

  openModal(`Servico - ${cliente?.nome || 'Cliente'}`);

  modalBody.innerHTML = `
    <form id="f-client-service">
      <div class="form-group">
        <label>Lancamento</label>
        <select id="s-status" class="form-control">
          <option value="agendado" ${initialStatus === 'agendado' ? 'selected' : ''}>Agendar novo servico</option>
          <option value="concluido" ${initialStatus === 'concluido' ? 'selected' : ''}>Fechar servico realizado agora</option>
        </select>
      </div>
      <div class="form-group">
        <label>Tipo de Servico</label>
        <select id="s-tipo" class="form-control">
          ${SERVICE_TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Equipamento</label>
        <select id="s-equipamento" class="form-control">
          <option value="">Servico geral do cliente</option>
          ${equipamentos.length > 0 ? equipamentos.map((equipamento) => `
            <option value="${equipamento.id}" ${Number(initialEquipmentId) === equipamento.id ? 'selected' : ''}>${equipamento.marca} - ${equipamento.btu} BTU - ${equipamento.localizacao || 'Local nao informado'}</option>
          `).join('') : ''}
        </select>
      </div>
      ${equipamentos.length === 0 ? `
        <button type="button" class="btn-primary" onclick="window.renderEquipmentForm(${clienteId})" style="background:#0ea5e9; margin-top:0;">
          ADICIONAR EQUIPAMENTO
        </button>
      ` : ''}
      <div class="form-group">
        <label>Descricao</label>
        <textarea id="s-desc" class="form-control" rows="3" placeholder="Ex: Limpeza completa da evaporadora, carga de gas, troca de capacitor..."></textarea>
      </div>
      <div style="display:flex; gap:10px;">
        <div class="form-group" style="flex:1;">
          <label>Valor (R$)</label>
          <input type="number" step="0.01" id="s-valor" class="form-control" placeholder="150.00">
        </div>
        <div class="form-group" style="flex:1;">
          <label>Pagamento</label>
          <select id="s-pagamento" class="form-control">
            ${CONSTANTS.PAYMENT_METHODS.map((method) => `<option value="${method}">${method}</option>`).join('')}
          </select>
        </div>
      </div>
      ${requireTimeOnly ? `
        <div style="display:flex; gap:10px;">
          <div class="form-group" style="flex:1;">
            <label>Data do agendamento</label>
            <input type="date" id="s-agendada-data" class="form-control" required>
          </div>
          <div class="form-group" style="width:120px;">
            <label>Horario</label>
            <input type="time" id="s-agendada-hora" class="form-control" required>
          </div>
        </div>
      ` : `
        <div class="form-group">
          <label>Data e horario do agendamento</label>
          <input type="datetime-local" id="s-agendada" class="form-control" required>
        </div>
      `}
      <div class="form-group" id="s-proxima-wrap" style="display:none;">
        <label>Proxima manutencao do equipamento</label>
        <input type="datetime-local" id="s-proxima" class="form-control">
      </div>
      ${isAdminEmpresa ? `
      <div class="form-group">
        <label>Tecnico responsavel</label>
        <select id="s-tecnico" class="form-control" required>
          <option value="" disabled selected>Selecionar tecnico...</option>
          ${tecnicos.map((t) => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
      </div>
      ` : ''}
      <button type="submit" class="btn-primary">SALVAR SERVICO</button>
    </form>
  `;

  const statusSelect = document.getElementById('s-status');
  const scheduledInput = document.getElementById('s-agendada');
  const scheduledDateInput = document.getElementById('s-agendada-data');
  const scheduledTimeInput = document.getElementById('s-agendada-hora');
  const nextWrap = document.getElementById('s-proxima-wrap');
  if (requireTimeOnly) {
    scheduledDateInput.value = toDateInputValue(initialDate || new Date());
    scheduledTimeInput.value = '';
  } else {
    scheduledInput.value = toDateTimeInputValue(initialDate || new Date());
  }
  const updateStatusView = () => {
    const closingNow = statusSelect.value === 'concluido';
    nextWrap.style.display = closingNow ? 'block' : 'none';
    if (scheduledInput) {
      scheduledInput.previousElementSibling.textContent = closingNow ? 'Data e horario do servico' : 'Data e horario do agendamento';
    } else {
      scheduledDateInput.previousElementSibling.textContent = closingNow ? 'Data do servico' : 'Data do agendamento';
    }
  };
  statusSelect.onchange = updateStatusView;
  updateStatusView();

  document.getElementById('f-client-service').onsubmit = async (event) => {
    event.preventDefault();

    const equipamentoId = Number(document.getElementById('s-equipamento').value) || null;
    const status = document.getElementById('s-status').value;
    const tipoServico = document.getElementById('s-tipo').value;
    const descricaoLivre = document.getElementById('s-desc').value.trim();
    const dataAgendada = requireTimeOnly
      ? new Date(`${document.getElementById('s-agendada-data').value}T${document.getElementById('s-agendada-hora').value}`)
      : new Date(document.getElementById('s-agendada').value);
    const proximaDataValue = document.getElementById('s-proxima').value;
    const proximaData = proximaDataValue ? new Date(proximaDataValue) : null;

    const tecnicoIdRaw = document.getElementById('s-tecnico')?.value;
    await db.manutencoes.add({
      clientId: clienteId,
      equipamentoId,
      status,
      dataAgendada,
      dataRealizada: status === 'concluido' ? dataAgendada : null,
      tipoServico,
      descricao: descricaoLivre ? `${tipoServico}: ${descricaoLivre}` : tipoServico,
      proximaData,
      valor: Number(document.getElementById('s-valor').value || 0),
      formaPagamento: document.getElementById('s-pagamento').value,
      tecnicoId: tecnicoIdRaw ? Number(tecnicoIdRaw) : null
    });

    if (status === 'concluido' && equipamentoId && proximaData) {
      await db.equipamentos.update(equipamentoId, {
        ultimaManutencao: dataAgendada,
        proximaManutencao: proximaData
      });
    } else if (status === 'concluido' && equipamentoId) {
      await db.equipamentos.update(equipamentoId, {
        ultimaManutencao: dataAgendada
      });
    }

    await renderClientDetail(clienteId);
  };
}

export async function renderCloseScheduledServiceForm(servicoId) {
  const servico = await db.manutencoes.get(servicoId);
  if (!servico) return;

  const cliente = await db.clientes.get(servico.clientId);
  const equipamentos = await db.equipamentos.where('clienteId').equals(servico.clientId).toArray();
  const isAdminEmpresa = authService.isAdmin() && authService.getBusinessMode() === 'empresa';
  const tecnicos = isAdminEmpresa ? authService.getUsers().filter((u) => u.role === 'tecnico') : [];

  openModal(`Fechar - ${cliente?.nome || 'Servico'}`);

  modalBody.innerHTML = `
    <form id="f-close-service">
      <div class="form-group">
        <label>Tipo de Servico</label>
        <input type="text" class="form-control" value="${servico.tipoServico || ''}" disabled>
      </div>
      <div class="form-group">
        <label>Equipamento atendido</label>
        <select id="cs-equipamento" class="form-control" required>
          <option value="">Selecionar equipamento...</option>
          ${equipamentos.map((equipamento) => `
            <option value="${equipamento.id}" ${servico.equipamentoId === equipamento.id ? 'selected' : ''}>${equipamento.marca} - ${equipamento.btu} BTU - ${equipamento.localizacao || 'Local nao informado'}</option>
          `).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Data realizada</label>
        <input type="datetime-local" id="cs-realizada" class="form-control" value="${toDateTimeInputValue()}" required>
      </div>
      <div class="form-group">
        <label>Proxima manutencao desse equipamento</label>
        <input type="datetime-local" id="cs-proxima" class="form-control" required>
      </div>
      <div style="display:flex; gap:10px;">
        <div class="form-group" style="flex:1;">
          <label>Valor (R$)</label>
          <input type="number" step="0.01" id="cs-valor" class="form-control" value="${servico.valor || ''}">
        </div>
        <div class="form-group" style="flex:1;">
          <label>Pagamento</label>
          <select id="cs-pagamento" class="form-control">
            ${CONSTANTS.PAYMENT_METHODS.map((method) => `<option value="${method}" ${servico.formaPagamento === method ? 'selected' : ''}>${method}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Descricao final</label>
        <textarea id="cs-desc" class="form-control" rows="3">${servico.descricao || ''}</textarea>
      </div>
      ${isAdminEmpresa ? `
      <div class="form-group">
        <label>Tecnico responsavel</label>
        <select id="cs-tecnico" class="form-control">
          <option value="">Sem atribuicao</option>
          ${tecnicos.map((t) => `<option value="${t.id}" ${servico.tecnicoId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select>
      </div>
      ` : ''}
      <button type="submit" class="btn-primary">FECHAR SERVICO</button>
    </form>
  `;

  document.getElementById('f-close-service').onsubmit = async (event) => {
    event.preventDefault();

    const equipamentoId = Number(document.getElementById('cs-equipamento').value);
    const dataRealizada = new Date(document.getElementById('cs-realizada').value);
    const proximaData = new Date(document.getElementById('cs-proxima').value);
    const tecnicoIdRaw = document.getElementById('cs-tecnico')?.value;

    await db.manutencoes.update(servicoId, {
      status: 'concluido',
      equipamentoId,
      dataRealizada,
      proximaData,
      valor: Number(document.getElementById('cs-valor').value || 0),
      formaPagamento: document.getElementById('cs-pagamento').value,
      descricao: document.getElementById('cs-desc').value,
      tecnicoId: tecnicoIdRaw ? Number(tecnicoIdRaw) : (servico.tecnicoId || null)
    });

    await db.equipamentos.update(equipamentoId, {
      ultimaManutencao: dataRealizada,
      proximaManutencao: proximaData
    });

    await renderClientDetail(servico.clientId);
  };
}

export async function renderEquipmentForm(clienteId, equipamentoId = null) {
  const isEditing = Boolean(equipamentoId);
  const cliente = await db.clientes.get(clienteId);
  const equipamento = isEditing ? await db.equipamentos.get(equipamentoId) : null;

  openModal(`${isEditing ? 'Editar' : 'Novo'} Equipamento`);

  modalBody.innerHTML = `
    <form id="f-equipment">
      <div class="form-group">
        <label>Cliente</label>
        <input type="text" class="form-control" value="${cliente?.nome || ''}" disabled>
      </div>
      <div class="form-group">
        <label>Marca do AC</label>
        <select id="e-marca" class="form-control">
          ${CONSTANTS.BRANDS.map((brand) => `<option value="${brand}" ${equipamento?.marca === brand ? 'selected' : ''}>${brand}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex; gap:10px;">
        <div class="form-group" style="flex:1;">
          <label>Capacidade</label>
          <select id="e-btu" class="form-control">
            ${CONSTANTS.BTUS.map((btu) => `<option value="${btu}" ${Number(equipamento?.btu) === btu ? 'selected' : ''}>${btu} BTU</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="flex:1;">
          <label>Local do AC</label>
          <input type="text" id="e-local" class="form-control" value="${equipamento?.localizacao || ''}" placeholder="Sala, quarto, recepcao">
        </div>
      </div>
      <div class="form-group">
        <label>Proxima manutencao</label>
        <input type="datetime-local" id="e-proxima" class="form-control" value="${equipamento?.proximaManutencao ? toDateTimeInputValue(equipamento.proximaManutencao) : ''}">
      </div>
      <button type="submit" class="btn-primary">${isEditing ? 'SALVAR EQUIPAMENTO' : 'ADICIONAR EQUIPAMENTO'}</button>
    </form>
  `;

  document.getElementById('f-equipment').onsubmit = async (event) => {
    event.preventDefault();

    const proxima = document.getElementById('e-proxima').value;
    const payload = {
      clienteId,
      marca: document.getElementById('e-marca').value,
      btu: Number(document.getElementById('e-btu').value),
      localizacao: document.getElementById('e-local').value,
      proximaManutencao: proxima ? new Date(proxima) : null
    };

    if (isEditing) {
      await db.equipamentos.update(equipamentoId, payload);
    } else {
      await db.equipamentos.add({
        ...payload,
        ultimaManutencao: null
      });
    }

    await renderClientDetail(clienteId);
  };
}

/**
 * Compatibilidade: agora cria um grupo/tag simples.
 */
export async function renderBairroForm() {
  openModal('Novo Grupo');

  modalBody.innerHTML = `
    <form id="f-bairro">
      <div class="form-group">
        <label>Nome do Grupo ou Rota</label>
        <input type="text" id="b-nome" class="form-control" required placeholder="Ex: Rota Segunda, Zona Norte, Contrato Mensal">
      </div>
      <div class="form-group">
        <label>Cor</label>
        <input type="color" id="b-cor" class="form-control" value="#22c55e" style="cursor:pointer; height:40px;">
      </div>
      <button type="submit" class="btn-primary">CRIAR GRUPO</button>
    </form>
  `;

  document.getElementById('f-bairro').onsubmit = async (event) => {
    event.preventDefault();
    await db.bairros.add({
      nome: document.getElementById('b-nome').value,
      cor: document.getElementById('b-cor').value
    });
    location.reload();
  };
}

export async function renderFullPropertyForm(clienteId = null, scheduledServiceDate = null) {
  const isEditing = Boolean(clienteId);
  const cliente = isEditing ? await db.clientes.get(clienteId) : null;
  const hasScheduledServiceDate = !isEditing && Boolean(scheduledServiceDate);

  openModal(isEditing ? 'Editar Cliente' : 'Novo Cliente');

  modalBody.innerHTML = `
    <form id="f-client">
      <div class="form-group">
        <label>Nome do Cliente</label>
        <input type="text" id="c-nome" class="form-control" required value="${cliente?.nome || ''}" placeholder="Ex: Condominio Atlantico, Joao Silva">
      </div>
      <div class="form-group">
        <label>Tipo</label>
        <select id="c-tipo" class="form-control">
          ${CLIENT_TYPES.map((type) => `<option value="${type}" ${cliente?.tipo === type ? 'selected' : ''}>${type}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Rua / Logradouro</label>
        <input type="text" id="c-logradouro" class="form-control" value="${cliente?.logradouro || cliente?.endereco || ''}" placeholder="Ex: Rua das Acacias">
      </div>
      <div style="display:flex; gap:10px;">
        <div class="form-group" style="flex:1;">
          <label>Numero</label>
          <input type="text" id="c-numero" class="form-control" value="${cliente?.numero || ''}" placeholder="100">
        </div>
        <div class="form-group" style="flex:1;">
          <label>Complemento</label>
          <input type="text" id="c-complemento" class="form-control" value="${cliente?.complemento || ''}" placeholder="Apt, sala, bloco">
        </div>
      </div>
      <div class="form-group">
        <label>Bairro</label>
        <input type="text" id="c-bairro-endereco" class="form-control" value="${cliente?.bairroEndereco || ''}" placeholder="Ex: Manaira">
      </div>
      <div style="display:flex; gap:10px;">
        <div class="form-group" style="flex:1;">
          <label>Cidade</label>
          <input type="text" id="c-cidade" class="form-control" value="${cliente?.cidade || ''}" placeholder="Joao Pessoa">
        </div>
        <div class="form-group" style="width:95px;">
          <label>UF</label>
          <input type="text" id="c-estado" class="form-control" value="${cliente?.estado || ''}" placeholder="PB" maxlength="2">
        </div>
      </div>
      <div class="form-group">
        <label>CEP</label>
        <input type="text" id="c-cep" class="form-control" value="${cliente?.cep || ''}" placeholder="58000-000">
      </div>
      <div class="form-group">
        <label>WhatsApp</label>
        <input type="tel" id="c-whats" class="form-control" value="${cliente?.whatsapp || ''}" placeholder="(83) 99999-0000">
      </div>

      ${hasScheduledServiceDate ? `
        <div style="background:rgba(14,165,233,0.12); border:1px solid rgba(14,165,233,0.35); border-radius:8px; padding:12px; margin-bottom:14px;">
          <label style="font-size:9px; opacity:0.75; font-weight:800;">AGENDAMENTO</label>
          <p style="margin:6px 0 0 0; font-size:12px;">Data selecionada: ${formatDateOnly(scheduledServiceDate)}</p>
          <p style="margin:4px 0 0 0; font-size:10px; opacity:0.65;">Depois de salvar o cliente, informe apenas o horario do servico.</p>
        </div>
      ` : ''}

      ${isEditing ? '' : `
        <hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:20px 0;">

        <h4 style="font-size:12px; font-weight:700; margin:0 0 15px 0;">EQUIPAMENTO INICIAL (OPCIONAL)</h4>

        <div class="form-group">
          <label>Marca do AC</label>
          <select id="c-marca" class="form-control">
            <option value="">-- Sem equipamento --</option>
            ${CONSTANTS.BRANDS.map((brand) => `<option value="${brand}">${brand}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex; gap:10px;">
          <div class="form-group" style="flex:1;">
            <label>Capacidade</label>
            <select id="c-btu" class="form-control">
              ${CONSTANTS.BTUS.map((btu) => `<option value="${btu}">${btu} BTU</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="flex:1;">
            <label>Local do AC</label>
            <input type="text" id="c-local" class="form-control" placeholder="Sala, quarto, recepcao">
          </div>
        </div>
      `}

      <button type="submit" class="btn-primary" style="margin-top:15px;">${isEditing ? 'SALVAR ALTERACOES' : 'SALVAR CLIENTE'}</button>
    </form>
  `;

  document.getElementById('f-client').onsubmit = async (event) => {
    event.preventDefault();

    const addressPayload = {
      logradouro: document.getElementById('c-logradouro').value,
      numero: document.getElementById('c-numero').value,
      complemento: document.getElementById('c-complemento').value,
      bairroEndereco: document.getElementById('c-bairro-endereco').value,
      cidade: document.getElementById('c-cidade').value,
      estado: document.getElementById('c-estado').value.toUpperCase(),
      cep: document.getElementById('c-cep').value
    };

    const payload = {
      nome: document.getElementById('c-nome').value,
      ...addressPayload,
      endereco: buildAddress(addressPayload),
      tipo: document.getElementById('c-tipo').value,
      grupo: '',
      telefone: '',
      whatsapp: document.getElementById('c-whats').value
    };

    if (isEditing) {
      await db.clientes.update(clienteId, payload);
      await renderClientDetail(clienteId);
      return;
    }

    const newClientId = await db.clientes.add({
      bairroId: null,
      ...payload
    });

    const marca = document.getElementById('c-marca').value;
    let newEquipmentId = null;
    if (marca) {
      newEquipmentId = await db.equipamentos.add({
        clienteId: newClientId,
        marca,
        btu: Number(document.getElementById('c-btu').value),
        localizacao: document.getElementById('c-local').value,
        ultimaManutencao: null,
        proximaManutencao: new Date()
      });
    }

    if (hasScheduledServiceDate) {
      await renderClientServiceForm(newClientId, 'agendado', newEquipmentId, scheduledServiceDate, true);
      return;
    }

    location.reload();
  };
}

export async function renderContactsImportForm() {
  const pickerSupported = isContactPickerSupported();

  openModal('Importar da Agenda');

  modalBody.innerHTML = `
    <form id="f-contact-import">
      <div class="form-group">
        <label>Tipo</label>
        <select id="ci-tipo" class="form-control">
          ${CLIENT_TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')}
        </select>
      </div>

      <button type="button" id="ci-picker" class="btn-primary" style="background:#22c55e; margin-top:10px; ${pickerSupported ? '' : 'opacity:0.45;'}" ${pickerSupported ? '' : 'disabled'}>
        SELECIONAR CONTATOS DO CELULAR
      </button>

      <div style="margin:16px 0; text-align:center; font-size:10px; opacity:0.5; font-weight:800;">OU</div>

      <div class="form-group">
        <label>Importar arquivo .vcf ou .csv</label>
        <input type="file" id="ci-file" class="form-control" accept=".vcf,.csv,text/vcard,text/csv">
      </div>
      <button type="button" id="ci-file-btn" class="btn-primary" style="background:#0ea5e9; margin-top:10px;">
        IMPORTAR ARQUIVO
      </button>
    </form>
  `;

  const importContacts = async (contacts) => {
    const tipo = document.getElementById('ci-tipo').value;
    const normalized = contacts
      .map(normalizeContact)
      .filter((contact) => contact.name && contact.phone);

    if (normalized.length === 0) {
      alert('Nenhum contato valido encontrado.');
      return;
    }

    let created = 0;
    for (const contact of normalized) {
      const existing = await db.clientes
        .filter((cliente) => {
          const phone = String(cliente.whatsapp || '').replace(/[^\d+]/g, '');
          return phone && phone === contact.phone;
        })
        .first();

      if (existing) continue;

      await db.clientes.add({
        bairroId: null,
        nome: contact.name,
        endereco: '',
        tipo,
        grupo: '',
        telefone: '',
        whatsapp: contact.phone
      });
      created += 1;
    }

    alert(`${created} contato(s) importado(s).`);
    location.reload();
  };

  const pickerButton = document.getElementById('ci-picker');
  if (pickerButton) {
    pickerButton.onclick = async () => {
      try {
        await importContacts(await pickContactsFromDevice());
      } catch (error) {
        alert(error.message);
      }
    };
  }

  document.getElementById('ci-file-btn').onclick = async () => {
    const file = document.getElementById('ci-file').files[0];
    if (!file) {
      alert('Selecione um arquivo .vcf ou .csv.');
      return;
    }

    try {
      await importContacts(await parseContactsFile(file));
    } catch (error) {
      alert('Erro ao importar contatos: ' + error.message);
    }
  };
}

export default {
  renderBairros,
  renderBairroDetail,
  renderClientDetail,
  renderBairroForm,
  renderFullPropertyForm,
  renderContactsImportForm,
  renderClientServiceForm,
  renderCloseScheduledServiceForm,
  renderEquipmentForm,
  setClientFilter
};
