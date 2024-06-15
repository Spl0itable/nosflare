import worker from './dist/worker.js';

addEventListener('fetch', event => {
  event.respondWith(worker.fetch(event.request, env, ctx));
});

addEventListener('scheduled', event => {
  event.waitUntil(worker.scheduled(event, env, ctx));
});