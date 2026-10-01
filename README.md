# Pixel Town

**A pixel-art town where conversations have a place.** Walk up to someone and a private DM opens. Their typing shows as a speech bubble over their head. Step into the Lantern Café, War Room or Moon Garden and you join that room's group chat and video call. Walk away and the conversation closes, like real life.

Built for the [CometChat Zero to Chat](https://www.cometchat.com/hackathon) challenge (#ZeroToChat) with Claude Code + the CometChat MCP server.

## What CometChat does here

| Feature in the town | CometChat primitive |
| --- | --- |
| Avatars moving in real time | **Transient messages** to a `pixel-town-world` group (not persisted, ~8/s while walking) |
| Walk near someone → whisper | **1:1 text messages** + message history |
| "…" bubble over their head | **Typing indicators** (`startTyping` / `onTypingStarted`) |
| Room chat (Café / War Room / Garden) | **Public groups**, joined on entry (`joinGroup` / `createGroup`) |
| 📹 Join call in a room | **Calls SDK v5**: every player in the room shares the room's session id |
| Players vanish when they close the tab | **Presence** (`onUserOffline`) + a `bye` packet |
| Emotes 👋❤️😂🎉🔥 | Transient messages |

## How the MCP was used

The CometChat MCP (`claude mcp add --transport http cometchat https://mcp.cometchat.com/mcp?ref=z2c`, checked in at [`.mcp.json`](.mcp.json)) supplied every CometChat integration detail:

- `list_cometchat_bundles` → picked `js-sdk-messaging-basics`, `presence-and-typing` and `react-uikit-quickstart`
- `get_cometchat_implementation_bundle` → init/login order, listener cleanup, typing debounce guidance (the "don't call startTyping every keystroke" pitfall shaped `ChatPanel`)
- `search_cometchat_docs` + `fetch_cometchat_doc_page` →
  - `/sdk/javascript/transient-messages`: the key idea for streaming avatar positions without persisting them
  - `/calls/javascript/{setup,authentication,join-session,events}`: Calls SDK v5 `generateToken` → `joinSession` flow and the single-active-session rule
  - `/sdk/javascript/{create-group,join-group,user-management,error-codes}`: `ERR_UID_NOT_FOUND`, `ERR_GUID_NOT_FOUND` and `ERR_ALREADY_JOINED` handling in `transport/cometchat.ts`

## Run it

```bash
npm install

# 1. Credentials (free tier, no card): either copy from app.cometchat.com …
cp .env.example .env.local   # fill VITE_COMETCHAT_APP_ID / REGION / AUTH_KEY
# … or let the CometChat CLI provision them:
npx @cometchat/skills-cli@3 auth login && npx @cometchat/skills-cli@3 provision run

# 2. Go
npm run dev
```

Open **one normal window and one incognito window** (or two browser profiles), pick names, and walk toward each other. Two tabs in the *same* profile share the CometChat SDK's stored login, so the second login would sign out the first.

No credentials? The app falls back to a **local demo mode**: tabs in the same browser profile meet over a `BroadcastChannel` (add `?fresh=1` to the second tab so it gets its own identity). Chat, typing and rooms work; video calls need the real thing. Force it any time with `?local=1`.

### Controls

`WASD` / arrow keys to walk · `1`–`5` emotes · on touch screens, an on-screen D-pad.

## Architecture

```
src/
├── lib/                 pure, unit-tested logic
│   ├── world/map.ts         tile map, zones, collision, spawn
│   ├── world/movement.ts    stepping, wall sliding, interpolation
│   ├── world/proximity.ts   nearest player + hysteresis
│   ├── world/players.ts     immutable remote-player store
│   ├── packet.ts            validation of untrusted transient packets
│   └── conversation.ts      conversation keys + message merging
├── transport/           TownTransport interface
│   ├── cometchat.ts         real implementation (Chat SDK)
│   └── local.ts             offline BroadcastChannel stand-in
├── calls/callSession.ts Calls SDK v5, lazy-loaded on first "Join call"
├── hooks/               useWorldSim (game loop), useConversations, useKeyboard
└── components/          lobby, world (canvas + procedural sprites), chat, call, hud, town
```

- **Everything from the network is untrusted.** Packets are validated field by field, emotes are whitelisted, and a packet whose `uid` doesn't match the CometChat sender is dropped, so nobody can move someone else's avatar.
- **Abuse limits:** per-sender token bucket on packets, map-bounded coordinates, a player cap, control and bidi characters stripped from names, and incoming text capped.
- **Resilience:** heartbeats run on a timer (not rAF) so hidden tabs stay present, room calls are serialised through the SDK's single-session rule, and whispers that arrive while the panel is closed raise an unread notice.
- **Bandwidth:** positions are broadcast at most every 120 ms while moving and every 2.5 s as a heartbeat when idle. Newcomers send `hello` so everyone answers immediately.
- **Performance:** the static map is pre-rendered once, sprites are procedural (no image assets), and the ~560 KB Calls SDK is only downloaded when someone joins a call.

## Tests

```bash
npm test          # 58 unit tests (vitest): map, movement, proximity, packet validation, rate limiting, store, uid
npm run e2e       # Playwright: two players, whisper + typing + room chat + walking away
```

## Production notes

This is a hackathon demo. Before shipping for real:

- Replace Auth Key login with **server-minted Auth Tokens** (`loginWithAuthToken`) and create users server-side.
- Add a Content-Security-Policy that allows the CometChat API, WebSocket and Calls origins for your region.
- Consider CometChat's moderation bundle (`moderation-setup`) for public towns.
