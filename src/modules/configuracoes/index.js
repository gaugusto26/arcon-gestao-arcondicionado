/**
 * Modulo CONFIGURACOES - backup, restauracao e sessao do usuario
 */

import { db, exportDatabase, importDatabase } from '../../services/db.js';
import { authService } from '../../services/auth.js';
import { openModal, closeModal, modalBody, getAvatarUrl } from '../../services/ui.js';

async function resizePhoto(file, maxPx = 200, quality = 0.75) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = url;
  });
}

/**
 * Renderizar página de configurações
 */
export async function renderMais(mainContent, headerContent) {
  const tech = authService.getTechnicianData();
  const isAdmin = authService.isAdmin();
  const isCompany = authService.getBusinessMode() === 'empresa';
  const users = authService.getUsers();
  const technicians = users.filter((user) => user.role === 'tecnico');
  const notifEnabled = authService.getNotificationsEnabled();
  const plan = authService.getPlan();
  const isPremium = plan === 'premium';

  headerContent.innerHTML = '<h2 style="font-size: 20px; font-weight: 800; margin:0;">AJUSTES</h2>';

  mainContent.innerHTML = `
    <div class="animate-in" style="display:flex; flex-direction:column; gap:20px; padding:0 20px;">

      <!-- PERFIL -->
      <div class="card" style="margin:0;">
        <h4 style="font-size:12px; font-weight:800; margin:0 0 15px 0; color:var(--primary);">PERFIL</h4>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:12px;">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="position:relative; width:64px; height:64px; flex-shrink:0;">
                <img id="profile-photo-preview" src="${getAvatarUrl(tech.avatar)}"
                     style="width:64px; height:64px; border-radius:50%; object-fit:cover; border:2px solid var(--primary);">
                <label for="profile-photo-input"
                       style="position:absolute; bottom:0; right:0; width:22px; height:22px; background:var(--primary); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                  <span class="material-symbols-rounded" style="font-size:14px; color:#000;">photo_camera</span>
                </label>
                <input type="file" id="profile-photo-input" accept="image/*" capture="user" style="display:none;">
              </div>
              <div style="flex:1; min-width:0;">
                <p style="margin:0; font-size:14px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tech.name}</p>
                <p style="margin:4px 0 0 0; font-size:10px; opacity:0.6;">${tech.login || '-'} · ${isAdmin ? 'Administrador' : 'Técnico'}</p>
              </div>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn-primary" onclick="window.renderEditProfileForm()" style="margin-top:0; background:rgba(255,255,255,0.08); color:var(--text); border:1px solid var(--glass-border);">
              <span class="material-symbols-rounded" style="font-size:16px;">edit</span>
              EDITAR PERFIL
            </button>
            <button class="btn-primary" onclick="window.renderChangePasswordForm()" style="margin-top:0; background:rgba(255,255,255,0.08); color:var(--text); border:1px solid var(--glass-border);">
              <span class="material-symbols-rounded" style="font-size:16px;">lock</span>
              SENHA
            </button>
          </div>
          ${isAdmin ? `
          <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:12px;">
            <label style="font-size:9px; opacity:0.65; font-weight:800;">APLICATIVO</label>
            <p style="margin:5px 0 0 0; font-size:13px; font-weight:800;">${tech.appName}</p>
          </div>` : ''}
          <button class="btn-primary" onclick="window.logoutApp()" style="background:#ef4444; color:#fff; margin-top:0;">
            <span class="material-symbols-rounded" style="font-size:16px;">logout</span>
            SAIR
          </button>
        </div>
      </div>

      <!-- ASSINATURA -->
      <div class="card" style="margin:0; border:1px solid ${isPremium ? 'rgba(250,204,21,0.4)' : 'var(--glass-border)'};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h4 style="font-size:12px; font-weight:800; margin:0; color:${isPremium ? '#facc15' : 'var(--primary)'};">ASSINATURA</h4>
          <span style="font-size:9px; font-weight:800; padding:4px 10px; border-radius:20px; background:${isPremium ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.08)'}; color:${isPremium ? '#facc15' : 'var(--text-dim)'};">
            ${isPremium ? 'PREMIUM' : 'GRATUITO'}
          </span>
        </div>
        ${isPremium ? `
        <div style="background:rgba(250,204,21,0.07); border-radius:8px; padding:12px; margin-bottom:12px;">
          <p style="font-size:12px; margin:0; line-height:1.6;">
            Acesso completo ativo.<br>
            <span style="opacity:0.6; font-size:10px;">Gerencie sua assinatura para ver vencimento e detalhes do plano.</span>
          </p>
        </div>
        <button class="btn-primary" style="background:rgba(250,204,21,0.15); color:#facc15; border:1px solid rgba(250,204,21,0.3); margin-top:0;" disabled>
          <span class="material-symbols-rounded" style="font-size:16px;">workspace_premium</span>
          GERENCIAR PLANO
        </button>` : `
        <div style="background:rgba(0,180,255,0.06); border-radius:8px; padding:12px; margin-bottom:12px;">
          <p style="font-size:12px; margin:0; line-height:1.6;">
            Você está no plano gratuito.<br>
            <span style="opacity:0.6; font-size:10px;">Faça upgrade para desbloquear relatórios avançados, múltiplos técnicos e sync na nuvem.</span>
          </p>
        </div>
        <button class="btn-primary" style="background:linear-gradient(135deg,#1565C0,#00CFFF); margin-top:0;" disabled>
          <span class="material-symbols-rounded" style="font-size:16px;">workspace_premium</span>
          ASSINAR PREMIUM — EM BREVE
        </button>`}
      </div>

      <!-- NOTIFICAÇÕES -->
      <div class="card" style="margin:0;">
        <h4 style="font-size:12px; font-weight:800; margin:0 0 15px 0; color:var(--primary);">NOTIFICAÇÕES</h4>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); border-radius:8px; padding:14px;">
            <div>
              <p style="margin:0; font-size:13px; font-weight:700;">Alertas de manutenção</p>
              <p style="margin:4px 0 0 0; font-size:10px; opacity:0.6;">Equipamentos vencidos e próximos do prazo</p>
            </div>
            <label style="position:relative; width:44px; height:24px; flex-shrink:0; cursor:pointer;">
              <input type="checkbox" id="toggle-notif" ${notifEnabled ? 'checked' : ''} style="opacity:0; width:0; height:0; position:absolute;">
              <span id="toggle-notif-track" style="position:absolute; inset:0; border-radius:24px; background:${notifEnabled ? 'var(--primary)' : 'rgba(255,255,255,0.15)'}; transition:0.3s;">
                <span style="position:absolute; top:3px; left:${notifEnabled ? '23px' : '3px'}; width:18px; height:18px; border-radius:50%; background:#fff; transition:0.3s;"></span>
              </span>
            </label>
          </div>
        </div>
      </div>

      ${isAdmin ? `
      <!-- MODELO DE TRABALHO -->
      <div class="card" style="margin:0;">
        <h4 style="font-size:12px; font-weight:800; margin:0 0 15px 0; color:var(--primary);">MODELO DE TRABALHO</h4>
        <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:12px;">
          <label style="font-size:9px; opacity:0.65; font-weight:800;">PERFIL DA OPERAÇÃO</label>
          <p style="margin:5px 0 0 0; font-size:13px; font-weight:800;">
            ${isCompany ? 'Empresa — administrativo + funcionários' : 'Autônomo — acesso completo'}
          </p>
          <p style="margin:5px 0 0 0; font-size:10px; opacity:0.62; line-height:1.45;">
            Definido no cadastro e não pode ser alterado.
          </p>
        </div>
      </div>

      ${isCompany ? `
      <!-- FUNCIONÁRIOS -->
      <div class="card" style="margin:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h4 style="font-size:12px; font-weight:800; margin:0; color:var(--primary);">FUNCIONÁRIOS</h4>
          <button class="btn-primary" onclick="window.renderTechnicianForm()" style="width:auto; padding:9px 12px; margin:0; font-size:9px; border-radius:10px; background:#22c55e;">
            <span class="material-symbols-rounded" style="font-size:15px;">person_add</span>
            NOVO
          </button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${technicians.length > 0 ? technicians.map((u) => `
            <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:11px;">
              <p style="font-size:12px; font-weight:800; margin:0;">${u.name}</p>
              <p style="font-size:10px; opacity:0.62; margin:4px 0 0 0;">${u.login} · Acesso de funcionário limitado</p>
            </div>
          `).join('') : '<p style="font-size:12px; opacity:0.55; margin:0;">Nenhum funcionário cadastrado ainda.</p>'}
        </div>
      </div>
      ` : ''}

      <!-- DADOS & BACKUP -->
      <div class="card" style="margin:0;">
        <h4 style="font-size:12px; font-weight:800; margin:0 0 15px 0; color:var(--primary);">DADOS & BACKUP</h4>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn-primary" onclick="window.exportarDados()" style="background:#0ea5e9; margin-top:0;">
            <span class="material-symbols-rounded" style="font-size:16px;">backup</span>
            FAZER BACKUP (BAIXAR)
          </button>
          <button class="btn-primary" onclick="window.restaurarDados()" style="background:#8b5cf6; margin-top:0;">
            <span class="material-symbols-rounded" style="font-size:16px;">restore</span>
            RESTAURAR DO BACKUP
          </button>
        </div>
      </div>

      <!-- PERIGO -->
      <div class="card" style="margin:0; border-top:3px solid #ff4d4d;">
        <h4 style="font-size:12px; font-weight:800; margin:0 0 15px 0; color:#ff4d4d;">PERIGO</h4>
        <button class="btn-primary" onclick="window.limparTodosDados()" style="background:#ff4d4d; margin-top:0;">
          <span class="material-symbols-rounded" style="font-size:16px;">delete_forever</span>
          LIMPAR TODOS OS DADOS
        </button>
      </div>
      ` : `
      <div class="card" style="margin:0;">
        <h4 style="font-size:12px; font-weight:800; margin:0 0 10px 0; color:var(--primary);">ACESSO TÉCNICO</h4>
        <p style="font-size:12px; opacity:0.65; margin:0; line-height:1.5;">
          Backup, restauração e limpeza de dados ficam disponíveis apenas para o administrador.
        </p>
      </div>
      `}

      <!-- SUPORTE & SOBRE -->
      <div class="card" style="margin:0;">
        <h4 style="font-size:12px; font-weight:800; margin:0 0 15px 0; color:var(--primary);">SUPORTE & SOBRE</h4>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <a href="https://wa.me/5517992347622?text=Suporte%20Arcon" target="_blank" rel="noopener"
             style="display:flex; align-items:center; gap:12px; background:rgba(37,211,102,0.08); border:1px solid rgba(37,211,102,0.2); border-radius:10px; padding:13px; text-decoration:none; color:inherit;">
            <span class="material-symbols-rounded" style="color:#25D366; font-size:22px;">chat</span>
            <div>
              <p style="margin:0; font-size:12px; font-weight:800;">Falar com suporte</p>
              <p style="margin:2px 0 0 0; font-size:10px; opacity:0.6;">WhatsApp · Seg–Sex 8h–18h</p>
            </div>
          </a>
          <div style="background:rgba(255,255,255,0.04); border-radius:10px; padding:13px; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between;">
              <span style="font-size:11px; opacity:0.6;">Aplicativo</span>
              <span style="font-size:11px; font-weight:700;">Arcon</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="font-size:11px; opacity:0.6;">Versão</span>
              <span style="font-size:11px; font-weight:700;">1.0.0</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="font-size:11px; opacity:0.6;">Plataforma</span>
              <span style="font-size:11px; font-weight:700;">PWA · Offline-First</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="font-size:11px; opacity:0.6;">Desenvolvedor</span>
              <span style="font-size:11px; font-weight:700;">Guilherme Augusto</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  const photoInput = document.getElementById('profile-photo-input');
  if (photoInput) {
    photoInput.onchange = async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      const base64 = await resizePhoto(file);
      authService.setTechnicianData(null, null, base64);
      document.getElementById('profile-photo-preview').src = base64;
      const headerAvatar = document.querySelector('.user-profile img');
      if (headerAvatar) headerAvatar.src = base64;
    };
  }

  const toggleNotif = document.getElementById('toggle-notif');
  if (toggleNotif) {
    toggleNotif.onchange = () => {
      const enabled = toggleNotif.checked;
      authService.setNotificationsEnabled(enabled);
      const track = document.getElementById('toggle-notif-track');
      if (track) {
        track.style.background = enabled ? 'var(--primary)' : 'rgba(255,255,255,0.15)';
        track.querySelector('span').style.left = enabled ? '23px' : '3px';
      }
    };
  }
}

export function renderEditProfileForm() {
  const tech = authService.getTechnicianData();
  openModal('Editar Perfil');
  modalBody.innerHTML = `
    <form id="f-edit-profile">
      <div class="form-group">
        <label>Nome</label>
        <input type="text" id="ep-name" class="form-control" value="${tech.name}" required>
      </div>
      <div class="form-group">
        <label>Login</label>
        <input type="text" id="ep-login" class="form-control" value="${tech.login || ''}">
      </div>
      <button type="submit" class="btn-primary">SALVAR ALTERAÇÕES</button>
    </form>
  `;
  document.getElementById('f-edit-profile').onsubmit = (e) => {
    e.preventDefault();
    try {
      const name = document.getElementById('ep-name').value;
      const login = document.getElementById('ep-login').value;
      authService.updateProfile(name, login);
      closeModal();
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  };
}

export function renderChangePasswordForm() {
  openModal('Alterar Senha');
  modalBody.innerHTML = `
    <form id="f-change-password">
      <div class="form-group">
        <label>Senha atual</label>
        <input type="password" id="cp-current" class="form-control" required placeholder="Sua senha atual">
      </div>
      <div class="form-group">
        <label>Nova senha</label>
        <input type="password" id="cp-new" class="form-control" required placeholder="Mínimo 4 caracteres">
      </div>
      <div class="form-group">
        <label>Confirmar nova senha</label>
        <input type="password" id="cp-confirm" class="form-control" required placeholder="Repita a nova senha">
      </div>
      <button type="submit" class="btn-primary">ALTERAR SENHA</button>
    </form>
  `;
  document.getElementById('f-change-password').onsubmit = (e) => {
    e.preventDefault();
    const current = document.getElementById('cp-current').value;
    const novo = document.getElementById('cp-new').value;
    const confirm = document.getElementById('cp-confirm').value;
    if (novo !== confirm) { alert('As senhas não coincidem.'); return; }
    try {
      authService.changePassword(current, novo);
      closeModal();
      alert('Senha alterada com sucesso!');
    } catch (err) {
      alert(err.message);
    }
  };
}

export function renderTechnicianForm() {
  if (!authService.isAdmin() || authService.getBusinessMode() !== 'empresa') {
    alert('Apenas o administrativo de empresa pode cadastrar funcionarios.');
    return;
  }

  openModal('Novo Funcionario');

  modalBody.innerHTML = `
    <form id="f-technician">
      <div class="form-group">
        <label>Nome do funcionario</label>
        <input type="text" id="t-name" class="form-control" required placeholder="Ex: Carlos Silva">
      </div>
      <div class="form-group">
        <label>Login</label>
        <input type="text" id="t-login" class="form-control" required placeholder="usuario ou email">
      </div>
      <div class="form-group">
        <label>Senha</label>
        <input type="password" id="t-password" class="form-control" required placeholder="Senha de acesso">
      </div>
      <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:11px; margin-bottom:14px;">
        <p style="font-size:10px; opacity:0.72; margin:0; line-height:1.5;">
          Este funcionario tera acesso limitado. Funcoes administrativas, backup, restauracao e limpeza de dados ficam bloqueadas.
        </p>
      </div>
      <button type="submit" class="btn-primary">CADASTRAR FUNCIONARIO</button>
    </form>
  `;

  document.getElementById('f-technician').onsubmit = (event) => {
    event.preventDefault();
    try {
      authService.createTechnician({
        name: document.getElementById('t-name').value,
        login: document.getElementById('t-login').value,
        password: document.getElementById('t-password').value
      });
      closeModal();
      alert('Funcionario cadastrado com sucesso.');
      location.reload();
    } catch (error) {
      alert(error.message);
    }
  };
}

/**
 * Exportar dados do banco para JSON
 */
export async function exportarDados() {
  try {
    const jsonData = await exportDatabase();
    
    // Criar blob e download
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-ar-jampa-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert('Backup realizado com sucesso!');
  } catch (error) {
    alert('Erro ao fazer backup: ' + error.message);
  }
}

/**
 * Restaurar dados do backup
 */
export async function restaurarDados() {
  openModal('Restaurar Backup');
  
  modalBody.innerHTML = `
    <form id="f-restore">
      <div class="form-group">
        <label>Selecione o arquivo de backup (.json)</label>
        <input type="file" id="r-file" class="form-control" accept=".json" required>
      </div>
      <p style="font-size:10px; opacity:0.6; margin-top:10px;">
        ⚠️ Aviso: Esta ação irá substituir TODOS os seus dados atuais. Tenha certeza antes de continuar!
      </p>
      <button type="submit" class="btn-primary" style="margin-top:15px;">RESTAURAR DADOS</button>
    </form>
  `;
  
  document.getElementById('f-restore').onsubmit = async (ev) => {
    ev.preventDefault();
    
    const fileInput = document.getElementById('r-file');
    if (!fileInput.files[0]) {
      alert('Selecione um arquivo de backup');
      return;
    }
    
    const file = fileInput.files[0];
    const text = await file.text();
    
    const result = await importDatabase(text);
    
    if (result.success) {
      alert('Dados restaurados com sucesso! A página será recarregada.');
      location.reload();
    } else {
      alert('Erro ao restaurar dados: ' + result.error);
    }
  };
}

/**
 * Limpar todos os dados (com confirmação)
 */
export async function limparTodosDados() {
  const confirmacao = confirm(
    'ATENÇÃO! Isto irá deletar TODOS os seus dados do aplicativo.\n' +
    'Clique em OK apenas se tem certeza disso.\n\n' +
    'Esta ação NÃO pode ser desfeita!'
  );
  
  if (!confirmacao) return;
  
  const confirmacao2 = confirm(
    'Tem CERTEZA ABSOLUTA? Todos os seus clientes, equipamentos e manutenções serão permanentemente deletados!'
  );
  
  if (!confirmacao2) return;
  
  try {
    await db.bairros.clear();
    await db.clientes.clear();
    await db.equipamentos.clear();
    await db.unidades?.clear();
    await db.manutencoes.clear();
    await db.materiais?.clear();
    await db.materiaisUsados?.clear();
    await db.orcamentos?.clear();
    await db.comunicacao?.clear();
    
    alert('Todos os dados foram deletados. A página será recarregada.');
    location.reload();
  } catch (error) {
    alert('Erro ao limpar dados: ' + error.message);
  }
}

export default {
  renderMais,
  renderTechnicianForm,
  exportarDados,
  restaurarDados,
  limparTodosDados
};
