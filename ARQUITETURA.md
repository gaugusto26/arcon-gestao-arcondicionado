# Arquitetura — Ar Conect (Arcon)

## Visão Geral

PWA offline-first para gestão de manutenção de ar-condicionado. Construído com **Vanilla JS + Vite + Dexie.js** (IndexedDB). Sem framework front-end. Tema dark navy glassmorphism baseado nas cores do logo Arcon.

---

## Estrutura de Arquivos

```
/
├── index.html                   # Shell da SPA + splash screen
├── style.css                    # Tema global (variáveis, componentes)
├── vite.config.js               # Build config (base GitHub Pages)
│
├── public/
│   ├── logo-deitada.svg         # Logo horizontal (splash screen)
│   ├── logo-quadrada.svg        # Logo ícone (login e nav)
│   ├── favicon.svg
│   ├── icon.png
│   ├── icons.svg                # Sprite de ícones customizados
│   ├── manifest.json            # PWA manifest
│   ├── sw.js                    # Service Worker (network-first)
│   └── brands/                  # Logos de marcas de AC (PNG)
│
└── src/
    ├── main-new.js              # Entry point — orquestra módulos e navegação
    ├── services/                # Lógica compartilhada entre módulos
    │   ├── index.js             # Re-export centralizado dos serviços
    │   ├── db.js                # IndexedDB via Dexie (schemas + queries)
    │   ├── auth.js              # Autenticação local + roles (admin/técnico)
    │   ├── ui.js                # Modal, avatar, formatação, CONSTANTS
    │   ├── sync.js              # Fila offline-first para sync com backend
    │   ├── comunicacao.js       # WhatsApp, SMS, email
    │   ├── pdf.js               # Geração de recibos e relatórios PDF
    │   └── contacts.js          # Contact Picker API + importação vCard/CSV
    │
    └── modules/                 # Features isoladas — cada uma independente
        ├── agenda/index.js      # Dashboard, agenda, manutenções, financeiro
        ├── clientes/index.js    # Bairros, clientes, unidades, equipamentos
        ├── historico/index.js   # Histórico de OS, recibos PDF
        ├── configuracoes/index.js  # Perfil, backup/restore, técnicos
        ├── orcamentos/index.js  # [Placeholder] Orçamentos
        ├── materiais/index.js   # [Placeholder] Estoque de peças
        ├── comunicacao/index.js # [Placeholder] Central de comunicação
        └── relatorios/index.js  # [Placeholder] Analytics e relatórios
```

---

## Tema Visual

| Variável | Valor | Uso |
|---|---|---|
| `--primary` | `#00CFFF` | Azul-ciano do logo — botões, destaques, ícones ativos |
| `--secondary` | `#1565C0` | Azul royal do globo — gradientes, auth background |
| `--bg` | `#060D1A` | Navy escuro — fundo geral |
| `--card-bg` | `rgba(0,180,255,0.05)` | Cards glassmorphism |
| `--glass-border` | `rgba(0,180,255,0.15)` | Bordas translúcidas |
| `--text` | `#ffffff` | Texto principal |
| `--text-dim` | `#a0b4c8` | Texto secundário |

---

## Serviços

### `db.js` — Camada de Dados
- Gerencia IndexedDB via Dexie.js
- **Schemas:** bairros, clientes, equipamentos, unidades, manutencoes, materiais, orcamentos, comunicacao
- **Helpers:** `getEquipmentWithDetails()`, `getMaintenanceByPeriod()`, `calculateMonthlyRevenue()`, `exportDatabase()`, `importDatabase()`, `getOverdueEquipments()`, `getUpcomingEquipments()`

### `auth.js` — Autenticação e Roles
- Storage: localStorage com prefixo `jampa_`
- Roles: **admin** (acesso completo) e **técnico** (acesso limitado)
- Admin pode cadastrar técnicos e atribuir serviços/OS
- `ensureTestUsers()` — cria usuários de teste na primeira execução
- `isAuthenticated()`, `login()`, `logout()`, `register()`, `getTechnicianData()`

### `ui.js` — Utilitários de Interface
- `openModal()` / `closeModal()` — sistema de modal global
- `getAvatarUrl(seed)` — avatares DiceBear
- `getLogo(marca)` — logos de marcas de AC
- `fileToBase64()` — upload de fotos
- `formatDate()` / `formatCurrency()` — formatação BR
- `CONSTANTS` — marcas, tipos de serviço, formas de pagamento

### `sync.js` — Sync Offline-First
- Fila de ações pendentes (localStorage)
- `queueAction(action, table, data)` — enfileira para sync
- `watchConnection()` — dispara sync ao voltar online
- Pronto para integrar com API REST

### `comunicacao.js` — Canais de Comunicação
- `sendWhatsAppReceipt(phone, receiptData)` — envio de recibo
- `sendSchedulingMessage(phone, equipInfo)` — lembrete de agendamento
- `logCommunication()` — registra no IndexedDB

### `pdf.js` — Documentos
- `generateReceipt(maintenance, equipment, client)` — recibo de serviço
- `generateMonthlyReport(monthData)` — relatório financeiro mensal

### `contacts.js` — Importação de Contatos
- Contact Picker API (Android/Chrome)
- Importação de arquivos vCard (`.vcf`) e CSV
- `isContactPickerSupported()`, `pickContactsFromDevice()`, `parseContactsFile(file)`

---

## Módulos

### `agenda/`
Tela inicial — dashboard com próximas manutenções, alertas de vencimento, registro de OS e relatório financeiro.

Exports: `renderDashboard`, `showNotifications`, `setHomeFilter`, `renderMaintenanceForm`, `showFinancialReport`, `renderNewServicePrompt`, `renderNewServiceLaunch`

### `clientes/`
Gestão de bairros → clientes → unidades (apartamentos) → equipamentos.

Exports: `renderBairros`, `renderBairroDetail`, `renderClientDetail`, `renderBairroForm`, `renderFullPropertyForm`, `renderContactsImportForm`, `renderClientServiceForm`, `renderCloseScheduledServiceForm`, `renderEquipmentForm`

### `historico/`
Lista de manutenções realizadas com filtros, geração de recibo PDF e histórico por equipamento.

Exports: `renderHistorico`, `gerarPDF`, `renderEquipmentHistory`

### `configuracoes/`
Perfil do técnico, avatar, nome do app, cadastro de técnicos (admin), backup/restore, limpeza de dados.

Exports: `renderMais`, `renderTechnicianForm`, `exportarDados`, `restaurarDados`, `limparTodosDados`

### Placeholders em desenvolvimento
`orcamentos/`, `materiais/`, `comunicacao/`, `relatorios/` — estrutura modular pronta, implementação pendente.

---

## Fluxo de Dados

```
Ação do usuário (click/submit)
        ↓
Função global window.X (exposta em main-new.js)
        ↓
Função do módulo renderX(mainContent, headerContent)
        ↓
Serviços (db.js, ui.js, auth.js...)
        ↓
IndexedDB / DOM
```

---

## Autenticação e Roles

```
Primeiro acesso → Cadastro Admin
    ↓
Admin loga → acesso total
    ↓
Admin cadastra técnicos → acesso limitado
    ↓
Técnico loga → vê apenas OS atribuídas a ele
```

---

## Como Adicionar uma Nova Feature

1. Criar `src/modules/novafeature/index.js`
2. Implementar e exportar `renderNovaFeature(mainContent, headerContent)`
3. Importar em `main-new.js` e adicionar ao `switch` de navegação
4. Adicionar item ao `<nav>` em `index.html`

---

## PWA

- **Service Worker:** `public/sw.js` — estratégia network-first com fallback para cache
- **Manifest:** `public/manifest.json` — ícones, nome, tema navy
- **Offline:** IndexedDB local + fila de sync para quando voltar online

---

## Build e Deploy

```bash
npm run dev      # Desenvolvimento local (Vite HMR)
npm run build    # Build para produção (dist/)
npm run preview  # Preview do build
```

Deploy configurado para **GitHub Pages** via `vite.config.js` com `base` ajustado.

---

## Banco de Dados (Schemas)

```javascript
bairros:      { id, nome, cor }
clientes:     { id, bairroId, nome, endereco, tipo, telefone, whatsapp }
equipamentos: { id, clienteId, unidadeId, marca, modelo, btu, localizacao, ultimaManutencao, proximaManutencao }
unidades:     { id, clienteId, apartamento, proprietario, telefone }
manutencoes:  { id, equipamentoId, dataRealizada, descricao, proximaData, valor, formaPagamento, foto }
materiais:    { id, nome, categoria, estoque, precoUnitario }
orcamentos:   { id, clienteId, equipamentoId, dataOrcamento, descricao, valor, status }
comunicacao:  { id, clienteId, tipo, mensagem, data, status }
```

---

## Roadmap

- [ ] Módulo de Orçamentos
- [ ] Módulo de Materiais / Estoque
- [ ] Central de Comunicação
- [ ] Relatórios e Analytics
- [ ] Sync com backend (syncService já preparado)
- [ ] Multi-tenant completo (admin de empresa + N técnicos)
