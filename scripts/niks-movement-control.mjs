/**
 * Nik's Movement Control
 *
 * A lightweight FoundryVTT module that provides GM movement restriction controls.
 * Modes: Free Movement, No Movement, Combat Turn (active combatant only).
 * Automatically sets movement modes on combat start/end.
 *
 * Compatible with Foundry VTT V13 and V14.
 */

const MODULE_ID = "niks-movement-control";
const SOCKET_NAME = `module.${MODULE_ID}`;

const MOVEMENT_TYPE = {
    FREE: "free",
    NONE: "none",
    COMBAT: "combat"
};

const MOVEMENT_ICONS = {
    [MOVEMENT_TYPE.FREE]: "fa-solid fa-person-running",
    [MOVEMENT_TYPE.NONE]: "fa-solid fa-hand",
    [MOVEMENT_TYPE.COMBAT]: "fa-solid fa-shield-halved"
};

const MOVEMENT_LABELS = {
    [MOVEMENT_TYPE.FREE]: "NMC.FreeMovement",
    [MOVEMENT_TYPE.NONE]: "NMC.NoMovement",
    [MOVEMENT_TYPE.COMBAT]: "NMC.CombatTurnMovement"
};

/** How the toolbar button is shown to players. */
const PLAYER_BUTTON = {
    BUTTON: "button",
    INDICATOR: "indicator",
    HIDDEN: "hidden"
};

const TOOL_NAME = "nmcToggleMovement";

/** Minimum time (ms) between two "movement blocked" warnings. */
const BLOCK_WARNING_COOLDOWN = 2000;

// ─── Utility ───────────────────────────────────────────────

const log = (...args) => console.log(`${MODULE_ID} |`, ...args);
const i18n = (key) => game.i18n.localize(key);
const setting = (key) => game.settings.get(MODULE_ID, key);
const getMovement = () => setting("movement") || MOVEMENT_TYPE.FREE;
const movementLabel = (movement) => i18n(MOVEMENT_LABELS[movement] || MOVEMENT_LABELS[MOVEMENT_TYPE.FREE]);

/** Combat Turn mode is selected but there is no started combat on this client's scene (acts as Free Movement). */
const isCombatModeInactive = () => (getMovement() === MOVEMENT_TYPE.COMBAT) && !game.combats?.active?.started;

/** Re-render the toolbar when combat state changes while in Combat Turn mode (updates the inactive state). */
function refreshCombatIndicator() {
    if (getMovement() === MOVEMENT_TYPE.COMBAT) ui.controls?.render({ reset: true });
}

/** Timestamp of the last "movement blocked" warning shown on this client. */
let lastBlockWarning = 0;

// ─── Settings Registration ─────────────────────────────────

function registerSettings() {
    // Labels are i18n keys; Foundry localizes setting names, hints and choices itself
    const movementChoices = {
        [MOVEMENT_TYPE.FREE]: MOVEMENT_LABELS[MOVEMENT_TYPE.FREE],
        [MOVEMENT_TYPE.NONE]: MOVEMENT_LABELS[MOVEMENT_TYPE.NONE],
        [MOVEMENT_TYPE.COMBAT]: MOVEMENT_LABELS[MOVEMENT_TYPE.COMBAT]
    };
    const movementOptions = {
        ...movementChoices,
        ignore: "NMC.Settings.Ignore"
    };
    const refreshControls = () => ui.controls?.render({ reset: true });

    // Hidden setting: current global movement mode (validated against the known modes)
    game.settings.register(MODULE_ID, "movement", {
        scope: "world",
        config: false,
        type: new foundry.data.fields.StringField({
            required: true,
            blank: false,
            choices: Object.values(MOVEMENT_TYPE),
            initial: MOVEMENT_TYPE.FREE
        }),
        // Fires on every client, so each user's toolbar button reflects the new mode
        onChange: refreshControls
    });

    // Hidden setting: world launch for which the load defaults were last applied (see ready hook)
    game.settings.register(MODULE_ID, "last-launch", {
        scope: "world",
        config: false,
        default: "",
        type: String
    });

    // Default movement mode on world load
    game.settings.register(MODULE_ID, "default-movement", {
        name: "NMC.Settings.DefaultMovement.Name",
        hint: "NMC.Settings.DefaultMovement.Hint",
        scope: "world",
        config: true,
        default: MOVEMENT_TYPE.NONE,
        type: String,
        choices: movementChoices
    });

    // Movement mode when combat starts
    game.settings.register(MODULE_ID, "movement-on-combat-start", {
        name: "NMC.Settings.MovementOnCombatStart.Name",
        hint: "NMC.Settings.MovementOnCombatStart.Hint",
        scope: "world",
        config: true,
        default: MOVEMENT_TYPE.FREE,
        type: String,
        choices: movementOptions
    });

    // Movement mode when combat ends
    game.settings.register(MODULE_ID, "movement-on-combat-end", {
        name: "NMC.Settings.MovementOnCombatEnd.Name",
        hint: "NMC.Settings.MovementOnCombatEnd.Hint",
        scope: "world",
        config: true,
        default: MOVEMENT_TYPE.NONE,
        type: String,
        choices: movementOptions
    });

    // How the toolbar button appears for players
    game.settings.register(MODULE_ID, "player-button", {
        name: "NMC.Settings.PlayerButton.Name",
        hint: "NMC.Settings.PlayerButton.Hint",
        scope: "world",
        config: true,
        default: PLAYER_BUTTON.BUTTON,
        type: String,
        choices: {
            [PLAYER_BUTTON.BUTTON]: "NMC.Settings.PlayerButton.Button",
            [PLAYER_BUTTON.INDICATOR]: "NMC.Settings.PlayerButton.Indicator",
            [PLAYER_BUTTON.HIDDEN]: "NMC.Settings.PlayerButton.Hidden"
        },
        onChange: refreshControls
    });

    // Allow owned tokens to move during combat turn
    game.settings.register(MODULE_ID, "allow-owned-combat", {
        name: "NMC.Settings.AllowOwnedCombat.Name",
        hint: "NMC.Settings.AllowOwnedCombat.Hint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    // Notify players on movement change
    game.settings.register(MODULE_ID, "notify-on-change", {
        name: "NMC.Settings.NotifyOnChange.Name",
        hint: "NMC.Settings.NotifyOnChange.Hint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    // Warn player when movement is blocked
    game.settings.register(MODULE_ID, "warn-on-block", {
        name: "NMC.Settings.WarnOnBlock.Name",
        hint: "NMC.Settings.WarnOnBlock.Hint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    // Register keybinding to cycle movement mode
    game.keybindings.register(MODULE_ID, "toggle-movement", {
        name: "NMC.Keybinding.ToggleMovement",
        editable: [{ key: "KeyM", modifiers: [foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.ALT] }],
        restricted: true,
        onDown: () => {
            cycleMovementMode();
            return true;
        }
    });
}

// ─── Movement Logic ────────────────────────────────────────

/**
 * Check if a token should be blocked by combat turn restrictions.
 * Returns true if the token should be BLOCKED from moving.
 * @param {TokenDocument} tokenDoc - The token document being moved
 * @returns {boolean} Whether movement should be blocked
 */
function blockCombat(tokenDoc) {
    const curCombat = game.combats.active;
    // If no active combat, don't block — combat mode without combat acts as free
    if (!curCombat?.started) return false;

    const combatant = curCombat.combatant;
    if (!combatant) return true;

    // Active combatant's token can always move
    if (combatant.tokenId === tokenDoc.id && combatant.sceneId === tokenDoc.parent?.id) return false;

    // Allow if any non-GM player owns both the active combatant and this token.
    // testUserPermission respects default ownership and synthetic (unlinked) token actors.
    if (setting("allow-owned-combat")) {
        const combatActor = combatant.actor;
        const tokenActor = tokenDoc.actor;
        if (combatActor && tokenActor && game.users.some(u => !u.isGM
            && combatActor.testUserPermission(u, "OWNER")
            && tokenActor.testUserPermission(u, "OWNER"))) return false;
    }

    return true;
}

/**
 * Check if a token is allowed to move, warning the player (throttled) if it is not.
 * GMs are never restricted. Players are blocked based on current movement mode.
 * @param {TokenDocument} tokenDoc - The token document being moved
 * @returns {boolean} Whether the movement is allowed
 */
function allowMovement(tokenDoc) {
    if (game.user.isGM) return true;
    if (!tokenDoc) return true;

    const movement = getMovement();

    if (movement === MOVEMENT_TYPE.FREE) return true;

    if (movement === MOVEMENT_TYPE.NONE ||
        (movement === MOVEMENT_TYPE.COMBAT && blockCombat(tokenDoc))) {
        const now = Date.now();
        if (setting("warn-on-block") && (now - lastBlockWarning > BLOCK_WARNING_COOLDOWN)) {
            ui.notifications.warn(i18n("NMC.MovementLimited"));
            lastBlockWarning = now;
        }
        return false;
    }

    return true;
}

/**
 * Whether a pending movement changes the token's position or elevation.
 * Size/shape-only changes (e.g. via Token Config) also run through the movement pipeline
 * and are not restricted.
 * @param {TokenPreMovementOperation} movement - The pending movement
 * @returns {boolean}
 */
function isPositionalMovement(movement) {
    const { origin } = movement;
    const moved = (w) => (w.x !== origin.x) || (w.y !== origin.y) || (w.elevation !== origin.elevation);
    if (movement.destination && moved(movement.destination)) return true;
    // Also catch paths that leave and return to the origin
    return (movement.passed?.waypoints ?? []).some(moved) || (movement.pending?.waypoints ?? []).some(moved);
}

/**
 * Get the next movement mode in the cycle.
 * Combat Turn is only included in the cycle when combat is active.
 * @param {string} current - Current movement mode
 * @returns {string} Next movement mode
 */
function getNextMovementMode(current) {
    const hasCombat = game.combats?.active?.started;
    switch (current) {
        case MOVEMENT_TYPE.FREE: return MOVEMENT_TYPE.NONE;
        case MOVEMENT_TYPE.NONE: return hasCombat ? MOVEMENT_TYPE.COMBAT : MOVEMENT_TYPE.FREE;
        default: return MOVEMENT_TYPE.FREE;
    }
}

/**
 * Cycle to the next movement mode.
 */
function cycleMovementMode() {
    return changeGlobalMovement(getNextMovementMode(getMovement()));
}

/**
 * Change the global movement mode for all players.
 * The "movement" setting's onChange re-renders the scene controls on every client.
 * @param {string} movement - The new movement mode
 * @param {boolean} notify - Whether to display a notification
 */
async function changeGlobalMovement(movement, notify = true) {
    if (!Object.values(MOVEMENT_TYPE).includes(movement)) return;
    if (getMovement() === movement) return;

    log("Changing global movement to:", movement);
    await game.settings.set(MODULE_ID, "movement", movement);

    if (notify) displayNotification(movement);
}

/**
 * Show the "movement changed" notification on this client.
 * @param {string} movement - The current movement mode
 */
function showChangeNotification(movement) {
    ui.notifications.info(i18n("NMC.MovementChanged") + movementLabel(movement));
}

/**
 * Display a notification about the movement change and emit to all players.
 * The movement key is sent (not a localized string) so each client shows it in its own language.
 * @param {string} movement - The current movement mode
 */
function displayNotification(movement) {
    if (!setting("notify-on-change")) return;

    showChangeNotification(movement);
    game.socket.emit(SOCKET_NAME, { action: "movementchange", movement });
}

// ─── Token._canDrag Patch (with libWrapper support) ────────

function patchTokenCanDrag() {
    const wrapperFn = function (wrapped, ...args) {
        const result = wrapped(...args);
        // Only check (and warn) when the drag would otherwise be possible
        if (!result) return result;
        return allowMovement(this.document);
    };

    if (game.modules.get("lib-wrapper")?.active) {
        try {
            libWrapper.register(
                MODULE_ID,
                "foundry.canvas.placeables.Token.prototype._canDrag",
                wrapperFn,
                "WRAPPER"
            );
            log("Token._canDrag patched via libWrapper");
            return;
        } catch (e) {
            log("libWrapper registration failed, using manual patch:", e);
        }
    }

    // Manual patch fallback
    const origCanDrag = foundry.canvas.placeables.Token.prototype._canDrag;
    foundry.canvas.placeables.Token.prototype._canDrag = function (...args) {
        return wrapperFn.call(this, origCanDrag.bind(this), ...args);
    };
    log("Token._canDrag patched manually");
}

// ─── Hooks ─────────────────────────────────────────────────

Hooks.once("init", () => {
    log("Initializing");
    registerSettings();
    patchTokenCanDrag();

    // Add cycling button to token controls
    Hooks.on("getSceneControlButtons", (controls) => {
        const tokenControls = controls.tokens;
        if (!tokenControls) return;

        const playerButton = game.user.isGM ? null : setting("player-button");
        if (playerButton === PLAYER_BUTTON.HIDDEN) return;

        const currentMovement = getMovement();
        let label = movementLabel(currentMovement);
        if (isCombatModeInactive()) label += ` ${i18n("NMC.NoActiveCombat")}`;

        tokenControls.tools[TOOL_NAME] = {
            name: TOOL_NAME,
            title: game.user.isGM ? `${i18n("NMC.ToggleMovement")}: ${label}` : label,
            icon: MOVEMENT_ICONS[currentMovement] || MOVEMENT_ICONS[MOVEMENT_TYPE.FREE],
            order: Object.keys(tokenControls.tools).length,
            toggle: false,
            button: true,
            onChange: () => {
                if (game.user.isGM) cycleMovementMode();
                else if (playerButton === PLAYER_BUTTON.BUTTON) ui.notifications.info(i18n("NMC.CurrentMovement") + label);
            }
        };
    });

    // Tool cssClass is overwritten by core during render, so state classes are applied to the rendered button
    Hooks.on("renderSceneControls", (app, element) => {
        const button = element?.querySelector?.(`[data-tool="${TOOL_NAME}"]`);
        if (!button) return;
        button.classList.toggle("nmc-inactive", isCombatModeInactive());
        button.classList.toggle("nmc-indicator",
            !game.user.isGM && (setting("player-button") === PLAYER_BUTTON.INDICATOR));
    });
});

Hooks.once("ready", () => {
    // Listen for socket messages from GM
    game.socket.on(SOCKET_NAME, (data) => {
        if (data?.action === "movementchange") showChangeNotification(data.movement);
    });

    // Apply default movement mode on world load (primary GM only).
    // game.world.lastPlayed is set by the server each time the world is launched, so it identifies the launch:
    // defaults are applied once per launch and a GM reloading the page keeps the current mode.
    if (!game.user.isActiveGM) return;
    const launchId = game.world.lastPlayed;
    if (launchId) {
        if (setting("last-launch") === launchId) return;
        game.settings.set(MODULE_ID, "last-launch", launchId);
    }
    if (game.combats.active?.started) {
        // Combat is active — use the combat movement setting instead of the default
        const movementOnCombat = setting("movement-on-combat-start");
        if (movementOnCombat !== "ignore") changeGlobalMovement(movementOnCombat, false);
    } else {
        changeGlobalMovement(setting("default-movement"), false);
    }
});

// Block token movement for non-GM users. preMoveToken fires only on the client initiating the
// movement and rejects it cleanly (no movement history recorded, movement continuation stopped).
// It covers dragging, keyboard, ruler and API movement, including elevation changes.
Hooks.on("preMoveToken", (document, movement) => {
    if (game.user.isGM) return;
    if (!isPositionalMovement(movement)) return;
    if (!allowMovement(document)) return false;
});

// Auto-set movement when combat starts (primary GM only)
Hooks.on("updateCombat", (combat, delta) => {
    if (!game.user.isActiveGM) return;

    // Combat just started: round went from 0 to 1. Does not depend on the first turn index and is not
    // re-triggered when stepping back from round 2 into round 1.
    if (delta.round === 1 && combat.started && combat.previous?.round === 0) {
        const movementOnStart = setting("movement-on-combat-start");
        if (movementOnStart !== "ignore") changeGlobalMovement(movementOnStart);
    }
});

// Auto-set movement when combat ends (primary GM only)
Hooks.on("deleteCombat", (combat) => {
    if (!game.user.isActiveGM) return;
    if (!combat.started) return;

    // Only trigger if no other started combats remain
    if (game.combats.some(c => (c !== combat) && c.started)) return;

    const movementOnEnd = setting("movement-on-combat-end");
    if (movementOnEnd !== "ignore") changeGlobalMovement(movementOnEnd);
});

// Keep the Combat Turn "inactive" state of the toolbar button current on every client
Hooks.on("createCombat", refreshCombatIndicator);
Hooks.on("deleteCombat", refreshCombatIndicator);
Hooks.on("updateCombat", (combat, delta) => {
    if (("round" in delta) || ("active" in delta) || ("scene" in delta)) refreshCombatIndicator();
});
Hooks.on("canvasReady", refreshCombatIndicator);
