/**
 * Módulo AGENDA - Dashboard e gestão de visitas
 * Responsável pela visualização e gerenciamento da agenda de manutenções
 */

import { 
  db, getMaintenanceByPeriod, getOverdueEquipments, 
  getUpcomingEquipments, calculateMonthlyRevenue 
} from '../../services/db.js';
import { 
  openModal, getAvatarUrl, getLogo, formatDate, 
  formatCurrency, daysUntilDate, getGreeting, CONSTANTS,
  modalBody, fileToBase64
} from '../../services/ui.js';
import { authService } from '../../services/auth.js';
import { comunicacaoService } from '../../services/comunicacao.js';
import { pdfService } from '../../services/pdf.js';

let currentHomeFilter = 'hoje';
let currentHomeView = 'lista';
let calendarMonthOffset = 0;

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
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

function sameDate(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function isTomorrow(value) {
  const tomorrow = startOfDay(new Date());
  tomorrow.setDate(tomorrow.getDate() + 1);
  return startOfDay(value).getTime() === tomorrow.getTime();
}

function isThisWeek(value) {
  const today = startOfDay(new Date());
  const target = startOfDay(value);
  const weekEnd = startOfDay(today);
  weekEnd.setDate(today.getDate() + (6 - today.getDay()));
  return target >= today && target <= weekEnd;
}

function matchesHomeFilter(value) {
  if (!value) return false;
  if (currentHomeFilter === 'todos') return true;
  if (currentHomeFilter === 'hoje') return sameDate(value, new Date());
  if (currentHomeFilter === 'amanha') return isTomorrow(value);
  if (currentHomeFilter === 'semana') return isThisWeek(value);
  return true;
}

function getAgendaEvents(equipamentos, clientes, scheduledServices) {
  const maintenanceEvents = equipamentos
    .filter((equipamento) => equipamento.proximaManutencao)
    .map((equipamento) => {
      const cliente = clientes.find((item) => item.id === equipamento.clienteId);
      return {
        type: 'maintenance',
        date: equipamento.proximaManutencao,
        title: cliente?.nome || 'Cliente',
        subtitle: `${equipamento.marca} - ${equipamento.localizacao || 'Local nao informado'}`,
        color: daysUntilDate(equipamento.proximaManutencao) <= 0 ? '#ff4d4d' : '#22c55e',
        action: `window.renderEquipmentHistory(${equipamento.id})`
      };
    });

  const serviceEvents = scheduledServices.map((service) => {
    const cliente = clientes.find((item) => item.id === service.clientId);
    return {
      type: 'scheduled',
      date: service.dataAgendada,
      title: cliente?.nome || 'Cliente',
      subtitle: service.tipoServico || 'Servico agendado',
      color: '#0ea5e9',
      action: `window.renderCloseScheduledServiceForm(${service.id})`
    };
  });

  return [...serviceEvents, ...maintenanceEvents].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function renderCalendar(events, canManage = true) {
  const target = new Date();
  target.setMonth(target.getMonth() + calendarMonthOffset);
  const year = target.getFullYear();
  const month = target.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const monthName = target.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
  const startOffset = firstDay.getDay();
  const today = new Date();
  const monthEvents = events.filter((event) => {
    const date = new Date(event.date);
    return date.getMonth() === month && date.getFullYear() === year;
  });

  let cells = '';
  for (let index = 0; index < startOffset; index += 1) {
    cells += '<div style="aspect-ratio:1; opacity:0.2;"></div>';
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(year, month, day);
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = monthEvents.filter((event) => sameDate(event.date, date));
    const isToday = sameDate(date, today);

    cells += `
      <div ${canManage ? `onclick="window.renderCalendarServicePicker('${dateKey}')"` : ''} style="aspect-ratio:1; border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:6px; background:${isToday ? 'rgba(0,242,255,0.12)' : 'rgba(255,255,255,0.03)'}; overflow:hidden; cursor:${canManage ? 'pointer' : 'default'};">
        <p style="margin:0; font-size:10px; font-weight:900; color:${isToday ? 'var(--primary)' : 'var(--text)'};">${day}</p>
        <div style="display:flex; gap:3px; flex-wrap:wrap; margin-top:5px;">
          ${dayEvents.slice(0, 3).map((event) => `<span style="width:6px; height:6px; border-radius:50%; background:${event.color}; display:block;"></span>`).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div class="animate-in" style="padding:0 20px 20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; background:rgba(255,255,255,0.05); border-radius:12px; padding:6px;">
        <button class="icon-btn" onclick="window.changeCalendarMonth(-1)" style="width:36px; height:36px;"><span class="material-symbols-rounded">chevron_left</span></button>
        <span style="font-size:12px; font-weight:900;">${monthName}</span>
        <button class="icon-btn" onclick="window.changeCalendarMonth(1)" style="width:36px; height:36px;"><span class="material-symbols-rounded">chevron_right</span></button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; margin-bottom:10px;">
        ${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day) => `<div style="font-size:9px; opacity:0.55; text-align:center; font-weight:900;">${day}</div>`).join('')}
        ${cells}
      </div>
      <div style="display:flex; gap:10px; margin:12px 0 14px;">
        <span style="font-size:9px; font-weight:800;"><span style="width:8px; height:8px; border-radius:50%; background:#0ea5e9; display:inline-block; margin-right:5px;"></span>SERVICO</span>
        <span style="font-size:9px; font-weight:800;"><span style="width:8px; height:8px; border-radius:50%; background:#22c55e; display:inline-block; margin-right:5px;"></span>MANUTENCAO</span>
        <span style="font-size:9px; font-weight:800;"><span style="width:8px; height:8px; border-radius:50%; background:#ff4d4d; display:inline-block; margin-right:5px;"></span>VENCIDO</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${monthEvents.length > 0 ? monthEvents.map((event) => `
          <div ${canManage && event.action ? `onclick="${event.action}"` : ''} style="background:rgba(255,255,255,0.04); border-left:4px solid ${event.color}; border-radius:8px; padding:11px; cursor:${canManage && event.action ? 'pointer' : 'default'};">
            <div style="display:flex; justify-content:space-between; gap:10px;">
              <h3 style="font-size:12px; margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${event.title}</h3>
              <span style="font-size:9px; font-weight:900; color:${event.color};">${formatDateTime(event.date)}</span>
            </div>
            <p style="font-size:10px; margin:5px 0 0 0; opacity:0.65;">${event.subtitle}</p>
          </div>
        `).join('') : '<p style="text-align:center; opacity:0.4; padding:25px 0; font-size:12px;">Nenhum item neste mes.</p>'}
      </div>
    </div>
  `;
}

/**
 * Renderizar dashboard principal
 */
export async function renderDashboard(mainContent, headerContent, searchTerm = '') {
  window.setHomeView = setHomeView;
  window.changeCalendarMonth = changeCalendarMonth;
  window.renderCalendarServicePicker = renderCalendarServicePicker;
  const tech = authService.getTechnicianData();
  const canManage = authService.isAdmin();
  const hour = new Date().getHours();
  const greeting = getGreeting();

  const eqsN = await db.equipamentos.toArray();
  const scheduledN = (await db.manutencoes.toArray()).filter((item) => item.status === 'agendado');
  const hasNotif = eqsN.some(e => 
    e.proximaManutencao && daysUntilDate(e.proximaManutencao) <= 7
  ) || scheduledN.some((item) => item.dataAgendada && daysUntilDate(item.dataAgendada) <= 7);
  const badge = hasNotif ? 
    `<span style="position:absolute; top:0; right:0; width:10px; height:10px; background:#ff4d4d; border-radius:50%; border:2px solid var(--bg);"></span>` 
    : '';

  headerContent.innerHTML = `
    <div class="user-info">
      <div class="user-profile"><img src="${getAvatarUrl(tech.avatar)}"></div>
      <div class="user-text">
        <h1 style="font-size:14px; margin:0; font-weight:600; opacity:0.8;">${greeting},</h1>
        <p style="font-size:18px; font-weight:800; margin:0; color:var(--primary);">${tech.name}</p>
      </div>
    </div>
    <div style="display:flex; gap:10px;">
      ${canManage ? `<div class="icon-btn" onclick="window.showFinancialReport()" style="background:rgba(34, 197, 94, 0.1); color:#22c55e;">
        <span class="material-symbols-rounded">bar_chart</span>
      </div>` : ''}
      <div class="icon-btn" style="position:relative;" onclick="window.showNotifications()">
        <span class="material-symbols-rounded">notifications</span>${badge}
      </div>
      <div class="icon-btn" onclick="window.logoutApp()" style="background:rgba(239,68,68,0.1); color:#ef4444;">
        <span class="material-symbols-rounded">logout</span>
      </div>
    </div>
  `;
  
  let html = `
    <div class="page-header animate-in" style="padding: 0 20px;">
      <h2 style="font-size: 24px; margin:0; font-weight:800;">Agenda</h2>
      <div style="display:flex; gap:8px; padding:14px 0 0;">
        <button class="pill ${currentHomeView === 'lista' ? 'active' : ''}" onclick="window.setHomeView('lista')">LISTA</button>
        <button class="pill ${currentHomeView === 'calendario' ? 'active' : ''}" onclick="window.setHomeView('calendario')">CALENDARIO</button>
      </div>
      ${currentHomeView === 'calendario' ? '' : `<div style="display: flex; gap: 8px; overflow-x: auto; padding: 15px 0; scrollbar-width: none;">
        <button class="pill ${currentHomeFilter === 'todos' ? 'active' : ''}" 
                onclick="window.setHomeFilter('todos')">TODOS</button>
        <button class="pill ${currentHomeFilter === 'hoje' ? 'active' : ''}" 
                onclick="window.setHomeFilter('hoje')">HOJE</button>
        <button class="pill ${currentHomeFilter === 'amanha' ? 'active' : ''}" 
                onclick="window.setHomeFilter('amanha')">AMANHA</button>
        <button class="pill ${currentHomeFilter === 'semana' ? 'active' : ''}" 
                onclick="window.setHomeFilter('semana')">ESTA SEMANA</button>
      </div>`}
      <div class="search-box">
        <span class="material-symbols-rounded">search</span>
        <input type="text" id="main-search" placeholder="Buscar cliente..." value="${searchTerm}">
      </div>
    </div>
  `;

  const eqs = await db.equipamentos.toArray();
  const clsList = await db.clientes.toArray();
  const undList = await db.unidades?.toArray() || [];
  const isEmpresa = authService.getBusinessMode() === 'empresa';
  const allUsers = isEmpresa ? authService.getUsers() : [];
  const currentUser = authService.getCurrentUser();
  const scheduledServices = (await db.manutencoes.toArray())
    .filter((item) => item.status === 'agendado')
    .filter((item) => currentHomeView === 'calendario' || matchesHomeFilter(item.dataAgendada))
    .filter((item) => !authService.isEmployee() || item.tecnicoId === currentUser?.id)
    .sort((a, b) => new Date(a.dataAgendada) - new Date(b.dataAgendada));

  if (currentHomeView === 'calendario') {
    mainContent.innerHTML = html + renderCalendar(getAgendaEvents(eqs, clsList, scheduledServices), canManage);
    return;
  }
  
  let filtered = eqs.filter(e => e.proximaManutencao && matchesHomeFilter(e.proximaManutencao));
  
  let sorted = filtered.sort((a, b) => 
    new Date(a.proximaManutencao) - new Date(b.proximaManutencao)
  );

  html += '<div class="dashboard-grid animate-in">';

  for (const service of scheduledServices) {
    const c = service.clientId ? clsList.find((cliente) => cliente.id === service.clientId) : null;
    const e = service.equipamentoId ? eqs.find((equipamento) => equipamento.id === service.equipamentoId) : null;
    const displayName = c?.nome || 'Cliente';
    const address = buildAddress(c);
    const addressLink = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
    const whatsappLink = c?.whatsapp ? `https://wa.me/${String(c.whatsapp).replace(/\D/g, '')}` : '';
    const tecnico = service.tecnicoId ? allUsers.find((u) => u.id === service.tecnicoId) : null;

    if (searchTerm && !displayName.toLowerCase().includes(searchTerm.toLowerCase())) continue;

    html += `
      <div class="card" style="grid-column: span 2; margin-left:0; margin-right:0; border-left:5px solid #0ea5e9;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
          <div style="min-width:0;">
            <p style="font-size:8px; font-weight:900; color:#0ea5e9; margin:0 0 6px 0;">SERVICO AGENDADO</p>
            <h3 style="font-size:14px; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</h3>
            <p style="font-size:10px; opacity:0.65; margin:5px 0 0 0;">${service.tipoServico || 'Servico'} • ${e ? `${e.marca} - ${e.localizacao || 'Local nao informado'}` : 'Equipamento a definir'}</p>
            ${tecnico ? `<p style="font-size:9px; margin:5px 0 0 0; color:#a78bfa; font-weight:700;">TECNICO: ${tecnico.name}</p>` : (isEmpresa ? `<p style="font-size:9px; margin:5px 0 0 0; opacity:0.4;">Sem tecnico atribuido</p>` : '')}
          </div>
          <span style="font-size:10px; font-weight:900; color:#0ea5e9;">${formatDateTime(service.dataAgendada)}</span>
        </div>
        ${canManage ? `<div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; margin-top:15px;">
          <button class="btn-primary" onclick="window.renderCloseScheduledServiceForm(${service.id})" style="margin-top:0; background:#ef4444; color:white; font-size:9px; padding:10px 6px;">FECHAR</button>
          ${c ? `<button class="btn-primary" onclick="window.renderNewServiceLaunch(${c.id}, ${e?.id || 'null'})" style="margin-top:0; background:#7c3aed; font-size:9px; padding:10px 6px;">NOVO SERVICO</button>` : ''}
        </div>` : ''}
        <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; margin-top:8px;">
          ${addressLink ? `<a class="btn-primary" href="${addressLink}" target="_blank" style="margin-top:0; background:#0ea5e9; font-size:9px; padding:10px 6px; text-decoration:none;">MAPS</a>` : `<button class="btn-primary" disabled style="margin-top:0; background:#334155; color:#94a3b8; font-size:9px; padding:10px 6px;">MAPS</button>`}
          ${whatsappLink ? `<a class="btn-primary" href="${whatsappLink}" target="_blank" style="margin-top:0; background:#25D366; font-size:9px; padding:10px 6px; text-decoration:none;">WHATSAPP</a>` : `<button class="btn-primary" disabled style="margin-top:0; background:#334155; color:#94a3b8; font-size:9px; padding:10px 6px;">WHATSAPP</button>`}
        </div>
      </div>
    `;
  }
  
  for (const e of sorted) {
    const c = clsList.find(cl => cl.id === e.clienteId);
    const u = e.unidadeId && undList ? undList.find(un => un.id === e.unidadeId) : null;
    const displayName = u ? `${c.nome} • ${u.apartamento}` : (c ? c.nome : 'Desconhecido');
    
    if (!c || (searchTerm && 
        !displayName.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !e.marca.toLowerCase().includes(searchTerm.toLowerCase()))) {
      continue;
    }
    
    const diff = daysUntilDate(e.proximaManutencao);
    const tel = u?.telefone || c.whatsapp || c.telefone || '';
    const address = buildAddress(c);
    const addressLink = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
    const whatsappLink = tel ? `https://wa.me/${String(tel).replace(/\D/g, '')}` : '';
    
    html += `
      <div class="card" style="grid-column: span 2; margin-left:0; margin-right:0;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <div style="width:42px; height:42px; background:white; border-radius:10px; padding:8px;">
            <img src="${getLogo(e.marca)}" style="width: 100%; height:100%; object-fit:contain;" />
          </div>
          <div onclick="window.renderEquipmentHistory(${e.id})" style="flex:1; min-width:0;">
            <h3 style="font-size: 14px; margin: 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" 
                title="${displayName}">${displayName}</h3>
            ${u ? `<p style="font-size: 9px; color:var(--primary); margin:2px 0 0 0; font-weight:700;">${u.proprietario}</p>` : ''}
            <p style="font-size: 10px; opacity: 0.6; font-weight:600; margin-top:2px;">${e.marca} • ${e.localizacao}</p>
          </div>
          <div style="display:flex; align-items:center;">
            <span style="font-size: 10px; font-weight: 800; color: ${diff <= 0 ? '#ff4d4d' : 'var(--primary)'};">
              ${diff <= 0 ? 'VENCIDO' : 'Faltam ' + diff + 'd'}
            </span>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; background: rgba(0,0,0,0.15); padding: 12px; border-radius: 12px; margin-top:15px;">
          <div style="text-align:left;">
            <p style="font-size:7px; opacity:0.5; margin:0;">ÚLTIMA</p>
            <p style="font-size:9px; font-weight:700; margin:0;">${e.ultimaManutencao ? formatDate(e.ultimaManutencao) : '---'}</p>
          </div>
          <div style="text-align:right;">
            <p style="font-size:7px; opacity:0.5; margin:0;">PRÓXIMA</p>
            <p style="font-size:9px; font-weight:700; margin:0; color:var(--primary);">${formatDateTime(e.proximaManutencao)}</p>
          </div>
        </div>
        ${canManage ? `<div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; margin-top:15px;">
          <button class="btn-primary" onclick="window.renderClientServiceForm(${c.id}, 'concluido', ${e.id})" 
                  style="margin-top:0; background:#ef4444; color:white; font-size:9px; padding:10px 6px;">FECHAR</button>
          <button class="btn-primary" onclick="window.renderNewServiceLaunch(${c.id}, ${e.id})" 
                  style="margin-top:0; background:#7c3aed; font-size:9px; padding:10px 6px;">NOVO SERVICO</button>
        </div>` : ''}
        <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; margin-top:8px;">
          ${addressLink ? `<a class="btn-primary" href="${addressLink}" target="_blank" style="margin-top:0; background:#0ea5e9; font-size:9px; padding:10px 6px; text-decoration:none;">MAPS</a>` : `<button class="btn-primary" disabled style="margin-top:0; background:#334155; color:#94a3b8; font-size:9px; padding:10px 6px;">MAPS</button>`}
          ${whatsappLink ? `<a class="btn-primary" href="${whatsappLink}" target="_blank" style="margin-top:0; background:#25D366; font-size:9px; padding:10px 6px; text-decoration:none;">WHATSAPP</a>` : `<button class="btn-primary" disabled style="margin-top:0; background:#334155; color:#94a3b8; font-size:9px; padding:10px 6px;">WHATSAPP</button>`}
        </div>
      </div>
    `;
  }
  
  mainContent.innerHTML = html + '</div>';
  
  const sInp = document.getElementById('main-search');
  if (sInp) sInp.oninput = (e) => renderDashboard(mainContent, headerContent, e.target.value);
}

/**
 * Mostrar notificações de manutenções vencidas
 */
export async function showNotifications() {
  openModal('Notificações');
  const canManage = authService.isAdmin();
  const isEmpresa = authService.getBusinessMode() === 'empresa';
  const allUsers = isEmpresa ? authService.getUsers() : [];

  const eqs = await db.equipamentos.toArray();
  const clsList = await db.clientes.toArray();
  const undList = await db.unidades?.toArray() || [];
  const currentUser = authService.getCurrentUser();
  const scheduledServices = (await db.manutencoes.toArray())
    .filter((item) => item.status === 'agendado' && item.dataAgendada && daysUntilDate(item.dataAgendada) <= 7)
    .filter((item) => !authService.isEmployee() || item.tecnicoId === currentUser?.id)
    .sort((a, b) => new Date(a.dataAgendada) - new Date(b.dataAgendada));
  
  const alerts = eqs
    .filter(e => e.proximaManutencao && daysUntilDate(e.proximaManutencao) <= 7)
    .sort((a, b) => new Date(a.proximaManutencao) - new Date(b.proximaManutencao));
  
  if (alerts.length === 0 && scheduledServices.length === 0) {
    modalBody.innerHTML = `
      <div style="padding:20px; text-align:center; opacity:0.5;">
        <span class="material-symbols-rounded" style="font-size:40px; display:block; margin-bottom:10px;">notifications_off</span>
        Nenhuma notificação no momento.
      </div>
    `;
    return;
  }
  
  let html = '<div style="display:flex; flex-direction:column; gap:10px;">';

  for (const service of scheduledServices) {
    const diff = daysUntilDate(service.dataAgendada);
    const c = service.clientId ? clsList.find((cliente) => cliente.id === service.clientId) : null;
    const e = service.equipamentoId ? eqs.find((equipamento) => equipamento.id === service.equipamentoId) : null;
    const tecnico = service.tecnicoId ? allUsers.find((u) => u.id === service.tecnicoId) : null;
    const color = diff <= 0 ? '#ff4d4d' : '#0ea5e9';
    const txt = diff < 0 ? `Agendado ha ${Math.abs(diff)} dias` :
      (diff === 0 ? 'Agendado para hoje' : `Agendado em ${diff} dias`);

    html += `
      <div ${canManage ? `onclick="window.renderCloseScheduledServiceForm(${service.id})"` : ''} style="background:rgba(255,255,255,0.05); padding:10px; border-left:3px solid ${color}; border-radius:8px; cursor:${canManage ? 'pointer' : 'default'};">
        <p style="margin:0; font-size:12px; font-weight:bold;">${c?.nome || 'Cliente'}</p>
        <p style="margin:2px 0 0 0; font-size:10px; opacity:0.7;">${service.tipoServico || 'Servico'} • ${e ? `${e.marca} - ${e.localizacao || 'Local nao informado'}` : 'Equipamento a definir'}</p>
        <p style="margin:5px 0 0 0; font-size:10px; color:${color}; font-weight:bold;">${txt} • ${formatDateTime(service.dataAgendada)}</p>
        ${tecnico ? `<p style="margin:4px 0 0 0; font-size:9px; color:#a78bfa; font-weight:700;">TECNICO: ${tecnico.name}</p>` : ''}
      </div>
    `;
  }
  
  for (const e of alerts) {
    const diff = daysUntilDate(e.proximaManutencao);
    const c = clsList.find(cl => cl.id === e.clienteId);
    const u = e.unidadeId && undList.length ? undList.find(un => un.id === e.unidadeId) : null;
    const name = u ? `${c?.nome} • ${u.apartamento}` : (c?.nome || 'Desconhecido');
    const color = diff <= 0 ? '#ff4d4d' : '#ff9d00';
    const txt = diff < 0 ? `Vencido há ${Math.abs(diff)} dias` : 
                (diff === 0 ? 'Vence hoje!' : `Vence em ${diff} dias`);
    
    html += `
      <div style="background:rgba(255,255,255,0.05); padding:10px; border-left:3px solid ${color}; border-radius:8px;">
        <p style="margin:0; font-size:12px; font-weight:bold;">${name}</p>
        <p style="margin:2px 0 0 0; font-size:10px; opacity:0.7;">${e.marca} • ${e.localizacao}</p>
        <p style="margin:5px 0 0 0; font-size:10px; color:${color}; font-weight:bold;">${txt}</p>
      </div>
    `;
  }
  
  modalBody.innerHTML = html + '</div>';
}

/**
 * Filtrar agenda
 */
export function setHomeFilter(filter) {
  currentHomeFilter = filter;
  const mainContent = document.getElementById('main-content');
  const headerContent = document.getElementById('header-content');
  renderDashboard(mainContent, headerContent);
}

export function setHomeView(view) {
  currentHomeView = view;
  const mainContent = document.getElementById('main-content');
  const headerContent = document.getElementById('header-content');
  renderDashboard(mainContent, headerContent);
}

export function changeCalendarMonth(direction) {
  calendarMonthOffset += direction;
  const mainContent = document.getElementById('main-content');
  const headerContent = document.getElementById('header-content');
  renderDashboard(mainContent, headerContent);
}

export function renderNewServicePrompt(clienteId, equipamentoId) {
  const shouldCloseCurrent = confirm('Deseja fechar o servico atual antes de agendar um novo servico?');
  if (shouldCloseCurrent) {
    window.renderClientServiceForm(clienteId, 'concluido', equipamentoId);
    return;
  }

  window.renderClientServiceForm(clienteId, 'agendado', equipamentoId);
}

export function renderNewServiceLaunch(clienteId, equipamentoId = null) {
  window.renderClientServiceForm(clienteId, 'agendado', equipamentoId);
}

export async function renderCalendarServicePicker(dateIso) {
  if (!authService.isAdmin()) {
    alert('Acesso limitado: funcionario apenas visualiza agenda e servicos.');
    return;
  }

  const clientes = await db.clientes.toArray();
  const equipamentos = await db.equipamentos.toArray();
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateIso)
    ? new Date(`${dateIso}T00:00:00`)
    : new Date(dateIso);
  selectedDate.setHours(0, 0, 0, 0);
  const selectedDateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateIso)
    ? dateIso
    : `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const selectedLabel = selectedDate.toLocaleDateString('pt-BR');

  openModal('Agendar Servico');
  modalBody.innerHTML = `
    <form id="f-calendar-service">
      <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:12px; margin-bottom:12px;">
        <label style="font-size:9px; opacity:0.65; font-weight:800;">DATA SELECIONADA</label>
        <p style="margin:5px 0 0 0; font-size:13px; font-weight:800;">${selectedLabel}</p>
      </div>
      <div class="form-group">
        <label>Pesquisar por nome</label>
        <input type="text" id="cal-search" class="form-control" placeholder="Digite o nome do cliente...">
      </div>
      <div class="form-group">
        <label>Cliente</label>
        <select id="cal-cliente" class="form-control" required>
          <option value="">Selecionar cliente...</option>
          ${clientes.map((cliente) => `<option value="${cliente.id}">${cliente.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Equipamento</label>
        <select id="cal-equipamento" class="form-control">
          <option value="">Servico geral do cliente</option>
        </select>
      </div>
      <button type="submit" class="btn-primary">CONTINUAR</button>
      <button type="button" id="cal-new-client" class="btn-primary" style="background:#22c55e; margin-top:10px;">
        CRIAR CLIENTE PARA ESTA DATA
      </button>
    </form>
  `;

  const searchInput = document.getElementById('cal-search');
  const clientSelect = document.getElementById('cal-cliente');
  const equipmentSelect = document.getElementById('cal-equipamento');
  const renderClientOptions = (term = '') => {
    const normalizedTerm = term.trim().toLowerCase();
    const filteredClients = clientes
      .filter((cliente) => !normalizedTerm || String(cliente.nome || '').toLowerCase().includes(normalizedTerm))
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));

    clientSelect.innerHTML = `
      <option value="">Selecionar cliente...</option>
      ${filteredClients.map((cliente) => `<option value="${cliente.id}">${cliente.nome}</option>`).join('')}
    `;
    equipmentSelect.innerHTML = '<option value="">Servico geral do cliente</option>';
  };

  clientSelect.onchange = () => {
    const clientId = Number(clientSelect.value);
    const clientEquipments = equipamentos.filter((equipamento) => equipamento.clienteId === clientId);
    equipmentSelect.innerHTML = `
      <option value="">Servico geral do cliente</option>
      ${clientEquipments.map((equipamento) => `<option value="${equipamento.id}">${equipamento.marca} - ${equipamento.btu} BTU - ${equipamento.localizacao || 'Local nao informado'}</option>`).join('')}
    `;
  };
  searchInput.oninput = (event) => renderClientOptions(event.target.value);

  document.getElementById('f-calendar-service').onsubmit = (event) => {
    event.preventDefault();
    const clientId = Number(clientSelect.value);
    const equipmentId = Number(equipmentSelect.value) || null;
    if (!clientId) return;
    window.renderClientServiceForm(clientId, 'agendado', equipmentId, selectedDateKey, true);
  };

  document.getElementById('cal-new-client').onclick = () => {
    window.renderFullPropertyForm(null, selectedDateKey);
  };
}

/**
 * Renderizar formulário de manutenção
 */
export async function renderMaintenanceForm(eqId, defaultType = '') {
  const eqs = await db.equipamentos.toArray();
  const cls = await db.clientes.toArray();
  
  openModal(defaultType || 'Registrar Serviço');
  
  modalBody.innerHTML = `
    <form id="f-m">
      <div class="form-group">
        <label>Aparelho</label>
        <select id="m-eq" class="form-control">
          ${eqs.map(e => `
            <option value="${e.id}" ${eqId == e.id ? 'selected' : ''}>
              ${cls.find(c => c.id === e.clienteId)?.nome || 'S/N'} - ${e.marca}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>O que foi feito?</label>
        <textarea id="m-d" class="form-control" rows="3" required>
${defaultType ? defaultType + ': ' : ''}        </textarea>
      </div>
      <div style="display:flex; gap:10px;">
        <div class="form-group" style="flex:1;">
          <label>Valor Cobrado (R$)</label>
          <input type="number" step="0.01" id="m-v" class="form-control" required placeholder="Ex: 150.00">
        </div>
        <div class="form-group" style="flex:1;">
          <label>Pagamento</label>
          <select id="m-p" class="form-control">
            ${CONSTANTS.PAYMENT_METHODS.map(method => 
              `<option value="${method}">${method}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Próxima Visita</label>
        <input type="datetime-local" id="m-nx" class="form-control" required 
               value="${new Date(Date.now() + 15552000000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}">
      </div>
      <div class="form-group">
        <label>Tirar Foto / Anexar (Opcional)</label>
        <input type="file" id="m-ft" class="form-control" accept="image/*" 
               capture="environment" style="padding: 8px;">
      </div>
      <button type="submit" class="btn-primary">FINALIZAR SERVIÇO</button>
    </form>
  `;
  
  document.getElementById('f-m').onsubmit = async (ev) => {
    ev.preventDefault();
    const fId = Number(document.getElementById('m-eq').value);
    const nxD = new Date(document.getElementById('m-nx').value);
    const ftInput = document.getElementById('m-ft');
    const fotoBase64 = ftInput.files.length > 0 ? 
      await fileToBase64(ftInput.files[0]) : null;
    
    await db.manutencoes.add({
      equipamentoId: fId,
      clientId: eqs.find((equipamento) => equipamento.id === fId)?.clienteId || null,
      dataRealizada: new Date(),
      tipoServico: defaultType || 'Servico',
      descricao: document.getElementById('m-d').value,
      proximaData: nxD,
      valor: Number(document.getElementById('m-v').value),
      formaPagamento: document.getElementById('m-p').value,
      foto: fotoBase64
    });
    
    await db.equipamentos.update(fId, {
      ultimaManutencao: new Date(),
      proximaManutencao: nxD
    });
    
    const mainContent = document.getElementById('main-content');
    const headerContent = document.getElementById('header-content');
    renderDashboard(mainContent, headerContent);
  };
}

/**
 * Mostrar relatório financeiro
 */
export async function showFinancialReport(offset = 0) {
  openModal('Relatório Financeiro');
  
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + offset);
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();
  const monthName = targetDate.toLocaleString('pt-BR', { 
    month: 'long', 
    year: 'numeric' 
  }).toUpperCase();
  
  const revenue = await calculateMonthlyRevenue(targetMonth, targetYear);
  
  modalBody.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:rgba(255,255,255,0.05); border-radius:12px; padding:5px;">
      <button class="icon-btn" onclick="window.showFinancialReport(${offset - 1})" style="width:36px; height:36px;">
        <span class="material-symbols-rounded">chevron_left</span>
      </button>
      <span style="font-size:12px; font-weight:800;">${monthName}</span>
      <button class="icon-btn" onclick="window.showFinancialReport(${offset + 1})" style="width:36px; height:36px;">
        <span class="material-symbols-rounded">chevron_right</span>
      </button>
    </div>
    <div style="display:flex; flex-direction:column; gap:15px; padding:5px;">
      <div class="card" style="margin:0; background:rgba(34, 197, 94, 0.05); border:1px solid #22c55e;">
        <h3 style="margin:0; font-size:11px; color:#22c55e;">RECEBIDO (MÊS)</h3>
        <p style="margin:5px 0 0 0; font-size:28px; font-weight:800;">R$ ${revenue.recebido.toFixed(2)}</p>
      </div>
      <div class="card" style="margin:0; background:rgba(255, 157, 0, 0.05); border:1px solid #ff9d00;">
        <h3 style="margin:0; font-size:11px; color:#ff9d00;">A RECEBER (PRAZO 30 DIAS)</h3>
        <p style="margin:5px 0 0 0; font-size:28px; font-weight:800;">R$ ${revenue.pendente.toFixed(2)}</p>
      </div>
      <div class="card" style="margin:0; background:rgba(255, 255, 255, 0.02);">
        <h3 style="margin:0; font-size:11px; opacity:0.7;">BRUTO DO MÊS</h3>
        <p style="margin:5px 0 0 0; font-size:20px; font-weight:800;">R$ ${revenue.totalBruto.toFixed(2)}</p>
      </div>
    </div>
  `;
}

export default {
  renderDashboard,
  showNotifications,
  setHomeFilter,
  renderMaintenanceForm,
  showFinancialReport
};
