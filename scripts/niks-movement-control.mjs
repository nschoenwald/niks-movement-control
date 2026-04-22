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

// ─── Utility ───────────────────────────────────────────────

const log = (...args) => console.log(`${MODULE_ID} |`, ...args);
const i18n = (key) => game.i18n.localize(key);
const setting = (key) => game.settings.get(MODULE_ID, key);

/**
 * Check if the current user is the primary (first active) GM.
 * Prevents duplicate operations when multiple GMs are connected.
 */
function isPrimaryGM() {
    if (!game.user.isGM) return false;
    const primaryGM = game.users.activeGM ?? game.users.find(u => u.isGM && u.active);
    return game.user === primaryGM;
}

// ─── Settings Registration ─────────────────────────────────

function registerSettings() {
    const movementOptions = {
        free: i18n("NMC.FreeMovement"),
        none: i18n("NMC.NoMovement"),
        combat: i18n("NMC.CombatTurnMovement"),
        ignore: i18n("NMC.Settings.Ignore")
    };

    // Hidden setting: current global movement mode
    game.settings.register(MODULE_ID, "movement", {
        scope: "world",
        config: false,
        default: MOVEMENT_TYPE.FREE,
        type: String
    });

    // Default movement mode on world load
    game.settings.register(MODULE_ID, "default-movement", {
        name: i18n("NMC.Settings.DefaultMovement.Name"),
        hint: i18n("NMC.Settings.DefaultMovement.Hint"),
        scope: "world",
        config: true,
        default: MOVEMENT_TYPE.NONE,
        type: String,
        choices: {
            free: i18n("NMC.FreeMovement"),
            none: i18n("NMC.NoMovement"),
            combat: i18n("NMC.CombatTurnMovement")
        }
    });

    // Movement mode when combat starts
    game.settings.register(MODULE_ID, "movement-on-combat-start", {
        name: i18n("NMC.Settings.MovementOnCombatStart.Name"),
        hint: i18n("NMC.Settings.MovementOnCombatStart.Hint"),
        scope: "world",
        config: true,
        default: MOVEMENT_TYPE.FREE,
        type: String,
        choices: movementOptions
    });

    // Movement mode when combat ends
    game.settings.register(MODULE_ID, "movement-on-combat-end", {
        name: i18n("NMC.Settings.MovementOnCombatEnd.Name"),
        hint: i18n("NMC.Settings.MovementOnCombatEnd.Hint"),
        scope: "world",
        config: true,
        default: MOVEMENT_TYPE.NONE,
        type: String,
        choices: movementOptions
    });

    // Allow owned tokens to move during combat turn
    game.settings.register(MODULE_ID, "allow-owned-combat", {
        name: i18n("NMC.Settings.AllowOwnedCombat.Name"),
        hint: i18n("NMC.Settings.AllowOwnedCombat.Hint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    // Notify players on movement change
    game.settings.register(MODULE_ID, "notify-on-change", {
        name: i18n("NMC.Settings.NotifyOnChange.Name"),
        hint: i18n("NMC.Settings.NotifyOnChange.Hint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    // Register keybinding to cycle movement mode
    game.keybindings.register(MODULE_ID, "toggle-movement", {
        name: "NMC.Keybinding.ToggleMovement",
        editable: [{ key: "KeyM", modifiers: [foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS?.ALT] }],
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
    if (!curCombat || !curCombat.started) return false;

    const combatant = curCombat.combatant;
    if (!combatant) return true;

    // Active combatant's token can always move
    if (combatant.tokenId === tokenDoc.id) return false;

    // Check if owned tokens of the same player(s) are allowed to move
    if (setting("allow-owned-combat")) {
        const curPermission = combatant.actor?.ownership ?? {};
        const tokPermission = tokenDoc.actor?.ownership ?? {};

        // Find non-GM players who own the active combatant
        const ownerUsers = Object.keys(curPermission).filter(
            k => curPermission[k] === 3 && !game.users.get(k)?.isGM
        );

        // Allow if any of those players also own this token
        if (ownerUsers.some(u => tokPermission[u] === 3)) return false;
    }

    return true;
}

/**
 * Check if a token is allowed to move.
 * GMs are never restricted. Players are blocked based on current movement mode.
 * @param {TokenDocument} tokenDoc - The token document being moved
 * @param {boolean} notify - Whether to show a notification to the player
 * @returns {boolean} Whether the movement is allowed
 */
function allowMovement(tokenDoc, notify = true) {
    if (game.user.isGM) return true;
    if (!tokenDoc) return true;

    const movement = game.settings.get(MODULE_ID, "movement") || MOVEMENT_TYPE.FREE;

    if (movement === MOVEMENT_TYPE.FREE) return true;

    if (movement === MOVEMENT_TYPE.NONE ||
        (movement === MOVEMENT_TYPE.COMBAT && blockCombat(tokenDoc))) {
        if (notify && !tokenDoc._nmcMovementNotified) {
            const msgKey = movement === MOVEMENT_TYPE.COMBAT
                ? "NMC.CombatTurnMovementLimited"
                : "NMC.NormalMovementLimited";
            ui.notifications.warn(i18n(msgKey));
            tokenDoc._nmcMovementNotified = true;
            setTimeout(() => {
                delete tokenDoc._nmcMovementNotified;
            }, 2000);
        }
        return false;
    }

    return true;
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
        case MOVEMENT_TYPE.COMBAT: return MOVEMENT_TYPE.FREE;
        default: return MOVEMENT_TYPE.FREE;
    }
}

/**
 * Cycle to the next movement mode.
 */
function cycleMovementMode() {
    const current = game.settings.get(MODULE_ID, "movement") || MOVEMENT_TYPE.FREE;
    const next = getNextMovementMode(current);
    changeGlobalMovement(next);
}

/**
 * Change the global movement mode for all players.
 * @param {string} movement - The new movement mode
 * @param {boolean} notify - Whether to display a notification
 */
async function changeGlobalMovement(movement, notify = true) {
    if (!Object.values(MOVEMENT_TYPE).includes(movement)) return;

    log("Changing global movement to:", movement);
    await game.settings.set(MODULE_ID, "movement", movement);

    if (notify) {
        displayNotification(movement);
    }

    // Re-render scene controls so the button icon updates
    ui.controls.render({ force: true, reset: true });
}

/**
 * Display a notification about the movement change and emit to all players.
 * @param {string} movement - The current movement mode
 */
function displayNotification(movement) {
    if (!setting("notify-on-change")) return;

    const label = i18n(MOVEMENT_LABELS[movement] || MOVEMENT_LABELS[MOVEMENT_TYPE.FREE]);
    const msg = i18n("NMC.MovementChanged") + label;

    ui.notifications.warn(msg);
    game.socket.emit(SOCKET_NAME, { action: "movementchange", msg });
}

// ─── Token._canDrag Patch (with libWrapper support) ────────

function patchTokenCanDrag() {
    const wrapperFn = function (wrapped, ...args) {
        const result = wrapped(...args);
        return allowMovement(this.document, false) ? result : false;
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
});

Hooks.on("ready", () => {
    // Listen for socket messages from GM
    game.socket.on(SOCKET_NAME, (data) => {
        if (data.action === "movementchange") {
            ui.notifications.warn(data.msg);
        }
    });

    // Apply default movement mode on world load (primary GM only)
    if (isPrimaryGM()) {
        const defaultMovement = setting("default-movement");
        changeGlobalMovement(defaultMovement, false);
    }
});

// Block token position updates for non-GM users
Hooks.on("preUpdateToken", (document, update, options, userId) => {
    if ((update.x != undefined || update.y != undefined) && !game.user.isGM) {
        if (!allowMovement(document)) {
            delete update.x;
            delete update.y;
        }
    }
});

// Add cycling button to token controls
Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = controls.tokens;
    if (!tokenControls) return;

    const currentMovement = game.settings.get(MODULE_ID, "movement") || MOVEMENT_TYPE.FREE;

    tokenControls.tools.nmcToggleMovement = {
        name: "nmcToggleMovement",
        title: game.user.isGM ? "NMC.ToggleMovement" : i18n(MOVEMENT_LABELS[currentMovement] || MOVEMENT_LABELS[MOVEMENT_TYPE.FREE]),
        icon: MOVEMENT_ICONS[currentMovement] || MOVEMENT_ICONS[MOVEMENT_TYPE.FREE],
        toggle: false,
        button: true,
        onClick: () => {
            if (game.user.isGM) {
                cycleMovementMode();
            } else {
                const label = i18n(MOVEMENT_LABELS[currentMovement] || MOVEMENT_LABELS[MOVEMENT_TYPE.FREE]);
                ui.notifications.info(i18n("NMC.MovementChanged") + label);
            }
        }
    };
});

// Auto-set movement when combat starts (primary GM only)
Hooks.on("updateCombat", (combat, delta) => {
    if (!isPrimaryGM()) return;

    // Combat just started (round 1, turn 0)
    if (delta.round === 1 && combat.turn === 0 && combat.started === true) {
        const movementOnStart = setting("movement-on-combat-start");
        if (movementOnStart !== "ignore") {
            changeGlobalMovement(movementOnStart);
        }
    }
});

// Auto-set movement when combat ends (primary GM only)
Hooks.on("deleteCombat", (combat) => {
    if (!isPrimaryGM()) return;
    if (!combat.started) return;

    // Only trigger if no other combats remain
    if (game.combats.combats.length === 0) {
        const movementOnEnd = setting("movement-on-combat-end");
        if (movementOnEnd !== "ignore") {
            changeGlobalMovement(movementOnEnd);
        }
    }
});
