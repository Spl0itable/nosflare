# Nosflare

Nosflare is a serverless [Nostr](https://github.com/fiatjaf/nostr) relay purpose-built for [Cloudflare Workers](https://workers.cloudflare.com/) and the [Cloudflare KV](https://www.cloudflare.com/products/workers-kv/) store. 

This relay is designed to be easy to deploy, scalable, and cost-effective, leveraging Cloudflare's edge computing infrastructure to provide a resilient relay for the Nostr decentralized social  protocol.

## Supported NIPs

- Supports a range of [Nostr Improvement Proposals (NIPs)](https://github.com/fiatjaf/nostr/tree/master/nips), including NIPs 1, 2, 4, 9, 11, 12, 15, 16, 20, 22, 33, and 40.

## Getting Started

### Prerequisites

- A [Cloudflare](https://www.cloudflare.com/plans/) account with Workers and KV Store enabled.
- [Node.js](https://nodejs.org/) and npm (for installing dependencies and running the build script).
- [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler/install-update) (optional) or access to the Cloudflare dashboard for deployment.

### Dependencies

This project requires the `@noble/curves` package for cryptographic operations:

```
npm install @noble/curves
```

### Building

Pull the `worker.js` file to your machine. Edit the contents of `relayInfo` and `relayIcon` as desired to customiz the relay name, icon, etc.

We'll use `esbuild` to bundle the worker script:

```
esbuild worker.js --bundle --outfile=dist/worker.js --platform=neutral --target=es2020
```

The command assumes you're in the same directory as the `worker.js` file.

### Deployment

You can deploy Nosflare using either the Wrangler CLI or directly through the Cloudflare dashboard:

#### Using Wrangler

1. Configure your `wrangler.toml` with your Cloudflare account details.
2. Ensure you have the KV namespace created and bind it to the `relayDb` variable in your worker script.
3. Publish the worker:

```
wrangler publish
```

#### Using Cloudflare Dashboard

1. Log in to your Cloudflare dashboard.
2. Go to the Workers section and create a new worker. You can call it whatever you'd like.
3. Copy the contents of `dist/worker.js` into the online editor. See the `example.js` file in this repo for what a successfully bundled file should look like.
4. Save and deploy the worker.
5. Bind the `relayDb` variable to your KV namespace in the Settings > Variables tab.
6. Add a route (this will be the desired relay URL)

### Expired Event Handling

To process expired events, add a cron trigger to the worker:

- Navigate to the "Triggers" tab of your worker in the Cloudflare dashboard.
- Set up a cron trigger according to your desired schedule for event cleanup.

## Usage

Nosflare acts as a Nostr relay. Users can connect using any standard Nostr client by pointing to the deployed Cloudflare Worker URL. The relay adheres to the Nostr protocol, handling events according to the specified NIPs.

You can either use the Cloudflare Worker's default "workers.dev" endpoint URL or a defined route to add the relay to any Nostr client using the secure websocket protocol.

Example:

- `wss://nostr-relay.example.workers.dev/`

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