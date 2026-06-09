/**
 * Modulo COMUNICACAO - Automacao assistida de mensagens
 */

import { db } from '../../services/db.js';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
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

function daysUntil(value) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function isScheduleReminderWindow() {
  const hour = new Date().getHours();
  return hour >= 17 && hour < 18;
}

function shouldPrepareScheduleReminder(service) {
  return daysUntil(service.dataAgendada) === 1 && isScheduleReminderWindow();
}

function buildAddress(cliente) {
  if (!cliente) return '';
  const streetNumber = [cliente.logradouro, cliente.numero].filter(Boolean).join(', ');
  const cityState = [cliente.cidade, cliente.estado].filter(Boolean).join(' - ');
  return [
    streetNumber,
    cliente.complemento,
    cliente.bairroEndereco,
    cityState,
    cliente.cep
  ].filter(Boolean).join(', ') || cliente.endereco || '';
}

function openWhatsApp(phone, message) {
  const clean = cleanPhone(phone);
  if (!clean) {
    alert('Cliente sem WhatsApp cadastrado.');
    return;
  }
  window.open(`https://wa.me/${clean}?text=${encodeURIComponent(message)}`, '_blank');
}

async function logCommunication(clienteId, tipo, mensagem) {
  await db.comunicacao.add({
    clienteId,
    tipo,
    mensagem,
    data: new Date()
  });
}

function getDoneKey(item) {
  return `msg_done_${item.id}`;
}

function isMessageDone(item) {
  return localStorage.getItem(getDoneKey(item)) === '1';
}

async function getAutomationItems() {
  const clientes = await db.clientes.toArray();
  const equipamentos = await db.equipamentos.toArray();
  const manutencoes = await db.manutencoes.toArray();

  const overdue = equipamentos
    .filter((equipamento) => equipamento.proximaManutencao && daysUntil(equipamento.proximaManutencao) < 0)
    .map((equipamento) => {
      const cliente = clientes.find((item) => item.id === equipamento.clienteId);
      const message = `Olá, ${cliente?.nome || 'tudo bem'}! Identifiquei aqui que a manutenção do seu ar-condicionado (${equipamento.marca} - ${equipamento.localizacao || 'local não informado'}) venceu em ${formatDateTime(equipamento.proximaManutencao)}. Podemos agendar uma visita?`;
      return {
        id: `vencida-${equipamento.id}`,
        type: 'vencida',
        title: cliente?.nome || 'Cliente',
        subtitle: `${equipamento.marca} - ${equipamento.localizacao || 'Local não informado'}`,
        date: equipamento.proximaManutencao,
        phone: cliente?.whatsapp,
        clienteId: cliente?.id,
        message
      };
    });

  const scheduled = manutencoes
    .filter((item) => item.status === 'agendado' && item.dataAgendada)
    .filter(shouldPrepareScheduleReminder)
    .sort((a, b) => new Date(a.dataAgendada) - new Date(b.dataAgendada))
    .map((service) => {
      const cliente = clientes.find((item) => item.id === service.clientId);
      const equipamento = equipamentos.find((item) => item.id === service.equipamentoId);
      const address = buildAddress(cliente);
      const message = `Olá, ${cliente?.nome || 'tudo bem'}! Passando para confirmar seu agendamento de ${service.tipoServico || 'serviço'} para ${formatDateTime(service.dataAgendada)}${equipamento ? ` no equipamento ${equipamento.marca} - ${equipamento.localizacao || 'local não informado'}` : ''}${address ? `, no endereço ${address}` : ''}. Está confirmado?`;
      return {
        id: `agendada-${service.id}`,
        type: 'agendada',
        title: cliente?.nome || 'Cliente',
        subtitle: service.tipoServico || 'Serviço agendado',
        date: service.dataAgendada,
        phone: cliente?.whatsapp,
        clienteId: cliente?.id,
        message
      };
    });

  return {
    overdue: overdue.filter((item) => !isMessageDone(item)),
    scheduled: scheduled.filter((item) => !isMessageDone(item))
  };
}

export async function hasPendingAutomationMessages() {
  const items = await getAutomationItems();
  return items.overdue.length > 0 || items.scheduled.length > 0;
}

function renderMessageCard(item) {
  const color = item.type === 'vencida' ? '#ef4444' : '#0ea5e9';
  const label = item.type === 'vencida' ? 'MANUTENCAO VENCIDA' : 'CONFIRMACAO DE AGENDAMENTO';

  return `
    <div class="card" style="margin:0; padding:14px; border-left:5px solid ${color};">
      <div style="display:flex; justify-content:space-between; gap:10px;">
        <div style="min-width:0;">
          <p style="font-size:8px; font-weight:900; color:${color}; margin:0 0 5px 0;">${label}</p>
          <h3 style="font-size:14px; margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.title}</h3>
          <p style="font-size:10px; opacity:0.6; margin:5px 0 0 0;">${item.subtitle} • ${formatDateTime(item.date)}</p>
        </div>
      </div>
      <p style="font-size:11px; line-height:1.45; background:rgba(255,255,255,0.04); padding:10px; border-radius:8px; margin:12px 0 0 0;">${item.message}</p>
      <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; margin-top:10px;">
        <button class="btn-primary" onclick="window.sendAutomationMessage('${item.id}')" style="margin-top:0; background:#25D366; font-size:10px; padding:11px 8px;">WHATSAPP</button>
        <button class="btn-primary" onclick="window.copyAutomationMessage('${item.id}')" style="margin-top:0; background:#0ea5e9; font-size:10px; padding:11px 8px;">COPIAR</button>
        <button class="btn-primary" onclick="window.completeAutomationMessage('${item.id}')" style="margin-top:0; background:#22c55e; font-size:10px; padding:11px 8px;">CONCLUIDA</button>
      </div>
    </div>
  `;
}


export async function renderComunicacao(mainContent, headerContent) {
  headerContent.innerHTML = '<h2 style="font-size: 20px; font-weight: 800; margin:0;">COMUNICACAO</h2>';

  const items = await getAutomationItems();
  const all = [...items.overdue, ...items.scheduled];
  window.__automationMessages = all;
  window.sendAutomationMessage = sendAutomationMessage;
  window.copyAutomationMessage = copyAutomationMessage;
  window.completeAutomationMessage = async (itemId) => {
    await completeAutomationMessage(itemId);
    await renderComunicacao(mainContent, headerContent);
  };
  mainContent.innerHTML = `
    <div class="animate-in" style="display:flex; flex-direction:column; gap:16px; padding:0 20px;">
      <div class="card" style="margin:0; padding:16px;">
        <h3 style="font-size:15px; margin:0;">Automacao de mensagens</h3>
        <p style="font-size:11px; opacity:0.65; line-height:1.45; margin:8px 0 0 0;">
          O app prepara as mensagens automaticamente. Pelo WhatsApp comum, o envio precisa ser confirmado por voce.
        </p>
        <p style="font-size:11px; line-height:1.45; margin:10px 0 0 0; color:var(--primary); font-weight:800;">
          Breve integração com WhatsApp e automações de mensagens.
        </p>
      </div>

      <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;">
        <div class="card" style="margin:0; padding:14px;">
          <p style="font-size:9px; opacity:0.6; margin:0;">VENCIDAS</p>
          <p style="font-size:26px; font-weight:900; margin:4px 0 0 0; color:#ef4444;">${items.overdue.length}</p>
        </div>
        <div class="card" style="margin:0; padding:14px;">
          <p style="font-size:9px; opacity:0.6; margin:0;">AGENDADOS</p>
          <p style="font-size:26px; font-weight:900; margin:4px 0 0 0; color:#0ea5e9;">${items.scheduled.length}</p>
        </div>
      </div>

      ${all.length > 0 ? all.map(renderMessageCard).join('') : `
        <div style="text-align:center; padding:45px 10px; opacity:0.45;">
          <span class="material-symbols-rounded" style="font-size:44px; display:block; margin-bottom:10px;">mark_email_read</span>
          Nenhuma mensagem pendente.
        </div>
      `}
    </div>
  `;
}

export async function sendAutomationMessage(itemId) {
  const item = window.__automationMessages?.find((message) => message.id === itemId);
  if (!item) return;

  openWhatsApp(item.phone, item.message);
  if (item.clienteId) {
    await logCommunication(item.clienteId, item.type, item.message);
  }
}

export async function copyAutomationMessage(itemId) {
  const item = window.__automationMessages?.find((message) => message.id === itemId);
  if (!item) return;

  await navigator.clipboard.writeText(item.message);
  alert('Mensagem copiada.');
}

export async function completeAutomationMessage(itemId) {
  const item = window.__automationMessages?.find((message) => message.id === itemId);
  if (!item) return;

  localStorage.setItem(getDoneKey(item), '1');
  if (item.clienteId) {
    await logCommunication(item.clienteId, `${item.type}_concluida`, item.message);
  }
}

export default {
  renderComunicacao
};
