// Sync service – com Supabase o dado já é persistido em tempo real.
// Este módulo mantém apenas utilitários de conectividade para compatibilidade.

export const syncService = {
  isOnline() {
    return navigator.onLine;
  },

  async sync() {
    return null;
  },

  start() {},

  watchConnection() {},
};
