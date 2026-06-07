/**
 * ENTRY POINT - Aplicação principal
 * Orquestra todos os módulos e gerencia a navegação
 */

import { db } from './services/db.js';
import { initializeUIElements, openModal, closeModal, CONSTANTS } from './services/ui.js';
import { syncService } from './services/sync.js';
import { authService } from './services/auth.js';

// Importar módulos
import { renderDashboard, showNotifications, setHomeFilter, renderMaintenanceForm, showFinancialReport, renderNewServicePrompt, renderNewServiceLaunch } from './modules/agenda/index.js';
import { renderBairros, renderBairroDetail, renderClientDetail, renderBairroForm, renderFullPropertyForm, renderContactsImportForm, renderClientServiceForm, renderCloseScheduledServiceForm, renderEquipmentForm } from './modules/clientes/index.js';
import { renderHistorico, gerarPDF, renderEquipmentHistory } from './modules/historico/index.js';
import { renderMais, renderTechnicianForm, exportarDados, restaurarDados, limparTodosDados, renderEditProfileForm, renderChangePasswordForm } from './modules/configuracoes/index.js';
import { renderOrcamentos } from './modules/orcamentos/index.js';
import { renderMateriais } from './modules/materiais/index.js';
import { renderComunicacao } from './modules/comunicacao/index.js';
import { renderRelatorios, gerarRelatorioMensal } from './modules/relatorios/index.js';

// ============================================
// ELEMENTOS DO DOM
// ============================================

const mainContent = document.getElementById('main-content');
const headerContent = document.getElementById('header-content');
const navItems = document.querySelectorAll('.nav-item');
const splashScreen = document.getElementById('splash-screen');
const appContainer = document.querySelector('.app-container');

// ============================================
// INICIALIZAÇÃO
// ============================================

async function init() {
  try {
    // Inicializar UI
    initializeUIElements();
    exposeAuthFunctions();
    if (!authService.isAuthenticated()) {
      renderAuthScreen();
      hideSplash();
      return;
    }

    // Configurar sincronização
    syncService.start();
    
    // Setup de navegação
    setupNavigation();
    updateNavigationAccess();
    await updateMessagesBadge();
    
    // Renderizar dashboard inicial
    renderDashboard(mainContent, headerContent);
    
    // Animar splash screen
    setTimeout(hideSplash, 1500);
    
    // Expor funções globais para onclick
    exposeGlobalFunctions();
    
  } catch (error) {
    console.error('Erro na inicialização:', error);
    hideSplash();
  }
}

function hideSplash() {
  if (splashScreen) {
    splashScreen.style.opacity = '0';
    splashScreen.style.pointerEvents = 'none';
  }
}

function setAppVisible(isVisible) {
  if (appContainer) appContainer.style.display = isVisible ? '' : 'none';
}

function renderAuthScreen(mode = 'login') {
  setAppVisible(false);
  const hasUsers = authService.hasUsers();
  const screenMode = mode === 'cadastro' ? 'cadastro' : 'login';

  let authRoot = document.getElementById('auth-screen');
  if (!authRoot) {
    authRoot = document.createElement('div');
    authRoot.id = 'auth-screen';
    document.body.appendChild(authRoot);
  }

  const isCadastro = screenMode === 'cadastro';
  const appName = authService.getTechnicianData().appName;

  authRoot.innerHTML = `
    <div class="auth-shell">
      <div class="auth-panel animate-in">
        <div class="auth-brand">
          <img src="logo-quadrada.svg" alt="Arcon" class="auth-logo-icon">
          <div>
            <h1>${appName}</h1>
            <p>${isCadastro ? 'Cadastro de acesso' : 'Acesso ao sistema'}</p>
          </div>
        </div>

        <form id="auth-form">
          ${isCadastro ? `
            <div style="background:rgba(255,255,255,0.04); border-radius:10px; padding:12px; margin:18px 0;">
              <p style="font-size:11px; opacity:0.72; margin:0; line-height:1.5;">Cadastro exclusivo para administradores. Técnicos são cadastrados apenas dentro do painel administrativo da empresa.</p>
            </div>
            <div class="form-group">
              <label>Modelo de trabalho</label>
              <select id="auth-business-mode" class="form-control">
                <option value="autonomo">Sou autônomo</option>
                <option value="empresa">Trabalho com mais técnicos</option>
              </select>
            </div>
            <div class="form-group">
              <label>Nome</label>
              <input type="text" id="auth-name" class="form-control" required placeholder="Nome do usuário">
            </div>

            <div style="background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.25); border-radius:10px; padding:11px; margin-bottom:14px;">
              <p id="auth-mode-help" style="font-size:10px; opacity:0.78; margin:0; line-height:1.5;">Como autônomo, este administrador terá acesso completo ao sistema.</p>
            </div>
          ` : ''}
          <div class="form-group">
            <label>Login</label>
            <input type="text" id="auth-login" class="form-control" required placeholder="usuário ou email">
          </div>
          <div class="form-group">
            <label>Senha</label>
            <input type="password" id="auth-password" class="form-control" required placeholder="Digite sua senha">
          </div>
          <button type="submit" class="btn-primary">${isCadastro ? 'CRIAR ACESSO' : 'ENTRAR'}</button>
        </form>
        <button type="button" class="btn-primary" onclick="window.renderAuthScreen('${isCadastro ? 'login' : 'cadastro'}')" style="background:transparent; color:var(--primary); border:1px solid rgba(0,242,255,0.35); margin-top:14px;">
          ${isCadastro ? 'VOLTAR PARA LOGIN' : 'CRIAR CADASTRO'}
        </button>
      </div>
    </div>
  `;

  document.getElementById('auth-form').onsubmit = async (event) => {
    event.preventDefault();
    try {
      if (isCadastro) {
        authService.register({
          name: document.getElementById('auth-name').value,
          login: document.getElementById('auth-login').value,
          password: document.getElementById('auth-password').value,
          appName: 'Arcon',
          businessMode: document.getElementById('auth-business-mode')?.value
        });
      } else {
        authService.login(
          document.getElementById('auth-login').value,
          document.getElementById('auth-password').value
        );
      }

      authRoot.remove();
      setAppVisible(true);
      await bootAuthenticatedApp();
    } catch (error) {
      alert(error.message);
    }
  };

  const businessModeSelect = document.getElementById('auth-business-mode');
  if (businessModeSelect) {
    businessModeSelect.onchange = () => {
      const help = document.getElementById('auth-mode-help');
      help.textContent = businessModeSelect.value === 'empresa'
        ? 'Como empresa, este administrador poderá cadastrar técnicos com acesso limitado.'
        : 'Como autônomo, este administrador terá acesso completo ao sistema.';
    };
  }
}

async function bootAuthenticatedApp() {
  syncService.watchConnection();
  setupNavigation();
  updateNavigationAccess();
  await updateMessagesBadge();
  await renderDashboard(mainContent, headerContent);
  exposeGlobalFunctions();
}

function exposeAuthFunctions() {
  window.renderAuthScreen = renderAuthScreen;
  window.logoutApp = () => {
    authService.logout();
    closeModal();
    renderAuthScreen('login');
  };
}

// ============================================
// NAVEGAÇÃO
// ============================================

function setupNavigation() {
  navItems.forEach(item => {
    item.onclick = async () => {
      const view = item.dataset.view;
      if (authService.isEmployee() && !['home', 'os'].includes(view)) {
        navItems.forEach(n => n.classList.remove('active'));
        document.querySelector('.nav-item[data-view="home"]')?.classList.add('active');
        await renderDashboard(mainContent, headerContent);
        return;
      }

      // Atualizar UI
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      
      // Renderizar view
      switch (view) {
        case 'home':
          renderDashboard(mainContent, headerContent);
          break;
        case 'bairros':
          renderBairros(mainContent, headerContent);
          break;
        case 'os':
          renderHistorico(mainContent, headerContent);
          break;
        case 'orcamentos':
          renderOrcamentos(mainContent, headerContent);
          break;
        case 'materiais':
          renderMateriais(mainContent, headerContent);
          break;
        case 'comunicacao':
          renderComunicacao(mainContent, headerContent);
          break;
        case 'relatorios':
          renderRelatorios(mainContent, headerContent);
          break;
        case 'mais':
          renderMais(mainContent, headerContent);
          break;
      }

      await updateMessagesBadge();
    };
  });
}

function updateNavigationAccess() {
  navItems.forEach((item) => {
    const view = item.dataset.view;
    item.style.display = authService.isEmployee() && !['home', 'os'].includes(view) ? 'none' : '';
  });
}

function daysUntil(value) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

async function hasPendingMessages() {
  const equipamentos = await db.equipamentos.toArray();
  const manutencoes = await db.manutencoes.toArray();
  const hasOverdueMaintenance = equipamentos.some((equipamento) =>
    equipamento.proximaManutencao
      && daysUntil(equipamento.proximaManutencao) < 0
      && localStorage.getItem(`msg_done_vencida-${equipamento.id}`) !== '1'
  );
  const hasScheduledConfirmation = manutencoes.some((item) =>
    item.status === 'agendado'
      && item.dataAgendada
      && localStorage.getItem(`msg_done_agendada-${item.id}`) !== '1'
  );

  return hasOverdueMaintenance || hasScheduledConfirmation;
}

async function updateMessagesBadge() {
  const messagesNav = document.querySelector('.nav-item[data-view="comunicacao"]');
  if (!messagesNav) return;
  messagesNav.classList.toggle('has-pending', await hasPendingMessages());
}

// ============================================
// FUNÇÕES GLOBAIS (para onclick)
// ============================================

function exposeGlobalFunctions() {
  // Agenda
  const employeeBlocked = () => alert('Acesso limitado: funcionário apenas visualiza agenda e serviços.');
  window.renderMaintenanceForm = authService.isEmployee() ? employeeBlocked : renderMaintenanceForm;
  window.renderEquipmentHistory = renderEquipmentHistory;
  window.showNotifications = showNotifications;
  window.setHomeFilter = setHomeFilter;
  window.showFinancialReport = authService.isEmployee() ? employeeBlocked : showFinancialReport;
  window.renderNewServicePrompt = authService.isEmployee() ? employeeBlocked : renderNewServicePrompt;
  window.renderNewServiceLaunch = authService.isEmployee() ? employeeBlocked : renderNewServiceLaunch;
  window.gerarPDF = gerarPDF;
  
  // Clientes
  window.renderBairroForm = authService.isEmployee() ? employeeBlocked : renderBairroForm;
  window.renderFullPropertyForm = authService.isEmployee() ? employeeBlocked : renderFullPropertyForm;
  window.renderBairroDetail = authService.isEmployee() ? employeeBlocked : renderBairroDetail;
  window.renderClientDetail = authService.isEmployee() ? employeeBlocked : renderClientDetail;
  window.renderContactsImportForm = authService.isEmployee() ? employeeBlocked : renderContactsImportForm;
  window.renderClientServiceForm = authService.isEmployee() ? employeeBlocked : renderClientServiceForm;
  window.renderCloseScheduledServiceForm = authService.isEmployee() ? employeeBlocked : renderCloseScheduledServiceForm;
  window.renderEquipmentForm = authService.isEmployee() ? employeeBlocked : renderEquipmentForm;
  
  // Configurações
  window.renderTechnicianForm = renderTechnicianForm;
  window.exportarDados = exportarDados;
  window.restaurarDados = restaurarDados;
  window.limparTodosDados = limparTodosDados;
  window.renderEditProfileForm = renderEditProfileForm;
  window.renderChangePasswordForm = renderChangePasswordForm;
  
  // Deletar item genérico
  window.deleteItem = deleteItem;
  window.renderComunicacaoPage = () => {
    renderComunicacao(mainContent, headerContent);
  };
  
  // Render dashboard para busca
  window.renderDashboard = (searchTerm) => {
    renderDashboard(mainContent, headerContent, searchTerm);
  };
}

/**
 * Deletar item genérico (bairro, cliente, equipamento, etc)
 */
async function deleteItem(type, id) {
  if (authService.isEmployee()) {
    alert('Acesso limitado: funcionário apenas visualiza agenda e serviços.');
    return;
  }

  const confirmDelete = confirm(`Tem certeza que deseja excluir este ${type}?`);
  if (!confirmDelete) return;
  
  try {
    switch (type) {
      case 'bairro':
        await db.bairros.delete(id);
        break;
      case 'cliente':
        await db.clientes.delete(id);
        break;
      case 'equipamento':
        await db.equipamentos.delete(id);
        break;
      case 'unidade':
        await db.unidades.delete(id);
        break;
      case 'manutencao':
        await db.manutencoes.delete(id);
        break;
    }
    location.reload();
  } catch (error) {
    console.error('Erro ao deletar:', error);
    alert('Erro ao deletar item');
  }
}

// ============================================
// INICIAR APLICAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', init);

export { init, setupNavigation };
