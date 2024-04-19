# Nosflare

Nosflare is a serverless [Nostr](https://github.com/fiatjaf/nostr) relay purpose-built for [Cloudflare Workers](https://workers.cloudflare.com/) and the [Cloudflare KV](https://www.cloudflare.com/products/workers-kv/) store. 

This relay is designed to be easy to deploy, scalable, and cost-effective, leveraging Cloudflare's edge computing infrastructure to provide a resilient relay for the Nostr decentralized social  protocol.

Most applicable NIPs are supported along with support for allowlisting or blocklisting pubkeys and event kinds, throttle number of events from a single pubkey through rate-limiting, block specific words or phrases, and support of [NIP-05](https://github.com/nostr-protocol/nips/blob/master/05.md) for @your-domain.com verified Nostr address.

## Supported NIPs

- Supports a range of [Nostr Improvement Proposals (NIPs)](https://github.com/fiatjaf/nostr/tree/master/nips), including NIPs 1, 2, 4, 5, 9, 11, 12, 15, 16, 20, 22, 33, and 40.

## Getting Started

### Prerequisites

- A [Cloudflare](https://www.cloudflare.com/plans/) account with Workers and KV Store enabled.
- [Node.js](https://nodejs.org/) and npm (for installing dependencies and running the build script).
- [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler/install-update) (optional) or access to the Cloudflare dashboard for deployment.

### Dependencies

This project requires the [@noble/curves](https://github.com/paulmillr/noble-curves) package for cryptographic operations and esbuild:

```
npm install @noble/curves
npm install -g esbuild
```

### Building

Clone the `worker.js` file to your machine. Edit the contents of `relayInfo` and `relayIcon` as desired to customize the relay name, icon, etc.
 
*Optional:*
- Edit the `nip05Users` section to add usernames and their hex pubkey for NIP-05 verified Nostr address.
- Edit the `blockedPubkeys` or `allowedPubkeys ` and `blockedEventKinds` or `allowedEventKinds` to either blocklist or allowlist pubkeys and event kinds.
- Edit `blockedContent` to block specific words and/or phrases.
- Edit `pubkeyRateLimiter` within processEvent function to specify throttled event kinds and event count per minute.

> How blocklisting and allowlisting works: If pubkey(s) or event kind(s) is in blocklist, only that pubkey(s) or event kind(s) will be blocked and all others allowed. Conversely, if pubkey(s) or event kind(s) is in allowlist, only that pubkey(s) and event kind(s) will be allowed and all others blocked.

We'll use `esbuild` to bundle the worker script:

```
esbuild worker.js --bundle --outfile=dist/worker.js --platform=neutral --target=es2020
```

The command assumes you're in the same directory as the `worker.js` file.

### Deployment

You can deploy Nosflare using either the Wrangler CLI, directly through the Cloudflare dashboard, or with the third-party deployment script:

#### Using Wrangler CLI

1. Configure your `wrangler.toml` with your Cloudflare account details.
2. Publish the worker:

```
wrangler publish
```
3. Add a custom domain or route (this will be the desired relay URL).
4. Create a KV namespace to store events. You can call it whatever you want.
5. Bind the `relayDb` variable to the KV namespace for the Worker in the Settings > Variables tab under the "KV Namespace Bindings" section.

#### Using Cloudflare Dashboard

1. Log in to your Cloudflare dashboard.
2. Go to the Workers section and create a new worker. You can call it whatever you'd like.
3. Copy the contents of `dist/worker.js` and paste into the online editor. See the `example.js` file in this repo for what a successfully bundled file should look like.
4. Save and deploy the worker.
5. Add a custom domain or route (this will be the desired relay URL).
6. Create a KV namespace to store events. You can call it whatever you want.
7. Bind the `relayDb` variable to the KV namespace for the Worker in the Settings > Variables tab under the "KV Namespace Bindings" section.

#### Using NosflareDeploy script

A third-party script to easily deploy Nosflare. Read more [here](https://github.com/PastaGringo/NosflareDeploy). 

## Usage

Nosflare acts as a Nostr relay. Users can connect using any standard Nostr client by pointing to the deployed Cloudflare Worker URL or custom domain. The relay adheres to the basic tenets of the Nostr protocol, handling events according to the specified NIPs above.

As mentioned, you can either use the Cloudflare Worker's default "workers.dev" endpoint URL or a custom domain, adding it to any Nostr client using the secure websocket protocol.

Example:

- `wss://nostr-relay.example.workers.dev/`

## Roadmap

The current release of Nosflare is primarily focused on [basic protocol flow](https://github.com/nostr-protocol/nips/blob/master/01.md) usage. This ensures events are stored and retrieved very quickly. However, the following is a non-exhaustive list of planned features:

- "Pay-to-relay" (charging sats for access)
- Client authorization (NIP-42)
- File storage through Cloudflare R2 bucket (NIP-96)
- Encrypted DMs (NIP-44)

## Contributing

Contributions to Nosflare are welcome! Please submit issues, feature requests, or pull requests through the project's [GitHub repository](https://github.com/Spl0itable/nosflare).

## License

Nosflare is open-sourced software licensed under the MIT license.

## Contact

For inquiries related to Nosflare, you can reach out on Nostr at `npub16jdfqgazrkapk0yrqm9rdxlnys7ck39c7zmdzxtxqlmmpxg04r0sd733sv`

## Acknowledgements

- The awesome Nostr community for the protocol development.
- Cloudflare Workers for an easy-to-use serverless execution environment.
- The noble library for providing Schnorr signatures over secp256k1.
- [PastaGringo](https://github.com/PastaGringo) for making the NosflareDeploy script.