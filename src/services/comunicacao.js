export const comunicacaoService = {
  sendWhatsAppReceipt(phoneNumber, receiptData = {}) {
    const phone = String(phoneNumber || '').replace(/\D/g, '');
    const text = encodeURIComponent(receiptData.message || 'Recibo de servico');
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  },

  sendSchedulingMessage(phoneNumber, equipmentInfo = {}) {
    const phone = String(phoneNumber || '').replace(/\D/g, '');
    const text = encodeURIComponent(`Ola! Podemos agendar a manutencao do ar-condicionado ${equipmentInfo.marca || ''}?`);
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  }
};
