![Nosflare](images/nosflare.png)

# Nosflare

Nosflare is a serverless [Nostr](https://github.com/fiatjaf/nostr) relay purpose-built for [Cloudflare Workers](https://workers.cloudflare.com/) and a [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) bucket. 

This relay is designed to be easy to deploy, scalable, and cost-effective, leveraging Cloudflare's edge computing infrastructure to provide a resilient relay for the Nostr decentralized social protocol.

Most applicable NIPs are supported along with support for allowlisting or blocklisting pubkeys and event kinds and tags, throttle number of events from a single pubkey through rate limiting, block specific words and/or phrases, and support of [NIP-05](https://github.com/nostr-protocol/nips/blob/master/05.md) for `username@your-domain.com` verified Nostr addresses.

Nosflare introduces a unique "helper" scheme which allows utilizing helper workers for handling EVENT and REQ messages. This let's the primary websocket worker communicate with helper workers in order to improve the saving and retrieval of events to and from the R2 bucket. At least one helper worker for both EVENT and REQ messages is required, detailed further in the Deployment section.

These helper workers communicate with the primary relay websocket worker through POST requests. This means, you can technically query your R2 bucket using standard HTTP POST requests like this example using cURL:

<code>curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer AuthToken123" -d '{"type":"REQ","subscriptionId":"sub1","filters":{"kinds":[1]}}' "https://req-helper-1.example.com"</code>

This opens up many possibilities for the relay to share event data outside of a Nostr client. By default, Nosflare is configured to use an Authorization header to secure and authenticate the inter-relay communication between websocket worker and helper workers in order to prevent abuse. However, you could alter the code if you'd like to remove this restriction.

## Supported NIPs

- Supports a range of [Nostr Improvement Proposals (NIPs)](https://github.com/fiatjaf/nostr/tree/master/nips), including NIPs 1, 2, 4, 5, 9, 11, 12, 15, 16, 17, 20, 22, 33, 40.

## Getting Started

### Prerequisites

- A [Cloudflare](https://www.cloudflare.com/plans/) account with Workers and R2 bucket enabled.
- [Node.js](https://nodejs.org/) and npm (for installing dependencies and running the build script).
- (optional) [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler/install-update)

### Dependencies

Nosflare requires the [@noble/curves](https://github.com/paulmillr/noble-curves) package for cryptographic operations and the [@evanw/esbuild](https://github.com/evanw/esbuild) bundler:

```
npm install @noble/curves
npm install -g esbuild
```

### Building

Clone this repo to your machine, then `cd` into its directory, and open `relay-worker.js` in a file editor. Edit the contents of `relayInfo` and `relayIcon` as desired to customize the relay name, icon, etc.

***Important!*** Edit the `eventHelpers` and `reqHelpers` section by replacing the placeholder URLs with at least one URL for each. Detailed further in the Deployment steps below.
 
*Optional:*
- In the `relay-worker.js` file: Edit the `nip05Users` section to add usernames and their hex pubkey for NIP-05 verified Nostr address, Edit the `blockedPubkeys` or `allowedPubkeys ` and `blockedEventKinds` or `allowedEventKinds` to either blocklist or allowlist pubkeys and event kinds, Edit `blockedContent` to block specific words and/or phrases, Edit `excludedRateLimitKinds` to exclude event kinds from rate limiting.
- In the `event-worker.js` file: Edit the `blockedTags` or `allowedTags` to either blocklist or allowlist tags.

You can find full list of event kinds [here](https://github.com/nostr-protocol/nips#event-kinds) and tags [here](https://github.com/nostr-protocol/nips?tab=readme-ov-file#standardized-tags).

How blocklisting and allowlisting works:
> If pubkey(s) and event kind(s) and tag(s) are in blocklist, only that pubkey(s) and event kind(s) and tag(s) will be blocked and all others allowed. Conversely, if pubkey(s) and event kind(s) and tag(s) are in allowlist, only that pubkey(s) and event kind(s) and tag(s) will be allowed and all others blocked.

Once you've made the desired edits, from the project's directory use the command `npm run build` to bundle the worker scripts. This will overwrite the `relay-worker.js`, `event-worker.js`, and `req-worker.js` files and save them in the `dist/` directory. You will use these three scripts from the `dist/` directory to deploy the relay.

### Deployment

You can deploy Nosflare using either the Wrangler CLI or directly through the Cloudflare dashboard. We'll focus on using the Cloudflare dashboard, but many steps for using Wrangler CLI is somewhat similar:

#### Cloudflare Dashboard

1. Log in to your Cloudflare dashboard.
2. Go to the Workers section and create a new worker. You can call it whatever you'd like. This will be the primary relay worker (the one Nostr clients connect to).
3. Copy the contents of `dist/relay-worker.js` file and paste into the online editor.
4. Save and deploy the relay worker.
5. Add a custom domain in the relay Worker's settings in "Triggers" tab (this will be the desired relay URL).
6. Create another worker. You can call it whatever you'd like. This will be the EVENT messages helper worker.
7. Copy the contents of `dist/event-worker.js` file and paste into the online editor.
8. Save and deploy the events helper worker.
9. Add custom subdomain in Worker's settings in "Triggers" tab (this will be the desired URL used for `eventHelpers`). Repeat this step if you want to create multiple event helper workers!
10. Create another worker. You can call it whatever you'd like. This will be the REQ messages helper worker.
11. Copy the contents of `dist/req-worker.js` file and paste into the online editor.
12. Save and deploy the req helper worker.
13. Add custom subdomain in Worker's settings in "Triggers" tab (this will be the desired URL used for `reqHelpers`). Repeat this step if you want to create multiple req helper workers!
![Helper Workers Custom Subdomain](images/helper-workers-domain.png)
14. Create a R2 bucket to store events. You can call it whatever and choose the location you want.
15. In R2 bucket settings, add a custom subdomain (ex: nostr-events.site.com).
![R2 Bucket Subdomain](images/custom-domain.jpeg)
16. In each Worker's variables settings add the following environment variables: `r2BucketDomain` that will be the subdomain URL you set as the custome domain in the R2 bucket, `authToken` this will be something unique (think password) that will be used to authenticate the communication from the relay worker to the helper workers, `apiToken` this will be your cloudflare API token (recommended to set a custom API token that only has cache purge privileges), `zoneId` which is for the domain you're using for the R2 bucket (this ID can be found in the right sidebar of the overview page for the domain).
![Worker Environment Variables](images/env-vars.png)
17. In a different section on the Settings > Variables page of each worker, bind the `relayDb` variable to the R2 bucket you created in the R2 Bucket Bindings section.
![R2 Bucket Binding](images/r2-binding.jpeg)

## Roadmap

The current release of Nosflare is primarily focused on [basic protocol flow](https://github.com/nostr-protocol/nips/blob/master/01.md) usage. This ensures events are stored and retrieved very quickly. However, the following is a non-exhaustive list of planned features:

- Event streaming
- "Pay-to-relay" (charging sats for access)
- Client authorization (NIP-42)
- Encrypted DMs (NIP-44)

## Recommended Cloudflare Settings

Ensure optimal performance of the relay by creating a Page Rule for enforcing a high cache rate through a "cache everything" rule and lengthy Cloudflare edge TTL as well as enabling rate limiting in order to protect the relay from abuse.

Examples:

![Cache Rule](images/cache-setting.jpeg)

![Rate Limiting](images/rate-limit.jpeg)

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
