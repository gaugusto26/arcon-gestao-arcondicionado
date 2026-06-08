export const pdfService = {
  async generateReceipt(maintenance, equipment, client, unit, tech) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Recibo - ${client?.nome || 'Cliente'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; color: #22c55e; }
            .info-group { margin-bottom: 15px; }
            .info-group label { font-weight: bold; font-size: 12px; color: #666; text-transform: uppercase; }
            .info-group p { margin: 5px 0 0 0; font-size: 16px; }
            .value-box { background: #f9f9f9; padding: 20px; border-radius: 10px; text-align: center; margin-top: 30px; }
            .value-box h3 { margin: 0; font-size: 14px; color: #666; }
            .value-box p { margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #22c55e; }
            .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #999; }
            .service-photo { max-width: 100%; max-height: 400px; margin-top: 20px; border-radius: 8px; border: 1px solid #ddd; padding: 5px; }
          </style>
        </head>
        <body>
          <div class="header"><div class="title">${tech?.appName || 'AR JAMPA'}</div><div>Recibo de Prestação de Serviço</div></div>
          <div class="info-group"><label>Cliente</label><p>${client?.nome || 'N/A'} ${unit ? ` - ${unit.apartamento} (${unit.proprietario})` : ''}</p></div>
          <div class="info-group"><label>Endereço</label><p>${client?.endereco || 'N/A'}</p></div>
          <div class="info-group"><label>Equipamento</label><p>${equipment ? `${equipment.marca} - ${equipment.btu} BTU - ${equipment.localizacao}` : 'N/A'}</p></div>
          <div class="info-group"><label>Data</label><p>${new Date(maintenance.dataRealizada).toLocaleDateString('pt-BR')}</p></div>
          <div class="info-group"><label>Serviço</label><p>${maintenance.descricao || ''}</p></div>
          ${maintenance.foto ? `<div class="info-group"><label>Foto</label><br><img src="${maintenance.foto}" class="service-photo"></div>` : ''}
          <div class="value-box"><h3>VALOR TOTAL (${maintenance.formaPagamento || '-'})</h3><p>R$ ${Number(maintenance.valor || 0).toFixed(2)}</p></div>
          <div class="footer"><p>Serviço realizado por <strong>${tech?.name || 'Técnico'}</strong></p><p>Este documento é um recibo não fiscal.</p></div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  },

  async generateMonthlyReport(monthData, tech) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head><title>Relatorio ${monthData.month}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1>${tech?.appName || 'AR JAMPA'}</h1>
          <h2>Relatório mensal - ${monthData.month}</h2>
          <p><strong>Recebido:</strong> R$ ${Number(monthData.recebido || 0).toFixed(2)}</p>
          <p><strong>A receber:</strong> R$ ${Number(monthData.pendente || 0).toFixed(2)}</p>
          <p><strong>Total bruto:</strong> R$ ${Number(monthData.totalBruto || 0).toFixed(2)}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }
};
