/**
 * RÁDIO WEB AMARAL — Lógica Principal
 * Utiliza a YouTube IFrame API com dois players para crossfade suave.
 * Inclui: Media Session API, Wake Lock API e Visibility API.
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

/** Referência ao Wake Lock ativo */
let wakeLock = null;

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
   WAKE LOCK API
   Mantém o dispositivo ativo enquanto a rádio toca.
   Funciona no Android Chrome e alguns navegadores modernos.
   ========================================================= */

/**
 * Solicita o Wake Lock para evitar que o dispositivo suspenda.
 */
async function ativarWakeLock() {
    if (!('wakeLock' in navigator)) return; /* Não suportado */
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake Lock ativado.');

        /* Quando o sistema libera o wake lock (ex: tela desliga),
           tenta reativar automaticamente se ainda estiver tocando. */
        wakeLock.addEventListener('release', function () {
            console.log('Wake Lock liberado pelo sistema.');
            if (isPlaying) ativarWakeLock();
        });
    } catch (err) {
        console.warn('Wake Lock não disponível:', err.message);
    }
}

/**
 * Libera o Wake Lock quando a rádio for pausada.
 */
async function liberarWakeLock() {
    if (wakeLock) {
        try {
            await wakeLock.release();
            wakeLock = null;
            console.log('Wake Lock liberado manualmente.');
        } catch (err) {
            console.warn('Erro ao liberar Wake Lock:', err.message);
        }
    }
}

/* =========================================================
   VISIBILITY API
   Detecta quando o usuário sai/volta ao app e tenta retomar.
   ========================================================= */

/**
 * Registra o listener de visibilidade da página.
 * Quando o usuário volta ao app após sair, verifica se a rádio
 * estava tocando e retoma automaticamente se necessário.
 */
function registrarVisibilityAPI() {
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            console.log('App voltou ao foco.');

            /* Reativa o Wake Lock se necessário */
            if (isPlaying && !wakeLock) {
                ativarWakeLock();
            }

            /* Verifica se o player parou enquanto o app estava em background */
            const player = getPlayerAtivo();
            if (player && isPlaying) {
                const state = player.getPlayerState();
                /* Se não estiver tocando (parado, pausado ou em buffer), retoma */
                if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
                    console.log('Player parado em background. Retomando...');
                    player.playVideo();
                    if (!progressInterval) startProgress();
                }
            }
        } else {
            console.log('App foi para background.');
        }
    });
}

/* =========================================================
   MEDIA SESSION API
   Registra a rádio como mídia do sistema operacional.
   Aparece na tela de bloqueio, central de controle (iOS/Android)
   e permite controle por fones de ouvido e smartwatches.
   ========================================================= */

/**
 * Inicializa os handlers da Media Session API.
 * Deve ser chamado uma única vez após os players estarem prontos.
 */
function inicializarMediaSession() {
    if (!('mediaSession' in navigator)) {
        console.warn('Media Session API não suportada neste navegador.');
        return;
    }

    /* Registra as ações de controle de mídia do sistema */
    navigator.mediaSession.setActionHandler('play', function () {
        const player = getPlayerAtivo();
        if (player) {
            player.playVideo();
            isPlaying = true;
            updateIconePlay();
            startProgress();
            ativarWakeLock();
            atualizarMediaSession();
        }
    });

    navigator.mediaSession.setActionHandler('pause', function () {
        const player = getPlayerAtivo();
        if (player) {
            player.pauseVideo();
            clearInterval(progressInterval);
            progressInterval = null;
            isPlaying = false;
            updateIconePlay();
            liberarWakeLock();
            atualizarMediaSession();
        }
    });

    navigator.mediaSession.setActionHandler('nexttrack', function () {
        nextTrack();
    });

    navigator.mediaSession.setActionHandler('previoustrack', function () {
        prevTrack();
    });

    /* Stop — alguns dispositivos enviam essa ação */
    navigator.mediaSession.setActionHandler('stop', function () {
        const player = getPlayerAtivo();
        if (player) {
            player.stopVideo();
            clearInterval(progressInterval);
            progressInterval = null;
            isPlaying = false;
            updateIconePlay();
            liberarWakeLock();
        }
    });

    console.log('Media Session API inicializada.');
}

/**
 * Atualiza os metadados exibidos na tela de bloqueio e central de controle.
 * Deve ser chamado sempre que a faixa mudar.
 */
function atualizarMediaSession() {
    if (!('mediaSession' in navigator)) return;
    if (!playlist.length) return;

    const faixa = playlist[currentIndex];
    const thumbUrl = 'https://img.youtube.com/vi/' + faixa.id + '/hqdefault.jpg';

    navigator.mediaSession.metadata = new MediaMetadata({
        title: faixa.title,
        artist: faixa.artist,
        album: 'Rádio Web Amaral',
        artwork: [
            { src: thumbUrl, sizes: '480x360', type: 'image/jpeg' }
        ]
    });

    /* Atualiza estado de reprodução */
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
}

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

    /* Inicializa Media Session API */
    inicializarMediaSession();

    /* Registra Visibility API */
    registrarVisibilityAPI();

    /* Atualiza metadados iniciais na tela de bloqueio */
    atualizarMediaSession();
}

/**
 * Monitora mudanças de estado do player ativo.
 */
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        updateIconePlay();
        atualizarMediaSession();
    }
    if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        if (!crossfading) {
            isPlaying = false;
            updateIconePlay();
            atualizarMediaSession();
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
        liberarWakeLock();
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
        ativarWakeLock();
    }

    updateIconePlay();
    atualizarMediaSession();
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
    ativarWakeLock();
    atualizarMediaSession();
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
 */
function tocarVinheta() {
    if (!playerA) return;

    const idFundoVinheta = playlist[0].id;
    elThumbnail.src = 'https://img.youtube.com/vi/' + idFundoVinheta + '/mqdefault.jpg';
    elThumbnail.alt = 'Rádio Web Amaral no ar!';
    elTrackTitle.textContent = 'Rádio Web Amaral no ar!';
    elTrackArtist.textContent = 'Bem-vindo!';

    elCrossfadeInd.classList.add('vinheta-ativa');
    elCrossfadeInd.classList.add('ativo');
    elCrossfadeInd.querySelector('.crossfade-text').textContent = 'Vinheta de abertura';

    isPlaying = true;
    updateIconePlay();
    ativarWakeLock();

    /* Atualiza Media Session com info da vinheta */
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Rádio Web Amaral no ar!',
            artist: 'Bem-vindo!',
            album: 'Rádio Web Amaral',
            artwork: [
                { src: 'https://img.youtube.com/vi/' + idFundoVinheta + '/hqdefault.jpg', sizes: '480x360', type: 'image/jpeg' }
            ]
        });
        navigator.mediaSession.playbackState = 'playing';
    }

    playerA.setVolume(20);
    playerA.loadVideoById(idFundoVinheta);

    if (elAudioVinheta) {
        elAudioVinheta.currentTime = 0;
        elAudioVinheta.play().catch(function (err) {
            console.warn('Não foi possível tocar a vinheta:', err);
        });
        elAudioVinheta.addEventListener('ended', finalizarVinheta, { once: true });
    } else {
        finalizarVinheta();
    }
}

/**
 * Executada quando o áudio da vinheta termina.
 */
function finalizarVinheta() {
    elCrossfadeInd.classList.remove('vinheta-ativa');
    elCrossfadeInd.classList.remove('ativo');
    elCrossfadeInd.querySelector('.crossfade-text').textContent = 'Crossfade ativo';

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
 */
function startProgress() {
    if (progressInterval) clearInterval(progressInterval);

    progressInterval = setInterval(function () {
        const player = getPlayerAtivo();
        if (!player) return;

        const state = player.getPlayerState();
        if (state !== YT.PlayerState.PLAYING) return;

        const current = player.getCurrentTime() || 0;
        const duration = player.getDuration() || 0;

        if (duration <= 0) return;

        const pct = (current / duration) * 100;
        elProgressFill.style.width = pct.toFixed(2) + '%';

        elTimeCurrent.textContent = formatTime(current);
        elTimeTotal.textContent = formatTime(duration);

        /* Atualiza posição na Media Session (para scrubbing na tela de bloqueio) */
        if ('mediaSession' in navigator && navigator.mediaSession.setPositionState) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: duration,
                    playbackRate: 1,
                    position: current
                });
            } catch (e) { /* Ignora erros de posição inválida */ }
        }

        if (pct >= 90 && !crossfading) {
            startCrossfade();
        }
    }, 500);
}

/**
 * Realiza o crossfade entre o player ativo e o próximo.
 */
function startCrossfade() {
    if (crossfading) return;
    crossfading = true;

    nextIndex = (currentIndex + 1) % playlist.length;

    const playerAtual = getPlayerAtivo();
    const playerProximo = getPlayerInativo();

    if (!playerAtual || !playerProximo) return;

    ativarIndicadorCrossfade();

    playerProximo.setVolume(0);
    playerProximo.loadVideoById(playlist[nextIndex].id);

    const passosTotais = 20;
    const intervaloMs = 500;
    let passo = 0;

    const fadeInterval = setInterval(function () {
        passo++;

        const proporcao = passo / passosTotais;
        const volAtual = Math.round(volume * (1 - proporcao));
        const volProximo = Math.round(volume * proporcao);

        playerAtual.setVolume(Math.max(0, volAtual));
        playerProximo.setVolume(Math.min(volume, volProximo));

        if (passo === Math.floor(passosTotais / 2)) {
            currentIndex = nextIndex;
            updateUI();
            atualizarMediaSession(); /* Atualiza tela de bloqueio na troca de faixa */
        }

        if (passo >= passosTotais) {
            clearInterval(fadeInterval);

            playerAtual.stopVideo();
            playerAtual.setVolume(0);
            playerProximo.setVolume(volume);

            activePlayer = activePlayer === 'a' ? 'b' : 'a';
            currentIndex = nextIndex;
            nextIndex = (currentIndex + 1) % playlist.length;

            crossfading = false;
            desativarIndicadorCrossfade();

            updateUI();
            atualizarMediaSession();
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

    elThumbnail.src = 'https://img.youtube.com/vi/' + faixa.id + '/hqdefault.jpg';
    elThumbnail.alt = faixa.title + ' — ' + faixa.artist;

    elTrackTitle.textContent = faixa.title;
    elTrackArtist.textContent = faixa.artist;

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

function getPlayerAtivo() {
    if (activePlayer === 'a') return playerA;
    if (activePlayer === 'b') return playerB;
    return null;
}

function getPlayerInativo() {
    if (activePlayer === 'a') return playerB;
    if (activePlayer === 'b') return playerA;
    return null;
}

function formatTime(segundos) {
    if (!segundos || isNaN(segundos)) return '0:00';
    const min = Math.floor(segundos / 60);
    const sec = Math.floor(segundos % 60);
    return min + ':' + (sec < 10 ? '0' : '') + sec;
}

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

function vincularEventos() {
    elBtnPlay.addEventListener('click', togglePlay);
    document.getElementById('btn-next').addEventListener('click', nextTrack);
    document.getElementById('btn-prev').addEventListener('click', prevTrack);

    elVolumeSlider.addEventListener('input', function () {
        setVolume(this.value);
    });

    setVolume(elVolumeSlider.value);
}