import { handleWebSocket, handleRelayInfoRequest, handleNIP05Request, serveFavicon } from './handlers/websocket.mjs';
import { processEvent } from './handlers/event.mjs';
import { processReq } from './handlers/req.mjs';
import { processDeletionEvent } from './handlers/deletion.mjs';

export const relayInfo = {
  name: "Nosflare",
  description: "A serverless Nostr relay through Cloudflare Worker and R2 bucket",
  pubkey: "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
  contact: "lucas@censorship.rip",
  supported_nips: [1, 2, 4, 5, 9, 11, 12, 15, 16, 17, 20, 22, 33, 40, 45],
  software: "https://github.com/Spl0itable/nosflare",
  version: "4.19.18",
};

export const relayIcon = "https://workers.cloudflare.com/resources/logo/logo.svg";

export const nip05Users = {
  "lucas": "d49a9023a21dba1b3c8306ca369bf3243d8b44b8f0b6d1196607f7b0990fa8df",
  // ... more NIP-05 verified users
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      if (request.headers.get("Upgrade") === "websocket") {
        return handleWebSocket(request, env, ctx);
      } else if (request.headers.get("Accept") === "application/nostr+json") {
        return handleRelayInfoRequest();
      } else {
        return new Response("Connect using a Nostr client", { status: 200 });
      }
    } else if (url.pathname === "/.well-known/nostr.json") {
      return handleNIP05Request(url);
    } else if (url.pathname === "/favicon.ico") {
      return serveFavicon();
    } else {
      return new Response("Invalid request", { status: 400 });
    }
  }
};