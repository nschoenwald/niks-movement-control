# Nik's Movement Control

A lightweight FoundryVTT module that gives GMs simple, effective control over player token movement. Inspired by Monk's TokenBar — stripped down to just movement restrictions, without any token bar, saving throws, XP, or loot features.

---

## Compatibility

- **Foundry VTT**: V13 – V14
- **System**: System-agnostic (works with any game system)
---

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

The button icon changes to reflect the current mode for everyone (GMs and players), and hovering it shows the current mode.

- If **Combat Turn** is selected but no combat is running, the button is dimmed and its tooltip says "(no active combat)". Movement is unrestricted until combat starts.
- For players, the button can be a clickable button (announces the current mode), an indicator only, or hidden entirely (see **Player Toolbar Button** setting).

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

The module sets a configurable default movement mode when the world is launched (default: **No Movement**). Reloading the page (e.g. F5) keeps the current mode. If combat is already running at launch, the "Movement on Combat Start" mode is used instead.

### Player Notifications

When the GM changes the movement mode, all connected players receive a notification. This can be disabled in settings.

## Settings

| Setting | Default | Description |
|---|---|---|
| Notify on Movement Change | ✅ On | Show a notification to players when movement mode changes |
| Warn on Movement Block | ✅ On | Warn a player when they try to move a token while movement is restricted |
| Movement on Combat Start | Free Movement | Automatically set mode when combat begins |
| Movement on Combat End | No Movement | Automatically set mode when combat ends |
| Allow Owned Tokens in Combat Turn | ✅ On | In Combat Turn mode, allow all tokens owned by the active combatant's player(s) to move |
| Default Movement on Load | No Movement | Movement mode to apply when the world is launched |
| Player Toolbar Button | Button | How the movement button appears for players: Button, Indicator only, or Hidden |

## Technical Details

- **Dual-layer blocking**: Movement is blocked both at the drag level (`Token._canDrag` patch) and at the movement level (`preMoveToken` hook), which covers dragging, keyboard and API movement as well as elevation changes. Token size changes are not restricted.
- **libWrapper support** (recommended): Uses [libWrapper](https://github.com/ruipin/fvtt-lib-wrapper) for the `_canDrag` patch when available, improving compatibility with other modules.
- **Primary GM guard**: Combat automation hooks only fire once when multiple GMs are connected (uses `game.user.isActiveGM`).
- **Socket-based notifications**: Movement change notifications are broadcast to all players via socket and shown in each player's own language.

## Credits

Based on [Monk's TokenBar](https://github.com/ironmonk108/monks-tokenbar) by IronMonk, licensed under GPL-3.0.

---

## Other Modules by Nik

### 🎲 D&D 5e Specific
* **[Nik's DnD5e Tweaks](https://github.com/nschoenwald/niks-dnd5e-tweaks)** – Consolidated collection of quality-of-life enhancements and combat automation tweaks for DnD5e.

### ⚔️ Combat & Token Tools
* **[Nik's Action HUD](https://github.com/nschoenwald/niks-action-hud)** – Sleek, modern canvas-docked Action HUD for quick access to attacks, spells, inventory, and utility rolls.
* **[Nik's Token Tags](https://github.com/nschoenwald/niks-token-tags)** – Automatically numbers duplicate combatant NPCs (A, B, C…) with color-coded letter overlays.
* **[Nik's Shared NPC Initiative](https://github.com/nschoenwald/niks-shared-npc-initiative)** – Groups NPCs of the same type in combat so they share a single initiative roll.
* **[Nik's Tiny Change Logs](https://github.com/nschoenwald/niks-tiny-changelogs)** – Compact, single-line chat messages logging token HP and Temp HP changes.

### 🎲 Visuals & Display
* **[Nik's Dynamic Roll Area](https://github.com/nschoenwald/niks-dynamic-roll-area)** – Dynamically restricts Dice So Nice 3D dice rolling area to exclude the sidebar / chat log across all screen resolutions and window sizes.

### ⚙️ Utilities & System Management
* **[Nik's Settings Locks](https://github.com/nschoenwald/niks-settings-locks)** – Soft-lock and hard-lock client settings and keybindings across all connected players.
* **[Nik's Compendium Search Tweaks](https://github.com/nschoenwald/niks-compendium-search-tweaks)** – Configure which compendium packs are included or excluded from native sidebar search.
* **[Nik's Show & Tell](https://github.com/nschoenwald/niks-show-and-tell)** – Share popout images to chat and paste image files directly into chat messages.
* **[Nik's Zoom / Pan Options](https://github.com/nschoenwald/niks-zoom-pan-options)** – Touchpad and scroll wheel pan/zoom controls and canvas navigation enhancements.
