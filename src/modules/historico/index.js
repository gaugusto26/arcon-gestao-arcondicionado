/**
 * Módulo HISTÓRICO - Gestão de histórico de manutenções
 * Responsável pela exibição e gerenciamento do histórico de serviços realizados
 */

import { db } from '../../services/db.js';
import { pdfService } from '../../services/pdf.js';
import { comunicacaoService } from '../../services/comunicacao.js';
import { authService } from '../../services/auth.js';

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

/**
 * Renderizar histórico de manutenções
 */
export async function renderHistorico(mainContent, headerContent) {
  headerContent.innerHTML = '<h2 style="font-size: 20px; font-weight: 800; margin:0;">HISTÓRICO</h2>';
  const canManage = authService.isAdmin();
  
  const os = await db.manutencoes.reverse().toArray();
  
  let html = '<div class="animate-in" style="display: flex; flex-direction: column; gap: 15px; padding: 0 20px;">';
  
  if (os.length === 0) {
    html += '<p style="text-align:center; opacity:0.3; padding:40px;">Sem registros.</p>';
  } else {
    for (const m of os) {
      const e = m.equipamentoId ? await db.equipamentos.get(m.equipamentoId) : null;
      const c = m.clientId ? await db.clientes.get(m.clientId) : (e ? await db.clientes.get(e.clienteId) : null);
      const serviceType = m.tipoServico || (m.descricao && m.descricao.includes('Corretiva') ? 'CORRETIVA' : 'PREVENTIVA');
      const isCor = serviceType.toLowerCase().includes('corretiva');
      const tel = c?.whatsapp || '';
      
      let btnRecibo = canManage ? `
        <button onclick="window.gerarPDF(${m.id})" class="btn-primary" 
                style="background:#ff3b30; color:white; padding:6px 12px; font-size:9px; 
                       margin:0; width:auto; border-radius:8px; display:flex; align-items:center; 
                       gap:4px; margin-right:8px;">
          <span class="material-symbols-rounded" style="font-size:12px;">picture_as_pdf</span> GERAR PDF
        </button>
      ` : '';
      
      if (tel && canManage) {
        const msg = encodeURIComponent(
          `*RECIBO DE SERVIÇO*\n\n` +
          `*Cliente:* ${c?.nome}\n` +
          `*Aparelho:* ${e ? `${e.marca} - ${e.localizacao}` : 'Serviço geral do cliente'}\n` +
          `*Data:* ${formatDateTime(m.dataRealizada || m.dataAgendada)}\n` +
          `*Serviço:* ${m.descricao}\n` +
          `*Valor:* R$ ${Number(m.valor || 0).toFixed(2)} (${m.formaPagamento || 'N/A'})\n\n` +
          `Obrigado pela preferência!`
        );
        btnRecibo += `
          <a href="https://wa.me/${tel.replace(/\D/g, '')}?text=${msg}" target="_blank" 
             class="btn-primary" 
             style="background:#25D366; color:white; padding:6px 12px; font-size:9px; 
                    margin:0; width:auto; border-radius:8px; display:flex; align-items:center; 
                    gap:4px;">
            <span class="material-symbols-rounded" style="font-size:12px;">receipt_long</span> ENVIAR RECIBO
          </a>
        `;
      }
      
      const imgHtml = m.foto ? 
        `<img src="${m.foto}" style="width:100%; max-height:150px; object-fit:cover; border-radius:8px; margin-top:12px; border: 1px solid rgba(255,255,255,0.1);">` 
        : '';
      
      html += `
        <div class="card" style="border-left: 5px solid ${isCor ? '#ff9d00' : '#22c55e'}; margin:0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 8px; font-weight: 900; padding: 4px 10px; border-radius: 40px; 
                         background: rgba(255,255,255,0.05); color: ${isCor ? '#ff9d00' : '#22c55e'}; 
                         border: 1px solid ${isCor ? '#ff9d00' : '#22c55e'}; text-transform:uppercase;">
              ${m.tipoServico ? m.tipoServico.toUpperCase() : (isCor ? 'CORRETIVA' : 'PREVENTIVA')}
            </span>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size: 10px; opacity: 0.5; font-weight:700;">
                ${formatDateTime(m.dataRealizada || m.dataAgendada)}
              </span>
              ${canManage ? `<button class="icon-btn" style="border:none; padding:0; width:auto; height:auto;" 
                      onclick="window.deleteItem('manutencao', ${m.id})">
                <span class="material-symbols-rounded" style="font-size:16px; color:#ff4d4d;">delete</span>
              </button>` : ''}
            </div>
          </div>
          
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h4 style="margin:0; font-size:16px;">${c?.nome || 'Cliente removido'}</h4>
            ${m.valor ? `
              <span style="font-size:12px; font-weight:800; color:#22c55e;">
                R$ ${Number(m.valor).toFixed(2)} 
                <span style="font-size:8px; opacity:0.6;">(${m.formaPagamento})</span>
              </span>
            ` : ''}
          </div>
          
          <p style="font-size: 13px; font-style: italic; background:rgba(0,0,0,0.3); padding:15px; 
                    border-radius:15px; margin-top:12px; line-height:1.5; color:#eee;">
            ${m.descricao}
          </p>
          ${e ? `<p style="font-size:10px; opacity:0.55; margin-top:-6px;">${e.marca} • ${e.localizacao || 'Local não informado'}</p>` : '<p style="font-size:10px; opacity:0.55; margin-top:-6px;">Serviço geral do cliente</p>'}
          
          ${imgHtml}
          
          ${canManage ? `<div style="display:flex; justify-content:flex-end; margin-top:12px; gap:8px; flex-wrap:wrap;">
            ${btnRecibo}
          </div>` : ''}
        </div>
      `;
    }
  }
  
  mainContent.innerHTML = html + '</div>';
}

/**
 * Gerar e imprimir recibo em PDF
 */
export async function gerarPDF(manutencaoId) {
  const m = await db.manutencoes.get(manutencaoId);
  const e = m.equipamentoId ? await db.equipamentos.get(m.equipamentoId) : null;
  const c = m.clientId ? await db.clientes.get(m.clientId) : (e ? await db.clientes.get(e.clienteId) : null);
  const u = e?.unidadeId ? await db.unidades?.get(e.unidadeId) : null;
  const tech = authService.getTechnicianData();
  
  await pdfService.generateReceipt(m, e, c, u, tech);
}

/**
 * Renderizar histórico de um equipamento
 */
export async function renderEquipmentHistory(equipamentoId) {
  const equipamento = await db.equipamentos.get(equipamentoId);
  const cliente = await db.clientes.get(equipamento.clienteId);
  const manutencoes = await db.manutencoes.where('equipamentoId').equals(equipamentoId).toArray();
  
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  
  if (modalTitle) modalTitle.textContent = `${equipamento.marca} - ${equipamento.localizacao}`;
  if (modalOverlay) modalOverlay.classList.add('active');
  
  let html = `
    <div style="margin-bottom:15px; background:rgba(255,255,255,0.05); padding:12px; border-radius:8px;">
      <p style="margin:0; font-size:11px; opacity:0.6;">CLIENTE</p>
      <p style="margin:4px 0 0 0; font-size:13px; font-weight:700;">${cliente.nome}</p>
    </div>
    
    <div style="margin-bottom:15px; background:rgba(255,255,255,0.05); padding:12px; border-radius:8px;">
      <p style="margin:0; font-size:11px; opacity:0.6;">EQUIPAMENTO</p>
      <p style="margin:4px 0 0 0; font-size:12px; font-weight:700;">
        ${equipamento.marca} - ${equipamento.btu} BTU
      </p>
      <p style="margin:4px 0 0 0; font-size:10px; opacity:0.6;">
        Localização: ${equipamento.localizacao}
      </p>
    </div>
    
    <div style="margin-bottom:15px; display:flex; gap:10px;">
      <div style="flex:1; background:rgba(255,255,255,0.05); padding:12px; border-radius:8px;">
        <p style="margin:0; font-size:9px; opacity:0.6;">ÚLTIMA MANUTENÇÃO</p>
        <p style="margin:4px 0 0 0; font-size:11px; font-weight:700;">
          ${equipamento.ultimaManutencao ? formatDateTime(equipamento.ultimaManutencao) : '---'}
        </p>
      </div>
      <div style="flex:1; background:rgba(255,255,255,0.05); padding:12px; border-radius:8px;">
        <p style="margin:0; font-size:9px; opacity:0.6;">PRÓXIMA MANUTENÇÃO</p>
        <p style="margin:4px 0 0 0; font-size:11px; font-weight:700; color:var(--primary);">
          ${equipamento.proximaManutencao ? formatDateTime(equipamento.proximaManutencao) : '---'}
        </p>
      </div>
    </div>
    
    <hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:15px 0;">
    
    <h4 style="font-size:11px; font-weight:800; margin:15px 0 10px 0;">HISTÓRICO DE MANUTENÇÕES</h4>
    
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${manutencoes.length > 0 ? manutencoes.map(m => `
        <div style="background:rgba(0,0,0,0.2); padding:10px; border-left:3px solid ${m.descricao.includes('Corretiva') ? '#ff9d00' : '#22c55e'}; border-radius:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            <span style="font-size:9px; font-weight:700;">
              ${formatDateTime(m.dataRealizada || m.dataAgendada)}
            </span>
            <span style="font-size:8px; font-weight:700; color:${m.descricao.includes('Corretiva') ? '#ff9d00' : '#22c55e'};">
              ${m.descricao.includes('Corretiva') ? 'CORRETIVA' : 'PREVENTIVA'}
            </span>
          </div>
          <p style="margin:4px 0; font-size:10px; opacity:0.8;">${m.descricao.substring(0, 50)}...</p>
          ${m.valor ? `<p style="margin:4px 0 0 0; font-size:10px; font-weight:700; color:#22c55e;">R$ ${Number(m.valor).toFixed(2)}</p>` : ''}
        </div>
      `).join('') : '<p style="font-size:10px; opacity:0.5;">Nenhuma manutenção registrada</p>'}
    </div>
  `;
  
  if (modalBody) modalBody.innerHTML = html;
}

export default {
  renderHistorico,
  gerarPDF,
  renderEquipmentHistory
};
