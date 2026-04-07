/**
 * RÁDIO WEB AMARAL — Lógica Principal
 * Utiliza a YouTube IFrame API com dois players para crossfade suave.
 * Todos os comentários estão em português.
 */

/* =========================================================
   VARIÁVEIS GLOBAIS
   ========================================================= */

/** @type {YT.Player} Player principal A */
let playerA = null;
/** @type {YT.Player} Player auxiliar B */
let playerB = null;

/** Qual player está tocando agora: 'a' ou 'b' */
let activePlayer = 'a';

/** Índice da música tocando atualmente */
let currentIndex = 0;

/** Índice da próxima música (calculado dinamicamente) */
let nextIndex = 1;

/** Rádio está reproduzindo? */
let isPlaying = false;

/** Crossfade em andamento? */
let crossfading = false;

/** Volume global (0–100) */
let volume = 80;

/** Array com as faixas carregadas do playlist.json */
let playlist = [];

/** ID do intervalo do progresso */
let progressInterval = null;
/** Controla se a vinheta de abertura já foi tocada */
let vinhetaTocada = false;
/* =========================================================
   REFERÊNCIAS AO DOM
   ========================================================= */
const elThumbnail = document.getElementById('thumbnail');
const elTrackTitle = document.getElementById('track-title');
const elTrackArtist = document.getElementById('track-artist');
const elProgressFill = document.getElementById('progress-bar-fill');
const elTimeCurrent = document.getElementById('time-current');
const elTimeTotal = document.getElementById('time-total');
const elPlaylistList = document.getElementById('playlist-list');
const elCrossfadeInd = document.getElementById('crossfade-indicator');
const elBtnPlay = document.getElementById('btn-play');
const elIconPlay = document.getElementById('icon-play');
const elIconPause = document.getElementById('icon-pause');
const elVolumeSlider = document.getElementById('volume-slider');
const elVolumeLabel = document.getElementById('volume-label');
/** Elemento de áudio da vinheta de abertura */
const elAudioVinheta = document.getElementById('audio-vinheta');

/* =========================================================
   INICIALIZAÇÃO DA YOUTUBE IFRAME API
   Chamada automaticamente pelo script da API quando pronta.
   ========================================================= */
function onYouTubeIframeAPIReady() {
    /* Carrega a playlist antes de criar os players */
    carregarPlaylist();
}

/**
 * Carrega o arquivo playlist.json via fetch e inicializa os players.
 */
function carregarPlaylist() {
    fetch('playlist.json')
        .then(function (response) {
            if (!response.ok) {
                throw new Error('Erro ao carregar playlist.json: ' + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            playlist = data.tracks || [];

            if (playlist.length === 0) {
                console.error('Playlist vazia!');
                return;
            }

            /* Monta a lista visual da playlist */
            renderizarPlaylist();

            /* Cria os dois players YouTube ocultos */
            criarPlayers();
        })
        .catch(function (err) {
            console.error('Falha ao carregar playlist:', err);
        });
}

/* =========================================================
   CRIAÇÃO DOS PLAYERS YOUTUBE
   ========================================================= */

/**
 * Cria os dois players (A e B) com a YouTube IFrame API.
 * Ambos ficam ocultos via CSS; apenas o áudio é utilizado.
 */
function criarPlayers() {
    /* Player A — principal */
    playerA = new YT.Player('player-a', {
        height: '1',
        width: '1',
        playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            origin: window.location.origin || 'http://localhost'
        },
        events: {
            onReady: onPlayerAReady,
            onStateChange: onPlayerStateChange
        }
    });

    /* Player B — auxiliar para crossfade */
    playerB = new YT.Player('player-b', {
        height: '1',
        width: '1',
        playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            origin: window.location.origin || 'http://localhost'
        },
        events: {
            onReady: function () { /* Player B pronto, aguarda uso */ }
        }
    });
}

/** Chamado quando o Player A está pronto para uso */
function onPlayerAReady() {
    /* Carrega a primeira música no player A (sem tocar ainda) */
    playerA.cueVideoById(playlist[currentIndex].id);
    playerA.setVolume(volume);

    /* Atualiza a interface com os dados iniciais */
    updateUI();

    /* Conecta os eventos dos controles */
    vincularEventos();
}

/**
 * Monitora mudanças de estado do player ativo.
 * Não é necessário tratar o fim manual aqui pois o crossfade
 * é acionado pela verificação de 90% no startProgress().
 */
function onPlayerStateChange(event) {
    /* YT.PlayerState.PLAYING === 1 */
    if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        updateIconePlay();
    }
    /* YT.PlayerState.PAUSED === 2 ou ENDED === 0 */
    if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        /* Só marca como parado se não estiver em crossfade */
        if (!crossfading) {
            isPlaying = false;
            updateIconePlay();
        }
    }
}

/* =========================================================
   CONTROLES PRINCIPAIS
   ========================================================= */

/**
 * Alterna entre play e pause da rádio.
 * Na primeira vez que o usuário clica em play, toca a vinheta de abertura.
 */
function togglePlay() {
    if (!playlist.length) return;

    /* Primeira execução: toca vinheta antes da playlist */
    if (!vinhetaTocada) {
        vinhetaTocada = true;
        tocarVinheta();
        return;
    }

    const player = getPlayerAtivo();
    if (!player) return;

    if (isPlaying) {
        /* Pausa */
        player.pauseVideo();
        clearInterval(progressInterval);
        progressInterval = null;
        isPlaying = false;
    } else {
        /* Retoma ou inicia a reprodução */
        const state = player.getPlayerState();
        if (state === YT.PlayerState.UNSTARTED || state === -1 || state === YT.PlayerState.CUED) {
            player.loadVideoById(playlist[currentIndex].id);
            player.setVolume(volume);
        } else {
            player.playVideo();
        }
        isPlaying = true;
        startProgress();
    }

    updateIconePlay();
}

/**
 * Carrega e reproduz uma faixa específica pelo índice.
 * @param {number} index - Índice na playlist
 */
function playTrack(index) {
    if (index < 0 || index >= playlist.length) return;

    /* Cancela crossfade em andamento */
    crossfading = false;
    desativarIndicadorCrossfade();

    /* Para o intervalo de progresso anterior */
    clearInterval(progressInterval);
    progressInterval = null;

    /* Para ambos os players */
    if (playerA) playerA.stopVideo();
    if (playerB) playerB.stopVideo();

    /* Define índices */
    currentIndex = index;
    nextIndex = (currentIndex + 1) % playlist.length;
    activePlayer = 'a';

    /* Restaura volumes */
    if (playerA) playerA.setVolume(volume);
    if (playerB) playerB.setVolume(0);

    /* Carrega e toca no player A */
    playerA.loadVideoById(playlist[currentIndex].id);
    isPlaying = true;

    /* Atualiza interface */
    updateUI();
    updateIconePlay();
    startProgress();
}

/**
 * Avança para a próxima música.
 */
function nextTrack() {
    const novoIndex = (currentIndex + 1) % playlist.length;
    playTrack(novoIndex);
}

/**
 * Volta para a música anterior.
 */
function prevTrack() {
    const novoIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playTrack(novoIndex);
}

/* =========================================================
   VINHETA DE ABERTURA
   ========================================================= */

/**
 * Toca a vinheta de abertura uma única vez.
 * Durante a vinheta:
 *   - Música de fundo (primeira faixa) toca em volume 20%
 *   - Exibe mensagem de boas-vindas na UI
 * Ao terminar:
 *   - Fade out da música de fundo (2 segundos)
 *   - Inicia a playlist normalmente com playTrack(0)
 */
function tocarVinheta() {
    if (!playerA) return;

    /* Define thumbnail e textos de boas-vindas */
    const idFundoVinheta = playlist[0].id;
    elThumbnail.src = 'https://img.youtube.com/vi/' + idFundoVinheta + '/mqdefault.jpg';
    elThumbnail.alt = 'Rádio Web Amaral no ar!';
    elTrackTitle.textContent = 'Rádio Web Amaral no ar!';
    elTrackArtist.textContent = 'Bem-vindo!';

    /* Ativa indicador visual de vinheta */
    elCrossfadeInd.classList.add('vinheta-ativa');
    elCrossfadeInd.classList.add('ativo');
    elCrossfadeInd.querySelector('.crossfade-text').textContent = 'Vinheta de abertura';

    /* Mostra ícone de pause (a rádio está "tocando" a vinheta) */
    isPlaying = true;
    updateIconePlay();

    /* Carrega música de fundo no playerA em volume baixo e inicia */
    playerA.setVolume(20);
    playerA.loadVideoById(idFundoVinheta);

    /* Toca o áudio da vinheta */
    if (elAudioVinheta) {
        elAudioVinheta.currentTime = 0;
        elAudioVinheta.play().catch(function (err) {
            console.warn('Não foi possível tocar a vinheta:', err);
        });

        /* Quando a vinheta terminar, faz fade out e inicia playlist */
        elAudioVinheta.addEventListener('ended', finalizarVinheta, { once: true });
    } else {
        /* Se não houver arquivo de vinheta, inicia playlist diretamente */
        finalizarVinheta();
    }
}

/**
 * Executada quando o áudio da vinheta termina.
 * Faz fade out da música de fundo em 2 segundos e inicia a playlist.
 */
function finalizarVinheta() {
    /* Remove indicador de vinheta */
    elCrossfadeInd.classList.remove('vinheta-ativa');
    elCrossfadeInd.classList.remove('ativo');
    elCrossfadeInd.querySelector('.crossfade-text').textContent = 'Crossfade ativo';

    /* Fade out da música de fundo: 20% → 0% em 2 segundos (8 passos × 250ms) */
    const passosFade = 8;
    const intervaloFade = 250;
    let passoAtual = 0;
    const volInicial = 20;

    const fadeOut = setInterval(function () {
        passoAtual++;
        const novoVol = Math.round(volInicial * (1 - passoAtual / passosFade));
        playerA.setVolume(Math.max(0, novoVol));

        if (passoAtual >= passosFade) {
            clearInterval(fadeOut);
            playerA.stopVideo();
            /* Restaura volume principal e inicia playlist normalmente */
            playerA.setVolume(volume);
            playTrack(0);
        }
    }, intervaloFade);
}

/* =========================================================
   PROGRESSO E CROSSFADE
   ========================================================= */

/**
 * Inicia o intervalo de atualização da barra de progresso (500ms).
 * Também detecta o momento de iniciar o crossfade (90% da música).
 */
function startProgress() {
    /* Evita múltiplos intervalos */
    if (progressInterval) clearInterval(progressInterval);

    progressInterval = setInterval(function () {
        const player = getPlayerAtivo();
        if (!player) return;

        /* Estado atual do player */
        const state = player.getPlayerState();
        if (state !== YT.PlayerState.PLAYING) return;

        const current = player.getCurrentTime() || 0;
        const duration = player.getDuration() || 0;

        if (duration <= 0) return;

        /* Calcula porcentagem e atualiza barra */
        const pct = (current / duration) * 100;
        elProgressFill.style.width = pct.toFixed(2) + '%';

        /* Atualiza tempos exibidos */
        elTimeCurrent.textContent = formatTime(current);
        elTimeTotal.textContent = formatTime(duration);

        /* Dispara crossfade ao atingir 90% (só uma vez por faixa) */
        if (pct >= 90 && !crossfading) {
            startCrossfade();
        }
    }, 500);
}

/**
 * Realiza o crossfade entre o player ativo e o próximo.
 * - Carrega a próxima música no player inativo (volume 0)
 * - Em 20 passos de 500ms (10s):
 *     fade out player atual: 100% → 0%
 *     fade in  próximo:        0% → 100%
 * - Ao final: troca activePlayer e atualiza currentIndex
 */
function startCrossfade() {
    if (crossfading) return;
    crossfading = true;

    /* Calcula próximo índice */
    nextIndex = (currentIndex + 1) % playlist.length;

    /* Determina player ativo e inativo */
    const playerAtual = getPlayerAtivo();
    const playerProximo = getPlayerInativo();

    if (!playerAtual || !playerProximo) return;

    /* Ativa indicador visual no rodapé */
    ativarIndicadorCrossfade();

    /* Carrega a próxima música no player inativo, volume 0 */
    playerProximo.setVolume(0);
    playerProximo.loadVideoById(playlist[nextIndex].id);

    /* Atualiza UI imediatamente com dados da próxima faixa */
    /* (thumbnail e título trocam ao iniciar o fade) */

    const passosTotais = 20;       /* 20 × 500ms = 10 segundos */
    const intervaloMs = 500;
    let passo = 0;

    const fadeInterval = setInterval(function () {
        passo++;

        /* Proporção: 0.0 (início) → 1.0 (fim) */
        const proporcao = passo / passosTotais;

        /* Volume do player atual: decresce de volume → 0 */
        const volAtual = Math.round(volume * (1 - proporcao));
        /* Volume do próximo: cresce de 0 → volume */
        const volProximo = Math.round(volume * proporcao);

        playerAtual.setVolume(Math.max(0, volAtual));
        playerProximo.setVolume(Math.min(volume, volProximo));

        /* Atualiza UI na metade do crossfade */
        if (passo === Math.floor(passosTotais / 2)) {
            currentIndex = nextIndex;
            updateUI();
        }

        /* Fim do crossfade */
        if (passo >= passosTotais) {
            clearInterval(fadeInterval);

            /* Para o player anterior */
            playerAtual.stopVideo();
            playerAtual.setVolume(0);

            /* Garante volume correto no player que entrou */
            playerProximo.setVolume(volume);

            /* Troca o player ativo */
            activePlayer = activePlayer === 'a' ? 'b' : 'a';
            currentIndex = nextIndex;
            nextIndex = (currentIndex + 1) % playlist.length;

            crossfading = false;
            desativarIndicadorCrossfade();

            /* Atualiza UI final */
            updateUI();
        }
    }, intervaloMs);
}

/* =========================================================
   VOLUME
   ========================================================= */

/**
 * Ajusta o volume do player ativo.
 * @param {number} value - Valor de 0 a 100
 */
function setVolume(value) {
    volume = parseInt(value, 10);
    const player = getPlayerAtivo();
    if (player) player.setVolume(volume);

    /* Atualiza label e preenchimento visual do slider */
    elVolumeLabel.textContent = volume + '%';
    elVolumeSlider.style.backgroundSize = volume + '% 100%';
}

/* =========================================================
   INTERFACE
   ========================================================= */

/**
 * Atualiza todos os elementos visuais com base na faixa atual.
 */
function updateUI() {
    if (!playlist.length) return;

    const faixa = playlist[currentIndex];

    /* Thumbnail do YouTube */
    elThumbnail.src = 'https://img.youtube.com/vi/' + faixa.id + '/hqdefault.jpg';
    elThumbnail.alt = faixa.title + ' — ' + faixa.artist;

    /* Título e artista */
    elTrackTitle.textContent = faixa.title;
    elTrackArtist.textContent = faixa.artist;

    /* Marca item ativo na playlist */
    const itens = elPlaylistList.querySelectorAll('.playlist-item');
    itens.forEach(function (item, i) {
        item.classList.toggle('active', i === currentIndex);
    });
}

/**
 * Alterna os ícones de play e pause no botão principal.
 */
function updateIconePlay() {
    if (isPlaying) {
        elIconPlay.style.display = 'none';
        elIconPause.style.display = 'block';
    } else {
        elIconPlay.style.display = 'block';
        elIconPause.style.display = 'none';
    }
}

/**
 * Renderiza os itens da playlist no DOM.
 */
function renderizarPlaylist() {
    elPlaylistList.innerHTML = '';

    playlist.forEach(function (faixa, index) {
        const li = document.createElement('li');
        li.className = 'playlist-item' + (index === currentIndex ? ' active' : '');
        li.innerHTML =
            '<span class="playlist-item-title">' + escapeHtml(faixa.title) + '</span>' +
            '<span class="playlist-item-artist">' + escapeHtml(faixa.artist) + '</span>';

        /* Clique no item toca a música */
        li.addEventListener('click', function () {
            playTrack(index);
        });

        elPlaylistList.appendChild(li);
    });
}

/**
 * Ativa o indicador de crossfade no rodapé.
 */
function ativarIndicadorCrossfade() {
    elCrossfadeInd.classList.add('ativo');
}

/**
 * Desativa o indicador de crossfade no rodapé.
 */
function desativarIndicadorCrossfade() {
    elCrossfadeInd.classList.remove('ativo');
}

/* =========================================================
   UTILITÁRIOS
   ========================================================= */

/**
 * Retorna o player YouTube atualmente ativo.
 * @returns {YT.Player|null}
 */
function getPlayerAtivo() {
    if (activePlayer === 'a') return playerA;
    if (activePlayer === 'b') return playerB;
    return null;
}

/**
 * Retorna o player YouTube atualmente inativo (para crossfade).
 * @returns {YT.Player|null}
 */
function getPlayerInativo() {
    if (activePlayer === 'a') return playerB;
    if (activePlayer === 'b') return playerA;
    return null;
}

/**
 * Formata segundos para string "M:SS".
 * @param {number} segundos
 * @returns {string}
 */
function formatTime(segundos) {
    if (!segundos || isNaN(segundos)) return '0:00';
    const min = Math.floor(segundos / 60);
    const sec = Math.floor(segundos % 60);
    return min + ':' + (sec < 10 ? '0' : '') + sec;
}

/**
 * Escapa caracteres HTML para evitar injeção de tags na playlist.
 * @param {string} texto
 * @returns {string}
 */
function escapeHtml(texto) {
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* =========================================================
   VINCULAÇÃO DE EVENTOS DOS CONTROLES
   ========================================================= */

/**
 * Conecta todos os botões e controles da interface.
 * Chamado após os players estarem prontos.
 */
function vincularEventos() {
    /* Botão play/pause */
    elBtnPlay.addEventListener('click', togglePlay);

    /* Botão próxima */
    document.getElementById('btn-next').addEventListener('click', nextTrack);

    /* Botão anterior */
    document.getElementById('btn-prev').addEventListener('click', prevTrack);

    /* Slider de volume */
    elVolumeSlider.addEventListener('input', function () {
        setVolume(this.value);
    });

    /* Sincroniza estado visual inicial do slider */
    setVolume(elVolumeSlider.value);
}
