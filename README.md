# Ar Conect — Gestão Inteligente para Climatização

PWA offline-first para técnicos e empresas de manutenção de ar-condicionado. Gerencia clientes, equipamentos, ordens de serviço, agenda e financeiro — 100% no dispositivo, sem necessidade de internet.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Vanilla JS (ES Modules), HTML5, CSS3 |
| Build | Vite 8 |
| Banco local | Dexie.js 4 (IndexedDB) |
| PWA | Service Worker + Web App Manifest |
| Avatares | DiceBear API |
| PDF | Geração client-side |
| Deploy | GitHub Pages |

---

## Rodar localmente

**Pré-requisito:** Node.js 18+

```bash
git clone https://github.com/gaugusto26/arcon-gestao-arcondicionado.git
cd arcon-gestao-arcondicionado
npm install
npm run dev
```

Acesse em `http://localhost:5173`

Para testar em dispositivo móvel na mesma rede:
```bash
npm run dev -- --host
```
O terminal exibirá o IP de rede (ex: `http://192.168.x.x:5173`).

---

## Build e Deploy

```bash
# Gerar build de produção
npm run build

# Preview local do build
npm run preview
```

O build gera a pasta `dist/` — ignorada pelo git (não commitar).

Deploy no GitHub Pages é feito publicando o conteúdo de `dist/` na branch `gh-pages` ou via GitHub Actions.

---

## Estrutura do Projeto

```
/
├── index.html                   # Shell SPA + splash screen animada
├── style.css                    # Tema global — variáveis, componentes
├── vite.config.js               # Alias @/ → src/
│
├── public/
│   ├── logo-deitada.svg         # Logo horizontal Arcon (splash)
│   ├── logo-quadrada.svg        # Logo ícone Arcon (login + nav)
│   ├── favicon.svg
│   ├── icon.png
│   ├── icons.svg
│   ├── manifest.json
│   ├── sw.js                    # Service Worker (network-first)
│   └── brands/                  # Logos de marcas de AC
│
└── src/
    ├── main-new.js              # Entry point — navegação e orquestração
    ├── services/                # Lógica compartilhada
    │   ├── db.js                # IndexedDB (Dexie) + query helpers
    │   ├── auth.js              # Auth local + roles admin/técnico
    │   ├── ui.js                # Modal, avatar, formatação, CONSTANTS
    │   ├── sync.js              # Fila offline → sync backend (preparado)
    │   ├── comunicacao.js       # WhatsApp, SMS
    │   ├── pdf.js               # Geração de recibos e relatórios
    │   ├── contacts.js          # Contact Picker API + vCard/CSV
    │   └── index.js             # Re-export centralizado
    └── modules/                 # Features (cada uma independente)
        ├── agenda/              # Dashboard, OS, financeiro
        ├── clientes/            # Bairros, clientes, equipamentos
        ├── historico/           # Histórico de OS, PDF
        ├── configuracoes/       # Perfil, técnicos, backup
        ├── orcamentos/          # [Placeholder]
        ├── materiais/           # [Placeholder]
        ├── comunicacao/         # [Placeholder]
        └── relatorios/          # [Placeholder]
```

Documentação completa em [ARQUITETURA.md](./ARQUITETURA.md).

---

## Primeiro Acesso

1. Abra o app — a splash screen exibe o logo Arcon animado
2. Na tela de login, clique em **Cadastro** para criar o primeiro usuário **Admin**
3. O Admin pode cadastrar técnicos dentro do painel de Configurações
4. Técnicos fazem login com as credenciais criadas pelo Admin

---

## Tema Visual

Cores baseadas no logo Arcon:

```css
--primary:   #00CFFF   /* Azul-ciano — botões, ícones ativos */
--secondary: #1565C0   /* Azul royal — gradientes, auth */
--bg:        #060D1A   /* Navy escuro — fundo geral */
```

---

## Variáveis de Ambiente

O projeto não usa `.env` — todas as configurações estão em:

| Arquivo | O que configurar |
|---|---|
| `public/manifest.json` | Nome do app, ícones, tema PWA |
| `src/services/sync.js` | `BACKEND_URL` para API de sync |
| `src/services/auth.js` | Prefixo `jampa_` do localStorage |

---

## Adicionando uma Nova Feature

```bash
mkdir src/modules/novafeature
touch src/modules/novafeature/index.js
```

```js
// src/modules/novafeature/index.js
import { db } from '../services/db.js';
import { openModal } from '../services/ui.js';

export async function renderNovaFeature(mainContent, headerContent) {
  mainContent.innerHTML = `...`;
}
```

```js
// src/main-new.js — adicionar ao switch de navegação
import { renderNovaFeature } from './modules/novafeature/index.js';
// ...
case 'novafeature': renderNovaFeature(mainContent, headerContent); break;
```

---

## Pendências / Roadmap

### Em desenvolvimento
- [ ] Módulo de Orçamentos
- [ ] Módulo de Materiais / Estoque
- [ ] Central de Comunicação (WhatsApp integrado)
- [ ] Relatórios e Analytics avançados
- [ ] Multi-tenant completo (empresa + N técnicos)
- [ ] Sync com backend (infraestrutura em `services/sync.js` já preparada)

### Pendente — Assinatura e Pagamento
- [ ] **Aba de Assinatura** — tela para o usuário visualizar plano atual, data de vencimento e benefícios
- [ ] **Fluxo de Pagamento** — integração com gateway (ex: Stripe, Mercado Pago, Asaas) para upgrade/renovação de plano
- [ ] **Controle de Acesso por Plano** — limitar funcionalidades conforme plano ativo (freemium vs premium)
- [ ] **Webhook de Confirmação** — receber confirmação de pagamento e liberar acesso automaticamente
- [ ] **Notificação de Vencimento** — alertar usuário quando a assinatura estiver próxima do fim

---

## Desenvolvedor

**Guilherme Augusto** — Vibe Coder · 2026
