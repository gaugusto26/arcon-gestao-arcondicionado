import { supabase } from '../lib/supabase.js';
import { setOwnerId } from './db.js';

// ──────────────────────────────────────────────
// Cache da sessão (sync, atualizado pelo listener)
// ──────────────────────────────────────────────

let _session = null;
let _currentUser = null;

function normalizeBusinessMode(businessMode) {
  return businessMode === 'empresa' ? 'empresa' : 'autonomo';
}

async function loadProfile(user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  _currentUser = {
    id:           user.id,
    email:        user.email,
    login:        user.email,
    name:         profile?.name || user.user_metadata?.name || 'Usuário',
    role:         profile?.role || 'administrativo',
    businessMode: normalizeBusinessMode(
      profile?.business_mode || user.user_metadata?.businessMode || user.user_metadata?.business_mode
    ),
    avatar:       profile?.avatar || null,
    createdAt:    user.created_at
  };
}

// ──────────────────────────────────────────────
// authService
// ──────────────────────────────────────────────

export const authService = {
  async init() {
    const { data: { session } } = await supabase.auth.getSession();
    _session = session;
    setOwnerId(session?.user?.id);
    if (session?.user) await loadProfile(session.user);

    supabase.auth.onAuthStateChange(async (_event, session) => {
      _session = session;
      setOwnerId(session?.user?.id);
      if (session?.user) {
        await loadProfile(session.user);
      } else {
        _currentUser = null;
      }
    });
  },

  isAuthenticated() {
    return Boolean(_session && _currentUser);
  },

  getCurrentUser() {
    return _currentUser;
  },

  isAdmin() {
    return _currentUser?.role === 'administrativo';
  },

  isEmployee() {
    return _currentUser?.role === 'tecnico';
  },

  getBusinessMode() {
    return _currentUser?.businessMode || 'autonomo';
  },

  hasUsers() {
    return true;
  },

  getUsers() {
    return _currentUser ? [_currentUser] : [];
  },

  async register({ name, email, password, businessMode }) {
    const cleanName  = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass  = String(password || '').trim();
    const cleanMode  = normalizeBusinessMode(businessMode);

    if (!cleanName || !cleanEmail || !cleanPass) {
      throw new Error('Preencha nome, e-mail e senha.');
    }
    if (cleanPass.length < 6) {
      throw new Error('A senha deve ter ao menos 6 caracteres.');
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPass,
      options: {
        data: {
          name: cleanName,
          role: 'administrativo',
          businessMode: cleanMode,
          business_mode: cleanMode
        }
      }
    });

    if (error) throw new Error(error.message);

    if (!data.session) {
      _session = null;
      _currentUser = null;
      setOwnerId(null);
      return { pendingEmailConfirmation: true };
    }

    _session = data.session;
    setOwnerId(data.session?.user?.id);
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          name: cleanName,
          role: 'administrativo',
          business_mode: cleanMode
        }, { onConflict: 'id' });

      if (profileError) throw new Error(profileError.message);

      await loadProfile(data.user);
    }
    return _currentUser;
  },

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || '').trim().toLowerCase(),
      password: String(password || '').trim()
    });

    if (error) throw new Error('E-mail ou senha inválidos.');

    _session = data.session;
    setOwnerId(data.session?.user?.id);
    if (data.user) await loadProfile(data.user);
    return _currentUser;
  },

  async logout() {
    await supabase.auth.signOut();
    _session = null;
    _currentUser = null;
  },

  getTechnicianData() {
    return {
      name:    _currentUser?.name    || 'Usuário',
      appName: 'Arcon',
      avatar:  _currentUser?.avatar  || null,
      role:    _currentUser?.role    || 'administrativo',
      login:   _currentUser?.email   || ''
    };
  },

  async setTechnicianData(name, _appName, avatar) {
    if (!_currentUser) return;
    const updates = {};
    if (name  !== null && name  !== undefined) updates.name   = String(name).trim();
    if (avatar !== null && avatar !== undefined) updates.avatar = avatar;
    if (!Object.keys(updates).length) return;

    await supabase.from('profiles').update(updates).eq('id', _currentUser.id);
    Object.assign(_currentUser, updates);
  },

  async changePassword(currentPassword, newPassword) {
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email:    _currentUser.email,
      password: String(currentPassword).trim()
    });
    if (verifyError) throw new Error('Senha atual incorreta.');

    const clean = String(newPassword).trim();
    if (clean.length < 6) throw new Error('A nova senha deve ter ao menos 6 caracteres.');

    const { error } = await supabase.auth.updateUser({ password: clean });
    if (error) throw new Error(error.message);
  },

  async updateProfile(name, newEmail) {
    if (name) {
      const cleanName = String(name).trim();
      if (!cleanName) throw new Error('Nome não pode ser vazio.');
      await supabase.from('profiles').update({ name: cleanName }).eq('id', _currentUser.id);
      _currentUser.name = cleanName;
    }
    if (newEmail && newEmail !== _currentUser.email) {
      const { error } = await supabase.auth.updateUser({ email: String(newEmail).trim().toLowerCase() });
      if (error) throw new Error(error.message);
      _currentUser.email = newEmail;
      _currentUser.login = newEmail;
    }
  },

  createTechnician() {
    throw new Error('Modo empresa estará disponível em breve.');
  },

  setBusinessMode() {
    throw new Error('O modelo de trabalho não pode ser alterado depois do cadastro.');
  },

  getNotificationsEnabled() {
    return localStorage.getItem('jampa_notifications') !== 'false';
  },

  setNotificationsEnabled(enabled) {
    localStorage.setItem('jampa_notifications', enabled ? 'true' : 'false');
  },

  getPlan() {
    return localStorage.getItem('jampa_plan') || 'free';
  },

  get(key) {
    return localStorage.getItem(`jampa_${key}`);
  },

  set(key, value) {
    localStorage.setItem(`jampa_${key}`, value);
  }
};
