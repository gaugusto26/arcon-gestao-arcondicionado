/**
 * Módulo MATERIAIS - Gestão de peças e materiais
 * Feature placeholder para versão futura
 */

import { db } from '../../services/db.js';

export async function renderMateriais(mainContent, headerContent) {
  headerContent.innerHTML = '<h2 style="font-size: 20px; font-weight: 800; margin:0;">MATERIAIS</h2>';
  
  mainContent.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; height:60vh; flex-direction:column; gap:20px; padding:20px;">
      <span class="material-symbols-rounded" style="font-size:60px; opacity:0.3;">precision_manufacturing</span>
      <h3 style="font-size:18px; margin:0;">Em Desenvolvimento</h3>
      <p style="text-align:center; opacity:0.6; max-width:300px;">
        Módulo de controle de materiais e peças está sendo desenvolvido. Retorne em breve!
      </p>
    </div>
  `;
}

export default {
  renderMateriais
};
