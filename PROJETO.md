# Rádio Web Amaral — Memória do Projeto

---

## Visão Geral

**Rádio Web Amaral** é um player de web rádio estático construído com HTML, CSS e JavaScript puro.
Reproduz uma playlist de vídeos do YouTube com crossfade automático, vinheta de abertura e suporte a
background playback em dispositivos móveis via APIs modernas do browser.

| Campo | Valor |
|---|---|
| **Dono / Cliente** | Rodolfo Cabral Junior |
| **URL de produção** | https://radioamaral.cabralvestecnologia.com.br |
| **Hospedagem** | HostGator — subdomínio de `cabralvestecnologia.com.br` |
| **Repositório GitHub** | https://github.com/Rodolfo-Cabral-junior/radio-amaral |
| **Branch principal** | `main` |
| **Deploy** | Automático via webhook GitHub → `deploy.php` no servidor |

---

## Stack e Tecnologias

| Camada | Tecnologia | Detalhes |
|---|---|---|
| Markup | **HTML5** | Semântico (`header`, `main`, `section`, `aside`, `footer`) |
| Estilos | **CSS3 puro** | Variáveis custom, flexbox, glassmorphism, keyframe animations |
| Lógica | **JavaScript ES6+ vanilla** | Sem frameworks ou bundlers |
| Áudio/Vídeo | **YouTube IFrame API** | Dois players ocultos (A e B) para crossfade |
| Vinheta | **HTML `<audio>`** | Arquivo `.ogg` local |
| PWA | **Web App Manifest** + **Service Worker** | Cache offline, instalação no celular |
| Background playback | **Media Session API** | Controles na tela de bloqueio e central de controle |
| Tela sempre ativa | **Wake Lock API** | Evita suspensão do dispositivo durante reprodução |
| Retomada automática | **Visibility API** | Detecta retorno ao app e retoma o player |
| Versionamento | **Git + GitHub** | Push → webhook → deploy automático |

---

## Estrutura de Arquivos

```
E:\RADIO AMARAL\
│
├── index.html              # Interface principal: player + playlist + header + footer
├── manifest.json           # Manifesto PWA (nome, ícones, start_url, display standalone)
├── service-worker.js       # Cache offline e estratégia network-first
├── playlist.json           # Array de faixas: id YouTube, title, artist
├── logoradio.jpeg          # Logo da rádio (131 KB) — usada no header e como ícone PWA
├── README.md               # Documentação técnica básica
├── PROJETO.md              # Este arquivo — memória completa do projeto
│
└── assets/
    ├── background.png      # Imagem de fundo do site (206 KB) — papel de parede gospel
    ├── audio/
    │   └── vinheta.ogg     # Áudio da vinheta de abertura (45 KB)
    ├── css/
    │   └── style.css       # Folha de estilos completa (36 KB)
    └── js/
        └── radio.js        # Toda a lógica da rádio (23 KB)
```

---

## Funcionalidades Implementadas

### Player Dual com Crossfade
- Dois players YouTube ocultos (`#player-a` e `#player-b`) criados via IFrame API
- Variável `activePlayer` (`'a'` ou `'b'`) controla qual está no ar
- `startProgress()` verifica a cada **500ms** se a faixa atingiu **90%** da duração
- `startCrossfade()` executa o crossfade em **20 passos × 500ms = 10 segundos**:
  - Player atual: volume `100% → 0%`
  - Próximo player: volume `0% → 100%`
  - Ao final: troca `activePlayer`, atualiza `currentIndex`

### Vinheta de Abertura
- Só toca **uma vez**, na primeira vez que o usuário clica em play (`vinhetaTocada = false`)
- Fluxo:
  1. Carrega primeira faixa no `playerA` em **volume 20%** (música de fundo)
  2. Toca `assets/audio/vinheta.ogg` via `<audio>` HTML
  3. Exibe "Rádio Web Amaral no ar!" e "Bem-vindo!" na UI
  4. Ao término da vinheta: **fade out em 2s** (8 passos × 250ms)
  5. Chama `playTrack(0)` para iniciar a playlist normalmente

### Background Playback Mobile
| API | Comportamento |
|---|---|
| **Media Session API** | Registra controles na tela de bloqueio (play, pause, próxima, anterior, stop). Atualiza thumbnail, título e artista via `MediaMetadata`. Sincroniza posição via `setPositionState()` |
| **Wake Lock API** | Solicita `'screen'` wake lock ao iniciar reprodução; libera no pause; reativa automaticamente se o sistema liberar |
| **Visibility API** | Ouve `visibilitychange`; ao voltar ao app (`'visible'`), verifica se o player parou e retoma; reativa Wake Lock se necessário |

### PWA
- `manifest.json`: `display: standalone`, `start_url: /?source=pwa`, ícones 192×192 e 512×512
- `service-worker.js`: estratégia **network-first** com fallback para cache; ignora requisições do YouTube; valida `response.ok` antes de cachear; remove caches de versões anteriores na ativação
- Registrado no `index.html` via `navigator.serviceWorker.register('/service-worker.js')`

### Visual Gospel Profissional
- **Background**: `assets/background.png` com `background-attachment: fixed`
- **Overlay**: `body::before` com `rgba(0,0,0,0.55)` + gradiente para legibilidade
- **Glassmorphism**: `backdrop-filter: blur(12px)` + `rgba(0,0,0,0.50)` nos cards
- **Identidade dourada**: `#c9a84c` em títulos, bordas, barra de progresso e itens ativos
- **Ondas de áudio**: 11 barras CSS animadas com `keyframes wave-bar`, ativadas no play
- **Microfone SVG decorativo** e notas musicais (`♪ ♫`) no header

### Controles e UI
- Botões: **Anterior**, **Play/Pause**, **Próxima**
- Slider de volume com preenchimento dourado sincronizado via `background-size`
- Barra de progresso com tempo atual e total
- Playlist lateral clicável com item ativo destacado
- Indicador de crossfade/vinheta no rodapé (dot animado)
- Layout **responsivo**: coluna única em mobile (≤ 768px)

---

## Playlist Atual

| # | ID YouTube | Título | Artista |
|---|---|---|---|
| 1 | `9TrpWVNHBzQ` | Da-me Um Coracao Segundo O Seu Coracao | Thalles Roberto |
| 2 | `GqqTinUW5pc` | Gospel Blues - Madeiro Lavrado | Hinos Com IA |
| 3 | `98yLmYRV99U` | Forte Demais - DEUS TREMENDO | Shirley Carvalhaes |

Para adicionar faixas, edite `playlist.json` seguindo a estrutura:
```json
{ "id": "ID_YOUTUBE_11_CHARS", "title": "Título da Música", "artist": "Artista" }
```

---

## Fluxo de Deploy

```
[Dev local — E:\RADIO AMARAL]
        ↓
   git add .
   git commit -m "mensagem"
   git push origin main
        ↓
[GitHub — radio-amaral]
        ↓  (webhook POST)
[HostGator — radioamaral.cabralvestecnologia.com.br]
   deploy.php
   secret: radioamaral2026
   ação: git pull origin main
```

**Comandos de deploy padrão:**
```bash
git add .
git commit -m "feat: descrição da mudança"
git push origin main
```

---

## Limitações Conhecidas

| Limitação | Causa | Status |
|---|---|---|
| YouTube pausa ao trocar de app no Android | Política da YouTube IFrame API — reprodução requer foco | Mitigado com Visibility API (retoma ao voltar) |
| iOS Safari bloqueia background playback | Política de áudio da Apple — Web Audio só toca com interação do usuário ativa | Sem solução nativa via YouTube API |
| PWA ícones em JPEG | `logoradio.jpeg` como ícone — alguns dispositivos preferem PNG com fundo transparente | Futuro: gerar PNGs 192×192 e 512×512 dedicados |
| Playlist apenas via arquivo JSON | Sem painel admin — qualquer mudança exige edição manual e novo deploy | Futuro: painel admin ou integração com planilha |

---

## Próximos Passos

- [ ] Ícones PWA em PNG dedicados (192×192 e 512×512) para substituir `logoradio.jpeg`
- [ ] Mais faixas gospel na `playlist.json`
- [ ] Painel admin simples para gerenciar a playlist (ou edição via GitHub web)
- [ ] Testar instalação PWA no Android Chrome e iOS Safari
- [ ] Avaliar migração para stream de áudio direto (Zeno.fm, Radio.co) para resolver background playback no iOS
- [ ] Adicionar Google Analytics / evento de tracking para plays e troca de faixas
- [ ] Splash screen personalizada para PWA

---

## Histórico de Commits

| Hash | Mensagem |
|---|---|
| `a8f1df6` | feat: background gospel com imagem real + glassmorphism |
| `1295ba4` | feat: visual gospel profissional - background, glassmorphism e efeitos dourados |
| `d8454c2` | fix: corrige playlist.json |
| `06bd5ef` | feat: atualiza playlist com 3 novas faixas |
| `4fd870c` | feat: background playback mobile - Media Session, Wake Lock e Visibility API |
| `cdb50ce` | test: testando deploy automático |
| `1ffc4cb` | feat: projeto inicial - Rádio Web Amaral |

---

*Documento gerado em 07/04/2026 — manter atualizado a cada sprint.*
