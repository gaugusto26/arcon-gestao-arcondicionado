/**
 * Módulo RELATÓRIOS - Gestão de relatórios e analytics
 * Feature placeholder para versão futura
 */

import { db, calculateMonthlyRevenue, getMaintenanceByPeriod } from '../../services/db.js';
import { pdfService } from '../../services/pdf.js';
import { authService } from '../../services/auth.js';

export async function renderRelatorios(mainContent, headerContent) {
  headerContent.innerHTML = '<h2 style="font-size: 20px; font-weight: 800; margin:0;">RELATÓRIOS</h2>';
  
  mainContent.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; height:60vh; flex-direction:column; gap:20px; padding:20px;">
      <span class="material-symbols-rounded" style="font-size:60px; opacity:0.3;">analytics</span>
      <h3 style="font-size:18px; margin:0;">Em Desenvolvimento</h3>
      <p style="text-align:center; opacity:0.6; max-width:300px;">
        Módulo de relatórios e analytics está sendo desenvolvido. Retorne em breve!
      </p>
    </div>
  `;
}

/**
 * Gerar relatório mensal em PDF
 */
export async function gerarRelatorioMensal(mes, ano) {
  try {
    const revenue = await calculateMonthlyRevenue(mes, ano);
    const monthName = new Date(ano, mes).toLocaleString('pt-BR', { 
      month: 'long', 
      year: 'numeric' 
    });
    
    const manutencoes = await getMaintenanceByPeriod(
      new Date(ano, mes, 1),
      new Date(ano, mes + 1, 0)
    );
    
    const tech = authService.getTechnicianData();
    
    const items = await Promise.all(
      manutencoes.map(async (m) => {
        const eq = await db.equipamentos.get(m.equipamentoId);
        const cli = await db.clientes.get(eq.clienteId);
        return {
          ...m,
          clientName: cli.nome,
          equipmentBrand: eq.marca,
          tipo: m.descricao.includes('Corretiva') ? 'CORRETIVA' : 'PREVENTIVA'
        };
      })
    );
    
    const monthData = {
      month: monthName,
      ...revenue,
      items
    };
    
    await pdfService.generateMonthlyReport(monthData, tech);
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    alert('Erro ao gerar relatório');
  }
}

export default {
  renderRelatorios,
  gerarRelatorioMensal
};
