# Nik's Movement Control

A lightweight FoundryVTT module that gives GMs simple, effective control over player token movement. Inspired by Monk's TokenBar — stripped down to just movement restrictions, without any token bar, saving throws, XP, or loot features.

## Features

### Movement Modes

| Mode | Icon | Behavior |
|---|---|---|
| **Free Movement** | 🏃 `fa-person-running` | All players can move freely |
| **No Movement** | ✋ `fa-hand` | No player tokens can move |
| **Combat Turn** | 🛡️ `fa-shield-halved` | Only the active combatant's tokens can move |

- **GMs are never restricted** — movement restrictions only affect players.
- **Combat Turn** allows all tokens owned by the same player(s) as the active combatant to move (e.g. familiars, mounts). This can be toggled off in settings.

### Toggle Button

A button is added to the **Token Controls** toolbar (left sidebar) that cycles through movement modes on click:

- **Without active combat:** Free → No Movement → Free → ...
- **With active combat:** Free → No Movement → Combat Turn → Free → ...

The button icon changes to reflect the current mode.

### Keyboard Shortcut

Press **Alt+M** to cycle movement modes (GM only, rebindable in Foundry's keybinding settings).

### Combat Automation

Movement modes can be set automatically when combat starts or ends:

| Event | Default |
|---|---|
| Combat starts | Free Movement |
| Combat ends | No Movement |

Both can be configured to any mode or set to "Don't Change".

### Default on Load

The module sets a configurable default movement mode every time the world loads (default: **No Movement**).

### Player Notifications

When the GM changes the movement mode, all connected players receive a notification. This can be disabled in settings.

## Settings

| Setting | Default | Description |
|---|---|---|
| Notify on Movement Change | ✅ On | Show a notification to players when movement mode changes |
| Movement on Combat Start | Free Movement | Automatically set mode when combat begins |
| Movement on Combat End | No Movement | Automatically set mode when combat ends |
| Allow Owned Tokens in Combat Turn | ✅ On | In Combat Turn mode, allow all tokens owned by the active combatant's player(s) to move |
| Default Movement on Load | No Movement | Movement mode to apply when the world is loaded |

## Technical Details

- **Dual-layer blocking**: Movement is blocked both at the drag level (`Token._canDrag` patch) and at the update level (`preUpdateToken` hook) for maximum reliability.
- **libWrapper support**: Uses [libWrapper](https://github.com/ruipin/fvtt-lib-wrapper) for the `_canDrag` patch when available, improving compatibility with other modules.
- **Primary GM guard**: Combat automation hooks only fire once when multiple GMs are connected (uses `game.users.activeGM`).
- **Socket-based notifications**: Movement change notifications are broadcast to all players via socket.

## Compatibility

- **Foundry VTT**: V13 – V14
- **System**: System-agnostic (works with any game system)

## Installation

Install via the module manifest URL:
```
https://github.com/nschoenwald/niks-movement-control/releases/latest/download/module.json
```

## Credits

Based on [Monk's TokenBar](https://github.com/ironmonk108/monks-tokenbar) by IronMonk, licensed under GPL-3.0.