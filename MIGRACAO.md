# Histórico de Migração — Ar Conect

## Status: Migração Concluída

A migração do monolito para a arquitetura modular foi **completada e limpa**. Este documento registra o que mudou e o estado atual.

---

## O que foi feito

### Fase 1 — Reestruturação (concluída)
Código monolítico de `main.js` (~2000 linhas) decomposto em:
- `src/main-new.js` — entry point leve (~385 linhas)
- `src/services/` — lógica compartilhada (db, auth, ui, sync, pdf, comunicacao, contacts)
- `src/modules/` — features isoladas (agenda, clientes, historico, configuracoes + placeholders)

### Fase 2 — Limpeza (concluída)
Arquivos removidos após migração validada:

| Arquivo removido | Motivo |
|---|---|
| `src/main.js` | Substituído por `main-new.js` + módulos |
| `src/db.js` | Re-export deprecated — código migrado para `services/db.js` |
| `src/counter.js` | Artefato do template Vite, nunca usado |
| `src/style.css` | CSS do template Vite, incompatível com o tema atual |
| `src/assets/` | `vite.svg`, `javascript.svg`, `hero.png` — artefatos de template |
| `public/1.svg` | Logo antigo substituído por `logo-deitada.svg` e `logo-quadrada.svg` |
| `public/logo.png` | Arquivo temporário de debug |

---

## Estado Atual

```
src/
├── main-new.js          # Entry point ativo
├── services/            # 8 serviços (db, auth, ui, sync, pdf, comunicacao, contacts, index)
└── modules/             # 8 módulos (4 ativos + 4 placeholders)

public/
├── logo-deitada.svg     # Logo horizontal (splash)
├── logo-quadrada.svg    # Logo ícone (login)
└── ...                  # favicon, icons, manifest, sw, brands/
```

Veja [ARQUITETURA.md](./ARQUITETURA.md) para a estrutura completa atualizada.

---

## Convenções em vigor

- Cada módulo recebe `(mainContent, headerContent)` como parâmetros
- Funções expostas globalmente via `window.X` em `main-new.js`
- Imports sempre de `../services/<nome>.js` — nunca de caminhos relativos entre módulos
- IndexedDB é a única fonte de verdade — sem estado global em memória
- localStorage apenas para auth (`jampa_*`) e preferências de UI
