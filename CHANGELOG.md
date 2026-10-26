# Changelog

## 14.3.0

### Fixed
- Players' toolbar button now updates its icon immediately when the GM changes the movement mode (previously it could show a stale mode until the page was reloaded).
- Blocked movement is now rejected cleanly: no phantom movement history is recorded and keyboard movement no longer gets stuck after a block.
- Elevation changes are now restricted along with position changes. Changing a token's size is no longer affected.
- Combat-start automation now triggers reliably even when the first combatant in the tracker is skipped, and no longer re-triggers when stepping back from round 2 to round 1.
- Combat-end automation now runs when the last *running* combat ends, even if other prepared (not yet started) encounters exist.
- "Allow Owned Tokens in Combat Turn" now respects default ("All Players") ownership and unlinked tokens correctly.
- Movement change notifications now appear in each player's own language.
- Clicking the toolbar button as a player now says "Current movement mode" instead of "Movement mode changed".
- The "movement restricted" warning no longer appears when trying to drag a token you can't move anyway.
- Removed a deprecation warning when clicking the toolbar button (would have broken in Foundry V15).

- Reloading the page as GM no longer resets the movement mode to the "Default Movement on Load" setting. The default is now applied once per world launch.

### Added
- New **Player Toolbar Button** setting: show the button to players as a clickable button, an indicator only, or hide it.
- When **Combat Turn** is selected but no combat is running, the toolbar button is dimmed and its tooltip says "(no active combat)".
- libWrapper is now listed as a recommended module.

### Changed
- The GM's toolbar button tooltip now shows the current movement mode.
- "Movement mode changed" notifications are now shown as info messages instead of warnings, so they're easier to tell apart from "movement restricted" warnings.

## 14.2.0

### Added
- New **Warn on Movement Block** setting to turn the "movement restricted" warning for players on or off.

### Changed
- Players now also get the "movement restricted" warning when they try to drag a token, not only on other kinds of movement.
- The two separate "movement restricted" messages were merged into one.
- If combat is already running when the world loads, the **Movement on Combat Start** mode is applied instead of the load default.
- Selecting the mode that is already active no longer re-sends the change notification.

## 14.1.1

### Added
- Players now see the movement button in the Token Controls toolbar. Its icon and tooltip show the current mode, and clicking it shows the current mode.

### Changed
- Applying the default movement mode on world load no longer shows a notification.
- The **Default Movement on Load** setting now appears near the top of the settings list.

## 0.3 (Pre-Release)

- First release.
- Three movement modes for players: **Free Movement**, **No Movement**, and **Combat Turn** (only the active combatant's tokens, optionally including other tokens owned by the same player).
- Toolbar button and **Alt+M** keybinding to cycle modes (GM only).
- Movement mode set automatically on combat start/end and on world load.
- Notifications to players when the movement mode changes.
