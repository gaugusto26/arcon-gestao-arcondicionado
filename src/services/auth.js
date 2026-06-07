import { generateId } from './db.js';

const DEFAULTS = {
  name: 'Tecnico',
  appName: 'Arcon',
  avatar: null,
  role: 'tecnico'
};

const USERS_KEY = 'jampa_users';
const SESSION_KEY = 'jampa_session_user';
const APP_NAME_KEY = 'jampa_app_name';
const BUSINESS_MODE_KEY = 'jampa_business_mode';

function normalizeLogin(login) {
  return String(login || '').trim().toLowerCase();
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSessionLogin() {
  return localStorage.getItem(SESSION_KEY);
}

function publicUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

function ensureUser(users, user) {
  if (users.some((item) => item.login === user.login)) return false;
  users.push({
    id: generateId(),
    avatar: DEFAULTS.avatar,
    createdAt: new Date().toISOString(),
    ...user
  });
  return true;
}

export const authService = {
  ensureTestUsers() {
    const users = getUsers();
    const changed = [
      ensureUser(users, {
        name: 'Admin Autonomo',
        login: 'adminaut',
        password: 'adminaut',
        role: 'administrativo',
        businessMode: 'autonomo'
      }),
      ensureUser(users, {
        name: 'Admin Empresa',
        login: 'adminemp',
        password: 'adminemp',
        role: 'administrativo',
        businessMode: 'empresa'
      })
    ].some(Boolean);

    if (changed) saveUsers(users);
    if (!localStorage.getItem(APP_NAME_KEY)) localStorage.setItem(APP_NAME_KEY, DEFAULTS.appName);
  },

  hasUsers() {
    return getUsers().length > 0;
  },

  getUsers() {
    return getUsers().map(publicUser);
  },

  getCurrentUser() {
    const sessionLogin = getSessionLogin();
    if (!sessionLogin) return null;
    return publicUser(getUsers().find((user) => user.login === sessionLogin));
  },

  isAuthenticated() {
    return Boolean(this.getCurrentUser());
  },

  isAdmin() {
    return this.getCurrentUser()?.role === 'administrativo';
  },

  isEmployee() {
    return this.getCurrentUser()?.role === 'tecnico';
  },

  getBusinessMode() {
    const currentUser = this.getCurrentUser();
    return currentUser?.businessMode || localStorage.getItem(BUSINESS_MODE_KEY) || 'autonomo';
  },

  setBusinessMode(mode) {
    throw new Error('O modelo de trabalho nao pode ser alterado depois do cadastro.');
  },

  register({ name, login, password, role, appName, businessMode, startSession = true }) {
    const normalizedLogin = normalizeLogin(login);
    const cleanName = String(name || '').trim();
    const cleanPassword = String(password || '').trim();
    const users = getUsers();

    if (!cleanName || !normalizedLogin || !cleanPassword) {
      throw new Error('Preencha nome, login e senha.');
    }

    if (users.some((user) => user.login === normalizedLogin)) {
      throw new Error('Ja existe um usuario com este login.');
    }

    const selectedRole = role === 'tecnico' ? 'tecnico' : 'administrativo';
    const user = {
      id: generateId(),
      name: cleanName,
      login: normalizedLogin,
      password: cleanPassword,
      role: selectedRole,
      businessMode: selectedRole === 'administrativo'
        ? (businessMode === 'empresa' ? 'empresa' : 'autonomo')
        : null,
      avatar: DEFAULTS.avatar,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers(users);

    if (selectedRole === 'administrativo') {
      localStorage.setItem(BUSINESS_MODE_KEY, businessMode === 'empresa' ? 'empresa' : 'autonomo');
    }

    if (appName && selectedRole === 'administrativo') {
      localStorage.setItem(APP_NAME_KEY, String(appName).trim());
    } else if (!localStorage.getItem(APP_NAME_KEY)) {
      localStorage.setItem(APP_NAME_KEY, DEFAULTS.appName);
    }

    if (startSession) {
      localStorage.setItem(SESSION_KEY, normalizedLogin);
    }
    return publicUser(user);
  },

  createTechnician({ name, login, password }) {
    if (!this.isAdmin() || this.getBusinessMode() !== 'empresa') {
      throw new Error('Apenas o administrativo de empresa pode cadastrar funcionarios.');
    }

    return this.register({
      name,
      login,
      password,
      role: 'tecnico',
      startSession: false
    });
  },

  login(login, password) {
    const normalizedLogin = normalizeLogin(login);
    const cleanPassword = String(password || '').trim();
    const user = getUsers().find((item) => item.login === normalizedLogin && item.password === cleanPassword);

    if (!user) {
      throw new Error('Login ou senha invalido.');
    }

    localStorage.setItem(SESSION_KEY, user.login);
    return publicUser(user);
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
  },

  getTechnicianData() {
    const currentUser = this.getCurrentUser();
    return {
      name: currentUser?.name || localStorage.getItem('jampa_tech_name') || DEFAULTS.name,
      appName: localStorage.getItem(APP_NAME_KEY) || DEFAULTS.appName,
      avatar: currentUser?.avatar || localStorage.getItem('jampa_tech_avatar') || DEFAULTS.avatar,
      role: currentUser?.role || DEFAULTS.role,
      login: currentUser?.login || ''
    };
  },

  setTechnicianData(name, appName, avatar) {
    const currentUser = this.getCurrentUser();
    if (appName !== null && appName !== undefined) localStorage.setItem(APP_NAME_KEY, appName);

    if (!currentUser) {
      if (name !== null && name !== undefined) localStorage.setItem('jampa_tech_name', name);
      if (avatar !== null && avatar !== undefined) localStorage.setItem('jampa_tech_avatar', avatar);
      return;
    }

    const users = getUsers();
    const index = users.findIndex((user) => user.login === currentUser.login);
    if (index === -1) return;

    if (name !== null && name !== undefined) users[index].name = name;
    if (avatar !== null && avatar !== undefined) users[index].avatar = avatar;
    saveUsers(users);
  },

  changePassword(currentPassword, newPassword) {
    const sessionLogin = getSessionLogin();
    const users = getUsers();
    const index = users.findIndex((u) => u.login === sessionLogin);
    if (index === -1) throw new Error('Usuário não encontrado.');
    if (users[index].password !== String(currentPassword).trim()) throw new Error('Senha atual incorreta.');
    const clean = String(newPassword).trim();
    if (clean.length < 4) throw new Error('A nova senha deve ter ao menos 4 caracteres.');
    users[index].password = clean;
    saveUsers(users);
  },

  updateProfile(name, newLogin) {
    const sessionLogin = getSessionLogin();
    const users = getUsers();
    const index = users.findIndex((u) => u.login === sessionLogin);
    if (index === -1) throw new Error('Usuário não encontrado.');
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Nome não pode ser vazio.');
    if (newLogin) {
      const normalized = normalizeLogin(newLogin);
      if (normalized !== sessionLogin && users.some((u) => u.login === normalized)) {
        throw new Error('Este login já está em uso.');
      }
      users[index].login = normalized;
      localStorage.setItem(SESSION_KEY, normalized);
    }
    users[index].name = cleanName;
    saveUsers(users);
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
