/**
 * SERVICE WORKER — Rádio Web Amaral
 * Responsável pelo cache dos assets estáticos e funcionamento offline básico.
 */

const CACHE_NAME = 'radio-amaral-v1';

/** Assets que serão cacheados na instalação do PWA */
const ASSETS_PARA_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/css/style.css',
    '/assets/js/radio.js',
    '/assets/audio/vinheta.ogg',
    '/playlist.json',
    '/logoradio.jpeg'
];

/* =========================================================
   INSTALAÇÃO — cacheia os assets estáticos
   ========================================================= */
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            console.log('[SW] Cacheando assets...');
            return cache.addAll(ASSETS_PARA_CACHE);
        })
    );
    /* Ativa imediatamente sem esperar abas antigas fecharem */
    self.skipWaiting();
});

/* =========================================================
   ATIVAÇÃO — remove caches antigos
   ========================================================= */
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys
                    .filter(function (key) { return key !== CACHE_NAME; })
                    .map(function (key) {
                        console.log('[SW] Removendo cache antigo:', key);
                        return caches.delete(key);
                    })
            );
        })
    );
    /* Assume controle de todas as abas imediatamente */
    self.clients.claim();
});

/* =========================================================
   FETCH — estratégia: network first, fallback para cache
   Assets do YouTube (thumbnails, API) sempre buscam da rede.
   Assets locais usam cache como fallback.
   ========================================================= */
self.addEventListener('fetch', function (event) {
    const url = event.request.url;

    /* Ignora requisições do YouTube IFrame API e streams */
    if (url.includes('youtube.com') || url.includes('ytimg.com')) {
        return; /* Deixa o navegador lidar normalmente */
    }

    event.respondWith(
        fetch(event.request)
            .then(function (response) {
                /* Cacheia apenas requisições GET com respostas válidas (2xx).
                   Evita persistir erros 404/500 no cache. */
                if (
                    event.request.method === 'GET' &&
                    response.ok &&
                    response.type !== 'opaque'
                ) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(function () {
                /* Se offline, tenta retornar do cache */
                return caches.match(event.request).then(function (cached) {
                    if (cached) return cached;
                    /* Fallback final: retorna index.html */
                    return caches.match('/index.html');
                });
            })
    );
});
