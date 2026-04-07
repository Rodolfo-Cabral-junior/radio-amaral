# Rádio Web Amaral

Player de web rádio com playlist do YouTube, crossfade automático e vinheta de abertura.

## Estrutura do Projeto

```
RADIO AMARAL/
├── index.html              # Estrutura da interface
├── playlist.json           # Faixas da rádio
├── logoradio.jpeg          # Logo da estação
└── assets/
    ├── css/
    │   └── style.css       # Estilos (dark theme + neon)
    ├── js/
    │   └── radio.js        # Lógica principal
    └── audio/
        └── vinheta.ogg     # Áudio da vinheta de abertura
```

## Funcionalidades

- **Dual Player com Crossfade** — dois players YouTube (A e B) ocultos; fade automático de 10s ao atingir 90% da faixa atual
- **Vinheta de Abertura** — toca `vinheta.ogg` na primeira vez que o usuário dá play, com música de fundo em 20% e fade out ao final
- **Playlist Dinâmica** — carregada via `fetch` do `playlist.json`; clique em qualquer faixa para tocar diretamente
- **Controles** — play/pause, próxima, anterior, slider de volume com feedback visual
- **Barra de Progresso** — atualizada a cada 500ms com tempo atual e total
- **Indicador de Crossfade/Vinheta** — dot animado no rodapé muda de azul (crossfade) para vermelho (vinheta)
- **Responsivo** — layout em coluna no mobile (≤ 768px)

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Markup | HTML5 semântico |
| Estilos | CSS3 puro com variáveis custom |
| Lógica | JavaScript ES5+ vanilla |
| Áudio/Vídeo | YouTube IFrame API |

## Identidade Visual

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0a0a0a` | Fundo principal |
| `--surface` | `#141414` | Cards |
| `--neon` | `#00BFFF` | Destaques, botão play, progresso |
| `--red` | `#CC0000` | Hover, vinheta ativa |
| `--white` | `#FFFFFF` | Texto principal |
| `--gray` | `#888888` | Texto secundário |

## Como Usar

O projeto é estático — basta servir a pasta via qualquer servidor HTTP local (necessário pelo CORS do `fetch` e da YouTube API):

```bash
# Python
python -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code
# Extensão Live Server → "Open with Live Server"
```

Acesse `http://localhost:8080` no navegador.

> **Nota:** Abrir `index.html` diretamente como `file://` não funciona — o `fetch('playlist.json')` e a YouTube IFrame API exigem um servidor HTTP.

## Gerenciando a Playlist

Edite `playlist.json` adicionando objetos com `id` (ID do vídeo no YouTube), `title` e `artist`:

```json
{
  "tracks": [
    { "id": "VIDEO_ID_AQUI", "title": "Nome da Música", "artist": "Nome do Artista" }
  ]
}
```

O ID do vídeo é a parte após `?v=` na URL do YouTube (ex: `youtube.com/watch?v=`**`sLQ0cRL8UFs`**).

## Substituindo a Vinheta

Substitua `assets/audio/vinheta.ogg` por qualquer arquivo de áudio compatível com o navegador (`.ogg`, `.mp3`, `.wav`). Atualize o atributo `src` no `index.html` se mudar o formato:

```html
<audio id="audio-vinheta" src="assets/audio/vinheta.mp3" preload="auto"></audio>
```

## Fluxo do Crossfade

```
Faixa tocando (Player A)
        │
        ▼ 90% da duração atingida
startCrossfade()
        │
        ├─ Carrega próxima faixa no Player B (volume 0)
        │
        ├─ 20 passos × 500ms = 10 segundos
        │     Player A: volume 100% → 0%
        │     Player B: volume   0% → 100%
        │
        ▼ Passo 10 (metade): atualiza UI com dados da nova faixa
        ▼ Passo 20 (fim):    para Player A, troca activePlayer para 'b'
```

---

&copy; 2026 Rádio Web Amaral
