/**
 * Módulo ORÇAMENTOS - Gestão de orçamentos e propostas
 * Feature placeholder para versão futura
 */

import { db } from '../../services/db.js';
import { openModal, modalBody } from '../../services/ui.js';

export async function renderOrcamentos(mainContent, headerContent) {
  headerContent.innerHTML = '<h2 style="font-size: 20px; font-weight: 800; margin:0;">ORÇAMENTOS</h2>';
  
  mainContent.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; height:60vh; flex-direction:column; gap:20px; padding:20px;">
      <span class="material-symbols-rounded" style="font-size:60px; opacity:0.3;">build_circle</span>
      <h3 style="font-size:18px; margin:0;">Em Desenvolvimento</h3>
      <p style="text-align:center; opacity:0.6; max-width:300px;">
        Módulo de gestão de orçamentos está sendo desenvolvido. Retorne em breve!
      </p>
    </div>
  `;
}

export default {
  renderOrcamentos
};
