
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// =====================================================
// COOKIE EMPIRE
// =====================================================

const ADMIN_NAMES = new Set([
    "Cash",
    "ChakraCraft"
]);

const OWNER_NAMES = new Set([
    "Cash",
    "ChakraCraft"
]);

const ADMIN_CODE = "Chain1964";
const BAN_CODE = "1979";

// =====================================================
// PERSISTENT DATABASE
// =====================================================

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "players.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

let database = {
    players: {},
    bans: {}
};

try {
    if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(
            DATA_FILE,
            "utf8"
        );

        const loaded = JSON.parse(raw);

        database = {
            players:
                loaded &&
                loaded.players &&
                typeof loaded.players === "object"
                    ? loaded.players
                    : {},

            bans:
                loaded &&
                loaded.bans &&
                typeof loaded.bans === "object"
                    ? loaded.bans
                    : {}
        };
    }
} catch (error) {
    console.log(
        "Could not load database. Creating a new database."
    );

    database = {
        players: {},
        bans: {}
    };
}

let dirty = false;
let saveTimer = null;

function queueSave() {
    dirty = true;

    if (saveTimer) {
        return;
    }

    saveTimer = setTimeout(() => {
        saveTimer = null;
        saveDatabase();
    }, 500);
}

function saveDatabase() {
    if (!dirty) {
        return;
    }

    try {
        const tempFile = DATA_FILE + ".tmp";

        fs.writeFileSync(
            tempFile,
            JSON.stringify(
                database,
                null,
                2
            ),
            "utf8"
        );

        fs.renameSync(
            tempFile,
            DATA_FILE
        );

        dirty = false;

        console.log("💾 Database saved.");
    } catch (error) {
        console.error(
            "Database save error:",
            error
        );
    }
}

process.on("SIGINT", () => {
    for (const player of players.values()) {
        persistPlayer(player);
    }

    dirty = true;
    saveDatabase();

    process.exit(0);
});

process.on("SIGTERM", () => {
    for (const player of players.values()) {
        persistPlayer(player);
    }

    dirty = true;
    saveDatabase();

    process.exit(0);
});

// =====================================================
// WEBSITE
// =====================================================

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "Cookie Clicker.html"
        )
    );
});

// =====================================================
// COOKIE SKINS
// =====================================================

const COOKIE_SKINS = [
    {
        id: "classic",
        name: "Classic Cookie",
        icon: "🍪",
        rarity: "Common",
        cookies: 0,
        clicks: 0
    },

    {
        id: "chocolate",
        name: "Chocolate Cookie",
        icon: "🍫",
        rarity: "Common",
        cookies: 500,
        clicks: 0
    },

    {
        id: "strawberry",
        name: "Strawberry Cookie",
        icon: "🍓",
        rarity: "Uncommon",
        cookies: 2500,
        clicks: 1000
    },

    {
        id: "golden",
        name: "Golden Cookie",
        icon: "🟡",
        rarity: "Rare",
        cookies: 10000,
        clicks: 5000
    },

    {
        id: "diamond",
        name: "Diamond Cookie",
        icon: "💎",
        rarity: "Epic",
        cookies: 50000,
        clicks: 15000
    },

    {
        id: "rainbow",
        name: "Rainbow Cookie",
        icon: "🌈",
        rarity: "Legendary",
        cookies: 250000,
        clicks: 50000
    },

    {
        id: "royal",
        name: "Royal Cookie",
        icon: "👑",
        rarity: "Mythic",
        cookies: 1000000,
        clicks: 150000
    },

    {
        id: "galaxy",
        name: "Galaxy Cookie",
        icon: "🌌",
        rarity: "Mythic",
        cookies: 10000000,
        clicks: 500000
    },

    {
        id: "inferno",
        name: "Inferno Cookie",
        icon: "🔥",
        rarity: "Divine",
        cookies: 100000000,
        clicks: 2000000
    },

    {
        id: "cosmic",
        name: "Cosmic Cookie",
        icon: "🪐",
        rarity: "Divine",
        cookies: 1000000000,
        clicks: 10000000
    },

    {
        id: "void",
        name: "Void Cookie",
        icon: "🕳️",
        rarity: "Secret",
        cookies: 10000000000,
        clicks: 50000000
    },

    {
        id: "infinity",
        name: "Infinity Cookie",
        icon: "♾️",
        rarity: "Secret",
        cookies: 100000000000,
        clicks: 100000000
    }
];

// =====================================================
// 180 CPS UPGRADES
// =====================================================

const cpsUpgrades = [];

for (let i = 1; i <= 180; i++) {
    cpsUpgrades.push({
        id: i,
        amount: i,
        baseCost:
            400000 *
            Math.pow(1.45, i - 1)
    });
}

// =====================================================
// 180 CLICK UPGRADES
// =====================================================

const clickUpgrades = [];

for (let i = 1; i <= 180; i++) {
    clickUpgrades.push({
        id: i,
        amount: i,
        baseCost:
            400000 *
            Math.pow(1.45, i - 1)
    });
}

// =====================================================
// ONLINE PLAYERS
// =====================================================

const players = new Map();

// =====================================================
// GLOBAL ABUSE
// =====================================================

let abuseTimer = null;
let abuseId = 0;

// =====================================================
// HELPERS
// =====================================================

function cleanNickname(name) {
    return String(name || "")
        .trim()
        .replace(/[<>]/g, "")
        .slice(0, 20);
}

function playerKey(name) {
    return cleanNickname(name).toLowerCase();
}

function send(ws, data) {
    if (
        ws &&
        ws.readyState === WebSocket.OPEN
    ) {
        try {
            ws.send(JSON.stringify(data));
        } catch {}
    }
}

function broadcast(data) {
    const message = JSON.stringify(data);

    for (const player of players.values()) {
        if (
            player.ws &&
            player.ws.readyState ===
                WebSocket.OPEN
        ) {
            try {
                player.ws.send(message);
            } catch {}
        }
    }
}

function getPlayerBySocket(ws) {
    for (const player of players.values()) {
        if (player.ws === ws) {
            return player;
        }
    }

    return null;
}

function findOnlinePlayer(name) {
    const wanted = playerKey(name);

    if (!wanted) {
        return null;
    }

    for (const player of players.values()) {
        if (
            playerKey(player.nickname) ===
            wanted
        ) {
            return player;
        }
    }

    return null;
}

function nameMatches(name, nameSet) {
    if (!name) {
        return false;
    }

    const normalizedName = String(name)
        .trim()
        .toLowerCase();

    for (const allowedName of nameSet) {
        if (
            String(allowedName)
                .trim()
                .toLowerCase() ===
            normalizedName
        ) {
            return true;
        }
    }

    return false;
}

function isOwner(player) {
    return Boolean(
        player &&
        nameMatches(
            player.nickname,
            OWNER_NAMES
        )
    );
}

function isAdmin(player) {
    return Boolean(
        player &&
        nameMatches(
            player.nickname,
            ADMIN_NAMES
        )
    );
}

function checkAdmin(player) {
    return Boolean(
        player &&
        isAdmin(player) &&
        player.adminUnlocked === true
    );
}

function isBanned(name) {
    return Boolean(
        database.bans[playerKey(name)]
    );
}

function getBan(name) {
    return (
        database.bans[playerKey(name)] ||
        null
    );
}

function clampNumber(value, min, max) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return min;
    }

    return Math.max(
        min,
        Math.min(max, number)
    );
}

function integerValue(value, min, max) {
    return Math.floor(
        clampNumber(value, min, max)
    );
}

// =====================================================
// UPGRADE HELPERS
// =====================================================

function getUpgradeCost(upgrade, purchases) {
    const count = Math.max(
        0,
        Math.floor(Number(purchases) || 0)
    );

    return Math.floor(
        upgrade.baseCost *
        Math.pow(1.15, count)
    );
}

function getCpsUpgradeCost(id, purchases) {
    const upgrade = cpsUpgrades[id - 1];

    if (!upgrade) {
        return Infinity;
    }

    return getUpgradeCost(
        upgrade,
        purchases
    );
}

function getClickUpgradeCost(id, purchases) {
    const upgrade = clickUpgrades[id - 1];

    if (!upgrade) {
        return Infinity;
    }

    return getUpgradeCost(
        upgrade,
        purchases
    );
}

function highestCpsUpgradeUnlocked(player) {
    return integerValue(
        player.cpsLevel,
        0,
        180
    );
}

function highestClickUpgradeUnlocked(player) {
    return integerValue(
        player.clickLevel,
        0,
        180
    );
}

// =====================================================
// UPGRADE TOTAL CALCULATION
// =====================================================

function calculateCpsFromPurchases(player) {
    let total = 0;

    const levels =
        player.cpsLevels &&
        typeof player.cpsLevels === "object"
            ? player.cpsLevels
            : {};

    for (const [id, count] of Object.entries(levels)) {
        const upgrade =
            cpsUpgrades[Number(id) - 1];

        const purchases =
            Number(count);

        if (
            upgrade &&
            Number.isFinite(purchases) &&
            purchases > 0
        ) {
            total +=
                upgrade.amount *
                Math.floor(purchases);
        }
    }

    return Math.max(0, total);
}

function calculatePerClickFromPurchases(player) {
    let total = 1;

    const levels =
        player.clickLevels &&
        typeof player.clickLevels === "object"
            ? player.clickLevels
            : {};

    for (const [id, count] of Object.entries(levels)) {
        const upgrade =
            clickUpgrades[Number(id) - 1];

        const purchases =
            Number(count);

        if (
            upgrade &&
            Number.isFinite(purchases) &&
            purchases > 0
        ) {
            total +=
                upgrade.amount *
                Math.floor(purchases);
        }
    }

    return Math.max(1, total);
}

function syncUpgradeStats(player) {
    player.cps =
        calculateCpsFromPurchases(player);

    player.perClick =
        calculatePerClickFromPurchases(player);
}

// =====================================================
// DEFAULT PLAYER
// =====================================================

function defaultPlayer(nickname) {
    return {
        nickname,

        cookies: 0,
        totalCookies: 0,
        clicks: 0,

        perClick: 1,
        cps: 0,
        pr: 0,

        clickLevel: 0,
        cpsLevel: 0,

        clickLevels: {},
        cpsLevels: {},

        unlockedSkins: [
            "classic"
        ],

        equippedSkin: "classic",

        adminUnlocked: false
    };
}

// =====================================================
// PURCHASE MAP
// =====================================================

function sanitizePurchaseMap(map) {
    const result = {};

    if (
        !map ||
        typeof map !== "object" ||
        Array.isArray(map)
    ) {
        return result;
    }

    for (
        const [key, value]
        of Object.entries(map)
    ) {
        const id = Number(key);

        if (
            !Number.isInteger(id) ||
            id < 1 ||
            id > 180
        ) {
            continue;
        }

        const count = integerValue(
            value,
            0,
            Number.MAX_SAFE_INTEGER
        );

        if (count > 0) {
            result[id] = count;
        }
    }

    return result;
}

// =====================================================
// SANITIZE PLAYER
// =====================================================

function sanitizePlayer(player, nickname) {
    const base =
        defaultPlayer(nickname);

    const result = {
        ...base,
        ...(player || {})
    };

    result.nickname = nickname;

    result.cookies = Math.max(
        0,
        Number(result.cookies) || 0
    );

    result.totalCookies = Math.max(
        0,
        Number(result.totalCookies) || 0
    );

    result.clicks = Math.max(
        0,
        Math.floor(
            Number(result.clicks) || 0
        )
    );

    result.clickLevels =
        sanitizePurchaseMap(
            result.clickLevels ||
            result.clickPurchaseCounts
        );

    result.cpsLevels =
        sanitizePurchaseMap(
            result.cpsLevels ||
            result.cpsPurchaseCounts
        );

    result.clickLevel =
        integerValue(
            result.clickLevel,
            0,
            180
        );

    result.cpsLevel =
        integerValue(
            result.cpsLevel,
            0,
            180
        );

    for (
        const id of Object.keys(
            result.clickLevels
        )
    ) {
        result.clickLevel =
            Math.max(
                result.clickLevel,
                Number(id)
            );
    }

    for (
        const id of Object.keys(
            result.cpsLevels
        )
    ) {
        result.cpsLevel =
            Math.max(
                result.cpsLevel,
                Number(id)
            );
    }

    if (
        !Array.isArray(
            result.unlockedSkins
        )
    ) {
        result.unlockedSkins = [
            "classic"
        ];
    }

    result.unlockedSkins =
        result.unlockedSkins.filter(
            id =>
                COOKIE_SKINS.some(
                    skin =>
                        skin.id === id
                )
        );

    result.unlockedSkins = [
        ...new Set(
            result.unlockedSkins
        )
    ];

    if (
        !result.unlockedSkins.includes(
            "classic"
        )
    ) {
        result.unlockedSkins.unshift(
            "classic"
        );
    }

    if (
        !COOKIE_SKINS.some(
            skin =>
                skin.id ===
                result.equippedSkin
        )
    ) {
        result.equippedSkin =
            "classic";
    }

    if (
        !result.unlockedSkins.includes(
            result.equippedSkin
        )
    ) {
        result.equippedSkin =
            "classic";
    }

    result.adminUnlocked =
        Boolean(
            result.adminUnlocked
        );

    /*
     * IMPORTANT:
     * If upgrade purchase maps exist,
     * they are the source of truth.
     */
    if (
        Object.keys(
            result.cpsLevels
        ).length > 0 ||
        Object.keys(
            result.clickLevels
        ).length > 0
    ) {
        syncUpgradeStats(result);
    } else {
        result.perClick =
            Math.max(
                1,
                Number(result.perClick) || 1
            );

        result.cps =
            Math.max(
                0,
                Number(result.cps) || 0
            );
    }

    result.pr = Math.max(
        0,
        Number(result.pr) || 0
    );

    return result;
}

// =====================================================
// SAVED PLAYER
// =====================================================

function getSavedPlayer(nickname) {
    const key = playerKey(nickname);

    if (!database.players[key]) {
        database.players[key] =
            defaultPlayer(nickname);

        queueSave();
    }

    const canonicalName =
        database.players[key].nickname ||
        nickname;

    database.players[key] =
        sanitizePlayer(
            database.players[key],
            canonicalName
        );

    return database.players[key];
}

// =====================================================
// PERSIST ONLINE PLAYER
// =====================================================

function persistPlayer(player) {
    if (!player) {
        return;
    }

    const key =
        playerKey(player.nickname);

    database.players[key] =
        sanitizePlayer(
            player,
            player.nickname
        );
}

// =====================================================
// SKINS
// =====================================================

function skinRequirementsMet(
    player,
    skin
) {
    return (
        Number(player.totalCookies) >=
            Number(skin.cookies) &&
        Number(player.clicks) >=
            Number(skin.clicks)
    );
}

/*
 * IMPORTANT:
 * This function ONLY unlocks skins.
 * It NEVER equips a new skin.
 */

function updateSkins(player) {
    let changed = false;

    for (const skin of COOKIE_SKINS) {
        if (
            skinRequirementsMet(
                player,
                skin
            ) &&
            !player.unlockedSkins.includes(
                skin.id
            )
        ) {
            player.unlockedSkins.push(
                skin.id
            );

            changed = true;

            send(player.ws, {
                type:
                    "skinUnlocked",

                skin
            });
        }
    }

    if (changed) {
        queueSave();
    }
}

function getCurrentSkin(player) {
    return (
        COOKIE_SKINS.find(
            skin =>
                skin.id ===
                player.equippedSkin
        ) ||
        COOKIE_SKINS[0]
    );
}

function getNextSkin(player) {
    for (const skin of COOKIE_SKINS) {
        if (
            !player.unlockedSkins.includes(
                skin.id
            )
        ) {
            return skin;
        }
    }

    return null;
}

function getSkinOwnerCount(skinId) {
    let count = 0;

    for (
        const player of Object.values(
            database.players
        )
    ) {
        if (
            Array.isArray(
                player.unlockedSkins
            ) &&
            player.unlockedSkins.includes(
                skinId
            )
        ) {
            count++;
        }
    }

    return count;
}

// =====================================================
// PUBLIC PLAYER
// =====================================================

function getPublicPlayer(player) {
    updateSkins(player);

    const skin =
        getCurrentSkin(player);

    const nextSkin =
        getNextSkin(player);

    return {
        nickname:
            player.nickname,

        cookies:
            Math.floor(
                player.cookies
            ),

        totalCookies:
            Math.floor(
                player.totalCookies
            ),

        clicks:
            Math.floor(
                player.clicks
            ),

        perClick:
            Math.floor(
                player.perClick
            ),

        cps:
            Number(
                Number(
                    player.cps
                ).toFixed(2)
            ),

        pr:
            Number(
                Number(
                    player.pr
                ).toFixed(2)
            ),

        clickLevel:
            player.clickLevel,

        cpsLevel:
            player.cpsLevel,

        clickLevels: {
            ...player.clickLevels
        },

        cpsLevels: {
            ...player.cpsLevels
        },

        clickPurchaseCounts: {
            ...player.clickLevels
        },

        cpsPurchaseCounts: {
            ...player.cpsLevels
        },

        unlockedSkins: [
            ...player.unlockedSkins
        ],

        equippedSkin:
            player.equippedSkin,

        skin: {
            id: skin.id,
            name: skin.name,
            icon: skin.icon,
            rarity: skin.rarity
        },

        nextSkin:
            nextSkin
                ? {
                    id:
                        nextSkin.id,

                    name:
                        nextSkin.name,

                    icon:
                        nextSkin.icon,

                    rarity:
                        nextSkin.rarity,

                    cookies:
                        nextSkin.cookies,

                    clicks:
                        nextSkin.clicks,

                    cookieRequirement:
                        nextSkin.cookies,

                    clickRequirement:
                        nextSkin.clicks
                }
                : null,

        isOwner:
            isOwner(player),

        isAdmin:
            isAdmin(player),

        online: true
    };
}

// =====================================================
// LEADERBOARD
// =====================================================

function leaderboard() {
    const normalPlayers =
        Object.values(
            database.players
        )
            .filter(
                player =>
                    !nameMatches(
                        player.nickname,
                        OWNER_NAMES
                    )
            )
            .sort(
                (a, b) =>
                    Number(
                        b.cookies
                    ) -
                    Number(
                        a.cookies
                    )
            )
            .slice(0, 50);

    return normalPlayers.map(
        (
            player,
            index
        ) => {
            const skin =
                getCurrentSkin(player);

            return {
                rank:
                    index + 1,

                nickname:
                    player.nickname,

                cookies:
                    Math.floor(
                        player.cookies
                    ),

                totalCookies:
                    Math.floor(
                        player.totalCookies
                    ),

                cps:
                    Number(
                        Number(
                            player.cps
                        ).toFixed(2)
                    ),

                skin: {
                    id: skin.id,
                    name: skin.name,
                    icon: skin.icon,
                    rarity:
                        skin.rarity
                },

                isOwner: false,

                isAdmin:
                    nameMatches(
                        player.nickname,
                        ADMIN_NAMES
                    ),

                online:
                    Boolean(
                        findOnlinePlayer(
                            player.nickname
                        )
                    )
            };
        }
    );
}

// =====================================================
// OWNER LEADERBOARD
// =====================================================

function ownerLeaderboard() {
    return Object.values(
        database.players
    )
        .filter(
            player =>
                nameMatches(
                    player.nickname,
                    OWNER_NAMES
                )
        )
        .map(player => {
            const skin =
                getCurrentSkin(player);

            return {
                nickname:
                    player.nickname,

                cookies:
                    Math.floor(
                        player.cookies
                    ),

                cps:
                    Number(
                        Number(
                            player.cps
                        ).toFixed(2)
                    ),

                skin: {
                    id: skin.id,
                    name: skin.name,
                    icon: skin.icon,
                    rarity:
                        skin.rarity
                },

                owner: true,

                online:
                    Boolean(
                        findOnlinePlayer(
                            player.nickname
                        )
                    )
            };
        });
}

// =====================================================
// ADMIN PLAYER LIST
// =====================================================

function adminPlayerList() {
    return Object.values(
        database.players
    )
        .sort(
            (a, b) =>
                Number(
                    b.cookies
                ) -
                Number(
                    a.cookies
                )
        )
        .map(player => ({
            nickname:
                player.nickname,

            cookies:
                Math.floor(
                    player.cookies
                ),

            totalCookies:
                Math.floor(
                    player.totalCookies
                ),

            cps:
                Number(
                    Number(
                        player.cps
                    ).toFixed(2)
                ),

            perClick:
                Math.floor(
                    player.perClick
                ),

            pr:
                Number(
                    Number(
                        player.pr
                    ).toFixed(2)
                ),

            clicks:
                Math.floor(
                    player.clicks
                ),

            cpsLevel:
                integerValue(
                    player.cpsLevel,
                    0,
                    180
                ),

            clickLevel:
                integerValue(
                    player.clickLevel,
                    0,
                    180
                ),

            cpsPurchases: {
                ...(player.cpsLevels || {})
            },

            clickPurchases: {
                ...(player.clickLevels || {})
            },

            unlockedSkins:
                Array.isArray(
                    player.unlockedSkins
                )
                    ? [
                        ...player.unlockedSkins
                    ]
                    : ["classic"],

            equippedSkin:
                player.equippedSkin ||
                "classic",

            online:
                Boolean(
                    findOnlinePlayer(
                        player.nickname
                    )
                ),

            banned:
                isBanned(
                    player.nickname
                ),

            isAdmin:
                isAdmin(player),

            isOwner:
                isOwner(player),

            skin:
                getCurrentSkin(player)
        }));
}

// =====================================================
// COOKIE INDEX
// =====================================================

function sendCookieIndex(ws, player) {
    send(ws, {
        type:
            "cookieIndex",

        skins:
            COOKIE_SKINS.map(
                skin => ({
                    ...skin,

                    unlocked:
                        player.unlockedSkins.includes(
                            skin.id
                        ),

                    equipped:
                        player.equippedSkin ===
                        skin.id,

                    owners:
                        getSkinOwnerCount(
                            skin.id
                        ),

                    unlockedCount:
                        getSkinOwnerCount(
                            skin.id
                        ),

                    cookieRequirement:
                        skin.cookies,

                    clickRequirement:
                        skin.clicks
                })
            )
    });
}

// =====================================================
// WORLD
// =====================================================

function sendWorldUpdate() {
    broadcast({
        type:
            "world",

        online:
            players.size,

        leaderboard:
            leaderboard(),

        owners:
            ownerLeaderboard()
    });
}

// =====================================================
// ADMIN DATA
// =====================================================

function sendAdminData(ws) {
    const player =
        getPlayerBySocket(ws);

    if (!checkAdmin(player)) {
        send(ws, {
            type: "error",
            message:
                "Admin permission required."
        });

        return;
    }

    send(ws, {
        type:
            "adminData",

        players:
            adminPlayerList(),

        online:
            players.size,

        totalPlayers:
            Object.keys(
                database.players
            ).length,

        banned:
            Object.keys(
                database.bans
            ).length,

        owners:
            ownerLeaderboard(),

        skins:
            COOKIE_SKINS,

        cpsUpgrades:
            cpsUpgrades.map(
                upgrade => ({
                    id:
                        upgrade.id,

                    amount:
                        upgrade.amount,

                    baseCost:
                        Math.floor(
                            upgrade.baseCost
                        )
                })
            ),

        clickUpgrades:
            clickUpgrades.map(
                upgrade => ({
                    id:
                        upgrade.id,

                    amount:
                        upgrade.amount,

                    baseCost:
                        Math.floor(
                            upgrade.baseCost
                        )
                })
            )
    });
}

// =====================================================
// GLOBAL MULTIPLIERS
// =====================================================

function resetGlobalMultipliers() {
    for (
        const player of players.values()
    ) {
        player.globalMultiplier = {
            cookies: 1,
            perClick: 1,
            cps: 1,
            pr: 1
        };
    }
}

function stopAbuseTimer() {
    abuseId++;

    if (abuseTimer) {
        clearTimeout(abuseTimer);
        abuseTimer = null;
    }
}

// =====================================================
// ADMIN TARGET
// =====================================================

function getAdminTarget(name) {
    const clean =
        cleanNickname(name);

    if (!clean) {
        return {
            online: null,
            saved: null,
            name: ""
        };
    }

    const online =
        findOnlinePlayer(clean);

    const key =
        playerKey(clean);

    let saved =
        database.players[key]
            ? sanitizePlayer(
                database.players[key],
                database.players[key]
                    .nickname ||
                    clean
            )
            : null;

    if (saved) {
        database.players[key] =
            saved;
    }

    return {
        online,
        saved,
        name:
            online
                ? online.nickname
                : saved
                    ? saved.nickname
                    : clean
    };
}

// =====================================================
// ADMIN STATS
// =====================================================

function applyAdminStats(
    target,
    stats
) {
    if (!target) {
        return false;
    }

    stats =
        stats &&
        typeof stats === "object"
            ? stats
            : {};

    let changed = false;

    if (
        stats.cookies !== undefined &&
        stats.cookies !== ""
    ) {
        const value =
            Number(stats.cookies);

        if (
            Number.isFinite(value)
        ) {
            target.cookies =
                Math.max(
                    0,
                    value
                );

            changed = true;
        }
    }

    if (
        stats.totalCookies !==
            undefined &&
        stats.totalCookies !== ""
    ) {
        const value =
            Number(
                stats.totalCookies
            );

        if (
            Number.isFinite(value)
        ) {
            target.totalCookies =
                Math.max(
                    0,
                    value
                );

            changed = true;
        }
    }

    if (
        stats.clicks !== undefined &&
        stats.clicks !== ""
    ) {
        const value =
            Number(stats.clicks);

        if (
            Number.isFinite(value)
        ) {
            target.clicks =
                Math.max(
                    0,
                    Math.floor(value)
                );

            changed = true;
        }
    }

    /*
     * Admin CPS/perClick are allowed as direct
     * values only when no upgrade purchase map
     * is being edited.
     */
    if (
        stats.cps !== undefined &&
        stats.cps !== ""
    ) {
        const value =
            Number(stats.cps);

        if (
            Number.isFinite(value)
        ) {
            target.cps =
                Math.max(
                    0,
                    value
                );

            changed = true;
        }
    }

    if (
        stats.perClick !== undefined &&
        stats.perClick !== ""
    ) {
        const value =
            Number(stats.perClick);

        if (
            Number.isFinite(value)
        ) {
            target.perClick =
                Math.max(
                    1,
                    value
                );

            changed = true;
        }
    }

    if (
        stats.pr !== undefined &&
        stats.pr !== ""
    ) {
        const value =
            Number(stats.pr);

        if (
            Number.isFinite(value)
        ) {
            target.pr =
                Math.max(
                    0,
                    value
                );

            changed = true;
        }
    }

    return changed;
}

// =====================================================
// ADMIN UPGRADE CONTROL
// =====================================================

function applyUpgradePurchaseMaps(
    target,
    data
) {
    let changed = false;

    if (
        data.cpsPurchases !==
        undefined
    ) {
        target.cpsLevels =
            sanitizePurchaseMap(
                data.cpsPurchases
            );

        changed = true;
    }

    if (
        data.clickPurchases !==
        undefined
    ) {
        target.clickLevels =
            sanitizePurchaseMap(
                data.clickPurchases
            );

        changed = true;
    }

    if (
        data.cpsUpgradeId != null &&
        data.cpsPurchaseCount != null
    ) {
        const id =
            integerValue(
                data.cpsUpgradeId,
                1,
                180
            );

        const count =
            integerValue(
                data.cpsPurchaseCount,
                0,
                Number.MAX_SAFE_INTEGER
            );

        if (count <= 0) {
            delete target.cpsLevels[id];
        } else {
            target.cpsLevels[id] =
                count;
        }

        changed = true;
    }

    if (
        data.clickUpgradeId != null &&
        data.clickPurchaseCount != null
    ) {
        const id =
            integerValue(
                data.clickUpgradeId,
                1,
                180
            );

        const count =
            integerValue(
                data.clickPurchaseCount,
                0,
                Number.MAX_SAFE_INTEGER
            );

        if (count <= 0) {
            delete target.clickLevels[id];
        } else {
            target.clickLevels[id] =
                count;
        }

        changed = true;
    }

    return changed;
}

function applyAdminUpgradeLevels(
    target,
    data
) {
    let changed = false;

    if (
        data.cpsLevel !==
            undefined &&
        data.cpsLevel !== ""
    ) {
        target.cpsLevel =
            integerValue(
                data.cpsLevel,
                0,
                180
            );

        changed = true;
    }

    if (
        data.clickLevel !==
            undefined &&
        data.clickLevel !== ""
    ) {
        target.clickLevel =
            integerValue(
                data.clickLevel,
                0,
                180
            );

        changed = true;
    }

    if (
        data.unlockAllCps === true
    ) {
        target.cpsLevel = 180;
        changed = true;
    }

    if (
        data.unlockAllClick === true
    ) {
        target.clickLevel = 180;
        changed = true;
    }

    if (
        data.lockAll === true
    ) {
        target.cpsLevel = 0;
        target.clickLevel = 0;

        target.cpsLevels = {};
        target.clickLevels = {};

        target.cps = 0;
        target.perClick = 1;

        changed = true;
    }

    return changed;
}

// =====================================================
// WEBSOCKET
// =====================================================

wss.on("connection", ws => {

    ws.on("message", raw => {

        let data;

        try {
            data =
                JSON.parse(
                    raw.toString()
                );
        } catch {
            send(ws, {
                type: "error",
                message:
                    "Invalid server message."
            });

            return;
        }

        if (
            !data ||
            typeof data !== "object"
        ) {
            return;
        }

        // =================================================
        // JOIN
        // =================================================

        if (
            data.type === "join"
        ) {
            const nickname =
                cleanNickname(
                    data.nickname
                );

            if (!nickname) {
                send(ws, {
                    type: "error",
                    message:
                        "Please enter a nickname."
                });

                return;
            }

            if (nickname.length < 2) {
                send(ws, {
                    type: "error",
                    message:
                        "Nickname must be at least 2 characters."
                });

                return;
            }

            const ban =
                getBan(nickname);

            if (ban) {
                send(ws, {
                    type:
                        "banned",

                    message:
                        "You are banned from Cookie Empire.",

                    reason:
                        ban.reason ||
                        "No reason provided.",

                    bannedBy:
                        ban.bannedBy ||
                        "Admin"
                });

                return;
            }

            const saved =
                getSavedPlayer(
                    nickname
                );

            const realName =
                saved.nickname;

            if (
                findOnlinePlayer(
                    realName
                )
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "That nickname is already online."
                });

                return;
            }

            updateSkins(saved);

            const player = {
                ...saved,

                ws,

                globalMultiplier: {
                    cookies: 1,
                    perClick: 1,
                    cps: 1,
                    pr: 1
                }
            };

            players.set(
                player.nickname,
                player
            );

            send(ws, {
                type:
                    "joined",

                player:
                    getPublicPlayer(
                        player
                    ),

                admin:
                    isAdmin(player),

                owner:
                    isOwner(player),

                online:
                    players.size
            });

            sendCookieIndex(
                ws,
                player
            );

            sendWorldUpdate();

            return;
        }

        // =================================================
        // GET PLAYER
        // =================================================

        const player =
            getPlayerBySocket(ws);

        if (!player) {
            send(ws, {
                type: "error",
                message:
                    "Join the empire first."
            });

            return;
        }

        // =================================================
        // COOKIE CLICK
        // =================================================

        if (
            data.type === "click"
        ) {
            const amount =
                Number(
                    player.perClick
                ) *
                Number(
                    player
                        .globalMultiplier
                        .perClick
                ) *
                Number(
                    player
                        .globalMultiplier
                        .cookies
                );

            if (
                !Number.isFinite(
                    amount
                ) ||
                amount <= 0
            ) {
                return;
            }

            player.cookies += amount;
            player.totalCookies += amount;
            player.clicks++;

            updateSkins(player);

            queueSave();

            send(ws, {
                type:
                    "player",

                player:
                    getPublicPlayer(
                        player
                    )
            });

            return;
        }

        // =================================================
        // CPS UPGRADE
        // =================================================

        if (
            data.type ===
            "buyCpsUpgrade"
        ) {
            const id =
                Number(
                    data.upgradeId ??
                    data.id
                );

            if (
                !Number.isInteger(id) ||
                id < 1 ||
                id > 180
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "Invalid CPS upgrade."
                });

                return;
            }

            const highest =
                highestCpsUpgradeUnlocked(
                    player
                );

            const allowed =
                highest + 1;

            if (id > allowed) {
                send(ws, {
                    type: "error",
                    message:
                        `You must buy CPS Upgrade #${allowed} first.`
                });

                return;
            }

            const upgrade =
                cpsUpgrades[id - 1];

            const purchases =
                integerValue(
                    player
                        .cpsLevels[id],
                    0,
                    Number.MAX_SAFE_INTEGER
                );

            const cost =
                getUpgradeCost(
                    upgrade,
                    purchases
                );

            if (
                player.cookies < cost
            ) {
                send(ws, {
                    type: "error",
                    message:
                        `You need ${cost.toLocaleString()} cookies.`
                });

                return;
            }

            player.cookies -= cost;

            player.cpsLevels[id] =
                purchases + 1;

            if (
                id >
                player.cpsLevel
            ) {
                player.cpsLevel = id;
            }

            syncUpgradeStats(player);

            queueSave();

            send(ws, {
                type:
                    "purchaseSuccess",

                kind:
                    "cps",

                upgradeId:
                    id,

                cost,

                purchases:
                    player.cpsLevels[id],

                nextCost:
                    getCpsUpgradeCost(
                        id,
                        player.cpsLevels[id]
                    ),

                player:
                    getPublicPlayer(
                        player
                    )
            });

            sendWorldUpdate();

            return;
        }

        // =================================================
        // CLICK UPGRADE
        // =================================================

        if (
            data.type ===
            "buyClickUpgrade"
        ) {
            const id =
                Number(
                    data.upgradeId ??
                    data.id
                );

            if (
                !Number.isInteger(id) ||
                id < 1 ||
                id > 180
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "Invalid Click upgrade."
                });

                return;
            }

            const highest =
                highestClickUpgradeUnlocked(
                    player
                );

            const allowed =
                highest + 1;

            if (id > allowed) {
                send(ws, {
                    type: "error",
                    message:
                        `You must buy Click Upgrade #${allowed} first.`
                });

                return;
            }

            const upgrade =
                clickUpgrades[id - 1];

            const purchases =
                integerValue(
                    player
                        .clickLevels[id],
                    0,
                    Number.MAX_SAFE_INTEGER
                );

            const cost =
                getUpgradeCost(
                    upgrade,
                    purchases
                );

            if (
                player.cookies < cost
            ) {
                send(ws, {
                    type: "error",
                    message:
                        `You need ${cost.toLocaleString()} cookies.`
                });

                return;
            }

            player.cookies -= cost;

            player.clickLevels[id] =
                purchases + 1;

            if (
                id >
                player.clickLevel
            ) {
                player.clickLevel = id;
            }

            syncUpgradeStats(player);

            queueSave();

            send(ws, {
                type:
                    "purchaseSuccess",

                kind:
                    "click",

                upgradeId:
                    id,

                cost,

                purchases:
                    player.clickLevels[id],

                nextCost:
                    getClickUpgradeCost(
                        id,
                        player.clickLevels[id]
                    ),

                player:
                    getPublicPlayer(
                        player
                    )
            });

            sendWorldUpdate();

            return;
        }

        // =================================================
        // EQUIP SKIN
        // =================================================

        if (
            data.type ===
            "equipSkin"
        ) {
            const skinId =
                String(
                    data.skinId ??
                    data.id ??
                    ""
                );

            const skin =
                COOKIE_SKINS.find(
                    s =>
                        s.id ===
                        skinId
                );

            if (!skin) {
                send(ws, {
                    type: "error",
                    message:
                        "Invalid cookie skin."
                });

                return;
            }

            if (
                !player
                    .unlockedSkins
                    .includes(
                        skinId
                    )
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "You have not unlocked that cookie skin yet."
                });

                return;
            }

            player.equippedSkin =
                skinId;

            queueSave();

            send(ws, {
                type:
                    "player",

                player:
                    getPublicPlayer(
                        player
                    )
            });

            sendCookieIndex(
                ws,
                player
            );

            sendWorldUpdate();

            return;
        }

        // =================================================
        // COOKIE INDEX
        // =================================================

        if (
            data.type ===
                "getIndex" ||
            data.type ===
                "cookieIndex"
        ) {
            sendCookieIndex(
                ws,
                player
            );

            return;
        }

        // =================================================
        // ADMIN UNLOCK
        // =================================================

        if (
            data.type ===
            "adminUnlock"
        ) {
            if (!isAdmin(player)) {
                send(ws, {
                    type: "error",
                    message:
                        "You are not an authorized admin."
                });

                return;
            }

            if (
                String(data.code) !==
                ADMIN_CODE
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "Incorrect admin code."
                });

                return;
            }

            player.adminUnlocked = true;

            queueSave();

            send(ws, {
                type:
                    "adminUnlocked",

                success: true
            });

            sendAdminData(ws);

            return;
        }

        // =================================================
        // ADMIN DATA
        // =================================================

        if (
            data.type ===
            "adminData"
        ) {
            sendAdminData(ws);
            return;
        }

        // =================================================
        // ADMIN STATS
        // =================================================

        if (
            data.type ===
            "adminStats"
        ) {
            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message:
                        "Admin permission required."
                });

                return;
            }

            const info =
                getAdminTarget(
                    data.target
                );

            if (
                !info.online &&
                !info.saved
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "Player was not found."
                });

                return;
            }

            const target =
                info.online ||
                info.saved;

            const changed =
                applyAdminStats(
                    target,
                    data.stats
                );

            if (!changed) {
                send(ws, {
                    type:
                        "adminSuccess",

                    message:
                        "No statistic changes were made."
                });

                sendAdminData(ws);

                return;
            }

            persistPlayer(target);

            queueSave();

            if (info.online) {
                send(
                    info.online.ws,
                    {
                        type:
                            "player",

                        player:
                            getPublicPlayer(
                                info.online
                            )
                    }
                );

                sendCookieIndex(
                    info.online.ws,
                    info.online
                );
            }

            send(ws, {
                type:
                    "adminSuccess",

                message:
                    `${target.nickname}'s stats were updated.`
            });

            sendAdminData(ws);

            sendWorldUpdate();

            return;
        }

        // =================================================
        // ADMIN UPGRADES
        // =================================================

        if (
            data.type ===
            "adminUpgrades"
        ) {
            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message:
                        "Admin permission required."
                });

                return;
            }

            const info =
                getAdminTarget(
                    data.target
                );

            if (
                !info.online &&
                !info.saved
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "Player was not found."
                });

                return;
            }

            const target =
                info.online ||
                info.saved;

            const levelChanged =
                applyAdminUpgradeLevels(
                    target,
                    data
                );

            const purchaseChanged =
                applyUpgradePurchaseMaps(
                    target,
                    data
                );

            for (
                const id of Object.keys(
                    target.cpsLevels
                )
            ) {
                target.cpsLevel =
                    Math.max(
                        target.cpsLevel,
                        Number(id)
                    );
            }

            for (
                const id of Object.keys(
                    target.clickLevels
                )
            ) {
                target.clickLevel =
                    Math.max(
                        target.clickLevel,
                        Number(id)
                    );
            }

            /*
             * FIX:
             * Whenever admin changes purchase maps,
             * CPS and Per Click are recalculated.
             */
            if (
                purchaseChanged
            ) {
                syncUpgradeStats(
                    target
                );
            }

            const changed =
                levelChanged ||
                purchaseChanged;

            if (!changed) {
                send(ws, {
                    type:
                        "adminSuccess",

                    message:
                        "No upgrade changes were made."
                });

                sendAdminData(ws);

                return;
            }

            persistPlayer(target);

            queueSave();

            if (info.online) {
                send(
                    info.online.ws,
                    {
                        type:
                            "player",

                        player:
                            getPublicPlayer(
                                info.online
                            )
                    }
                );
            }

            send(ws, {
                type:
                    "adminSuccess",

                message:
                    `${target.nickname}'s upgrades were updated.`
            });

            sendAdminData(ws);

            sendWorldUpdate();

            return;
        }

        // =================================================
        // ADMIN SKINS
        // =================================================

        if (
            data.type ===
            "adminSkin"
        ) {
            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message:
                        "Admin permission required."
                });

                return;
            }

            const info =
                getAdminTarget(
                    data.target
                );

            if (
                !info.online &&
                !info.saved
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "Player was not found."
                });

                return;
            }

            const target =
                info.online ||
                info.saved;

            const action =
                String(
                    data.action || ""
                );

            const skinId =
                String(
                    data.skinId || ""
                );

            if (
                action ===
                "unlockAll"
            ) {
                target.unlockedSkins =
                    COOKIE_SKINS.map(
                        skin =>
                            skin.id
                    );
            }

            else if (
                action ===
                "lockAll"
            ) {
                target.unlockedSkins =
                    ["classic"];

                target.equippedSkin =
                    "classic";
            }

            else if (
                action ===
                "unlock"
            ) {
                const skin =
                    COOKIE_SKINS.find(
                        s =>
                            s.id ===
                            skinId
                    );

                if (!skin) {
                    send(ws, {
                        type:
                            "error",
                        message:
                            "Invalid skin."
                    });

                    return;
                }

                if (
                    !target
                        .unlockedSkins
                        .includes(
                            skin.id
                        )
                ) {
                    target.unlockedSkins.push(
                        skin.id
                    );
                }
            }

            else if (
                action ===
                "lock"
            ) {
                if (
                    skinId ===
                    "classic"
                ) {
                    send(ws, {
                        type:
                            "error",
                        message:
                            "Classic Cookie cannot be locked."
                    });

                    return;
                }

                if (
                    !COOKIE_SKINS.some(
                        skin =>
                            skin.id ===
                            skinId
                    )
                ) {
                    send(ws, {
                        type:
                            "error",
                        message:
                            "Invalid skin."
                    });

                    return;
                }

                target.unlockedSkins =
                    target.unlockedSkins.filter(
                        id =>
                            id !==
                            skinId
                    );

                if (
                    target.equippedSkin ===
                    skinId
                ) {
                    target.equippedSkin =
                        "classic";
                }
            }

            else if (
                action ===
                "equip"
            ) {
                if (
                    !COOKIE_SKINS.some(
                        skin =>
                            skin.id ===
                            skinId
                    )
                ) {
                    send(ws, {
                        type:
                            "error",
                        message:
                            "Invalid skin."
                    });

                    return;
                }

                if (
                    target
                        .unlockedSkins
                        .includes(
                            skinId
                        )
                ) {
                    target.equippedSkin =
                        skinId;
                } else {
                    send(ws, {
                        type:
                            "error",
                        message:
                            "That player has not unlocked this skin."
                    });

                    return;
                }
            }

            else {
                send(ws, {
                    type: "error",
                    message:
                        "Invalid skin action."
                });

                return;
            }

            persistPlayer(target);

            queueSave();

            if (info.online) {
                send(
                    info.online.ws,
                    {
                        type:
                            "player",

                        player:
                            getPublicPlayer(
                                info.online
                            )
                    }
                );

                sendCookieIndex(
                    info.online.ws,
                    info.online
                );
            }

            send(ws, {
                type:
                    "adminSuccess",

                message:
                    `${target.nickname}'s skins were updated.`
            });

            sendAdminData(ws);

            sendWorldUpdate();

            return;
        }

        // =================================================
        // ADMIN KICK
        // =================================================

        if (
            data.type ===
                "adminKick" ||
            data.type ===
                "kickPlayer"
        ) {
            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message:
                        "Admin permission required."
                });

                return;
            }

            const target =
                findOnlinePlayer(
                    data.target
                );

            if (!target) {
                send(ws, {
                    type: "error",
                    message:
                        "That player is not online."
                });

                return;
            }

            if (isOwner(target)) {
                send(ws, {
                    type: "error",
                    message:
                        "Owners cannot be kicked."
                });

                return;
            }

            if (isAdmin(target)) {
                send(ws, {
                    type: "error",
                    message:
                        "Administrators cannot be kicked."
                });

                return;
            }

            const reason =
                String(
                    data.reason ||
                    "Kicked by an administrator."
                )
                    .trim()
                    .slice(0, 200);

            send(
                target.ws,
                {
                    type:
                        "kicked",

                    reason
                }
            );

            setTimeout(() => {
                try {
                    target.ws.close();
                } catch {}
            }, 100);

            send(ws, {
                type:
                    "adminSuccess",

                message:
                    `${target.nickname} was kicked.`
            });

            return;
        }

        // =================================================
        // ADMIN BAN
        // =================================================

        if (
            data.type ===
                "adminBan" ||
            data.type ===
                "banPlayer"
        ) {
            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message:
                        "Admin permission required."
                });

                return;
            }

            if (
                String(data.code) !==
                BAN_CODE
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "Incorrect ban code."
                });

                return;
            }

            const targetName =
                cleanNickname(
                    data.target
                );

            if (!targetName) {
                send(ws, {
                    type: "error",
                    message:
                        "Enter a player nickname."
                });

                return;
            }

            if (
                nameMatches(
                    targetName,
                    OWNER_NAMES
                )
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "🛡️ Cash and ChakraCraft are protected and can never be banned."
                });

                return;
            }

            if (
                nameMatches(
                    targetName,
                    ADMIN_NAMES
                )
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "Administrators cannot be banned."
                });

                return;
            }

            const reason =
                String(
                    data.reason ||
                    "No reason provided."
                )
                    .trim()
                    .slice(0, 200);

            const target =
                findOnlinePlayer(
                    targetName
                );

            const canonicalName =
                target
                    ? target.nickname
                    : (
                        database.players[
                            playerKey(
                                targetName
                            )
                        ]?.nickname ||
                        targetName
                    );

            const key =
                playerKey(
                    canonicalName
                );

            database.bans[key] = {
                nickname:
                    canonicalName,

                reason,

                bannedBy:
                    player.nickname,

                timestamp:
                    Date.now(),

                permanent:
                    true
            };

            queueSave();

            if (target) {
                send(
                    target.ws,
                    {
                        type:
                            "banned",

                        message:
                            "You have been banned from Cookie Empire.",

                        reason,

                        bannedBy:
                            player.nickname
                    }
                );

                setTimeout(() => {
                    try {
                        target.ws.close();
                    } catch {}
                }, 100);
            }

            send(ws, {
                type:
                    "adminSuccess",

                message:
                    `${canonicalName} has been permanently banned.`
            });

            sendAdminData(ws);

            sendWorldUpdate();

            return;
        }

        // =================================================
        // ADMIN UNBAN
        // =================================================

        if (
            data.type ===
                "adminUnban" ||
            data.type ===
                "unbanPlayer"
        ) {
            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message:
                        "Admin permission required."
                });

                return;
            }

            if (
                String(data.code) !==
                BAN_CODE
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "Incorrect ban code."
                });

                return;
            }

            const targetName =
                cleanNickname(
                    data.target
                );

            const key =
                playerKey(
                    targetName
                );

            if (
                !database.bans[key]
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "That player is not banned."
                });

                return;
            }

            delete database.bans[key];

            queueSave();

            send(ws, {
                type:
                    "adminSuccess",

                message:
                    `${targetName} has been unbanned.`
            });

            sendAdminData(ws);

            sendWorldUpdate();

            return;
        }

        // =================================================
        // GLOBAL ABUSE
        // =================================================

        if (
            data.type ===
                "globalAdminAbuse" ||
            data.type ===
                "globalAbuse"
        ) {
            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message:
                        "Admin permission required."
                });

                return;
            }

            const multiplier =
                Number(
                    data.multiplier
                );

            const durationNumber =
                Number(
                    data.duration
                );

            const duration =
                Number.isFinite(
                    durationNumber
                ) &&
                durationNumber > 0
                    ? Math.min(
                        durationNumber,
                        86400
                    )
                    : 60;

            const target =
                String(
                    data.target ||
                    "ALL"
                )
                    .toUpperCase();

            const validTargets = [
                "COOKIES",
                "PERCLICK",
                "CPS",
                "PR",
                "ALL"
            ];

            if (
                !Number.isFinite(
                    multiplier
                ) ||
                multiplier <= 0
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "Invalid multiplier."
                });

                return;
            }

            if (
                !validTargets.includes(
                    target
                )
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "Invalid abuse target."
                });

                return;
            }

            stopAbuseTimer();

            for (
                const targetPlayer
                of players.values()
            ) {
                targetPlayer.globalMultiplier = {
                    cookies: 1,
                    perClick: 1,
                    cps: 1,
                    pr: 1
                };

                if (
                    target ===
                        "COOKIES" ||
                    target === "ALL"
                ) {
                    targetPlayer
                        .globalMultiplier
                        .cookies =
                        multiplier;
                }

                if (
                    target ===
                        "PERCLICK" ||
                    target === "ALL"
                ) {
                    targetPlayer
                        .globalMultiplier
                        .perClick =
                        multiplier;
                }

                if (
                    target === "CPS" ||
                    target === "ALL"
                ) {
                    targetPlayer
                        .globalMultiplier
                        .cps =
                        multiplier;
                }

                if (
                    target === "PR" ||
                    target === "ALL"
                ) {
                    targetPlayer
                        .globalMultiplier
                        .pr =
                        multiplier;
                }
            }

            const currentAbuse =
                ++abuseId;

            broadcast({
                type:
                    "globalAbuse",

                sender:
                    player.nickname,

                multiplier,

                duration,

                target
            });

            abuseTimer =
                setTimeout(() => {
                    if (
                        currentAbuse !==
                        abuseId
                    ) {
                        return;
                    }

                    abuseTimer = null;

                    resetGlobalMultipliers();

                    broadcast({
                        type:
                            "globalAbuseStop",

                        sender:
                            player.nickname
                    });
                }, duration * 1000);

            return;
        }

        // =================================================
        // STOP GLOBAL ABUSE
        // =================================================

        if (
            data.type ===
                "stopGlobalAbuse" ||
            data.type ===
                "globalAbuseStop"
        ) {
            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message:
                        "Admin permission required."
                });

                return;
            }

            stopAbuseTimer();

            resetGlobalMultipliers();

            broadcast({
                type:
                    "globalAbuseStop",

                sender:
                    player.nickname
            });

            return;
        }

        // =================================================
        // GLOBAL MESSAGE
        // =================================================

        if (
            data.type ===
            "globalMessage"
        ) {
            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message:
                        "Admin permission required."
                });

                return;
            }

            const message =
                String(
                    data.message || ""
                )
                    .trim()
                    .slice(0, 200);

            if (!message) {
                return;
            }

            broadcast({
                type:
                    "globalMessage",

                sender:
                    player.nickname,

                message
            });

            return;
        }

        // =================================================
        // SAVE DATABASE
        // =================================================

        if (
            data.type ===
                "adminSave" ||
            data.type ===
                "saveDatabaseNow"
        ) {
            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message:
                        "Admin permission required."
                });

                return;
            }

            for (
                const onlinePlayer
                of players.values()
            ) {
                persistPlayer(
                    onlinePlayer
                );
            }

            dirty = true;

            saveDatabase();

            send(ws, {
                type:
                    "adminSuccess",

                message:
                    "Database saved successfully."
            });

            sendAdminData(ws);

            return;
        }

        // =================================================
        // RESET PLAYER
        // =================================================

        if (
            data.type ===
                "adminResetPlayer" ||
            data.type ===
                "resetPlayer"
        ) {
            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message:
                        "Admin permission required."
                });

                return;
            }

            const info =
                getAdminTarget(
                    data.target
                );

            if (
                !info.online &&
                !info.saved
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "Player was not found."
                });

                return;
            }

            const target =
                info.online ||
                info.saved;

            if (isOwner(target)) {
                send(ws, {
                    type: "error",
                    message:
                        "Cash and ChakraCraft cannot be reset."
                });

                return;
            }

            if (isAdmin(target)) {
                send(ws, {
                    type: "error",
                    message:
                        "Administrators cannot be reset."
                });

                return;
            }

            const fresh =
                defaultPlayer(
                    target.nickname
                );

            target.cookies =
                fresh.cookies;

            target.totalCookies =
                fresh.totalCookies;

            target.clicks =
                fresh.clicks;

            target.perClick =
                fresh.perClick;

            target.cps =
                fresh.cps;

            target.pr =
                fresh.pr;

            target.clickLevel =
                fresh.clickLevel;

            target.cpsLevel =
                fresh.cpsLevel;

            target.clickLevels =
                fresh.clickLevels;

            target.cpsLevels =
                fresh.cpsLevels;

            target.unlockedSkins =
                fresh.unlockedSkins;

            target.equippedSkin =
                fresh.equippedSkin;

            persistPlayer(target);

            queueSave();

            if (info.online) {
                send(
                    info.online.ws,
                    {
                        type:
                            "player",

                        player:
                            getPublicPlayer(
                                info.online
                            )
                    }
                );

                sendCookieIndex(
                    info.online.ws,
                    info.online
                );
            }

            send(ws, {
                type:
                    "adminSuccess",

                message:
                    `${target.nickname} was reset.`
            });

            sendAdminData(ws);

            sendWorldUpdate();

            return;
        }

        // =================================================
        // GIVE EVERYTHING
        // =================================================

        if (
            data.type ===
            "adminGiveEverything"
        ) {
            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message:
                        "Admin permission required."
                });

                return;
            }

            const info =
                getAdminTarget(
                    data.target
                );

            if (
                !info.online &&
                !info.saved
            ) {
                send(ws, {
                    type: "error",
                    message:
                        "Player was not found."
                });

                return;
            }

            const target =
                info.online ||
                info.saved;

            target.cookies =
                Math.max(
                    target.cookies,
                    1e15
                );

            target.totalCookies =
                Math.max(
                    target.totalCookies,
                    1e15
                );

            target.clicks =
                Math.max(
                    target.clicks,
                    100000000
                );

            target.pr =
                Math.max(
                    target.pr,
                    1e12
                );

            /*
             * Unlock every tier.
             */
            target.clickLevel = 180;
            target.cpsLevel = 180;

            /*
             * Give one purchase to every tier.
             * Then calculate the real CPS and Per Click
             * from those purchases.
             */
            target.clickLevels = {};
            target.cpsLevels = {};

            for (
                let i = 1;
                i <= 180;
                i++
            ) {
                target.clickLevels[i] = 1;
                target.cpsLevels[i] = 1;
            }

            syncUpgradeStats(target);

            /*
             * Unlock all skins.
             *
             * IMPORTANT:
             * DO NOT change equippedSkin.
             */
            target.unlockedSkins =
                COOKIE_SKINS.map(
                    skin =>
                        skin.id
                );

            persistPlayer(target);

            queueSave();

            if (info.online) {
                send(
                    info.online.ws,
                    {
                        type:
                            "player",

                        player:
                            getPublicPlayer(
                                info.online
                            )
                    }
                );

                sendCookieIndex(
                    info.online.ws,
                    info.online
                );
            }

            send(ws, {
                type:
                    "adminSuccess",

                message:
                    `${target.nickname} received all upgrades and skins.`
            });

            sendAdminData(ws);

            sendWorldUpdate();

            return;
        }
    });

    // =================================================
    // DISCONNECT
    // =================================================

    ws.on("close", () => {
        const player =
            getPlayerBySocket(ws);

        if (!player) {
            return;
        }

        persistPlayer(player);

        queueSave();

        players.delete(
            player.nickname
        );

        sendWorldUpdate();
    });
});

// =====================================================
// CPS LOOP
// =====================================================

setInterval(() => {

    for (
        const player
        of players.values()
    ) {
        if (player.cps > 0) {

            const earned =
                Number(player.cps) *
                Number(
                    player
                        .globalMultiplier
                        .cps
                ) *
                Number(
                    player
                        .globalMultiplier
                        .cookies
                );

            if (
                Number.isFinite(
                    earned
                ) &&
                earned > 0
            ) {
                player.cookies +=
                    earned;

                player.totalCookies +=
                    earned;

                player.pr +=
                    earned *
                    0.001 *
                    Number(
                        player
                            .globalMultiplier
                            .pr
                    );
            }
        }

        updateSkins(player);

        send(player.ws, {
            type:
                "player",

            player:
                getPublicPlayer(
                    player
                )
        });
    }

    if (players.size > 0) {
        queueSave();
    }

    sendWorldUpdate();

}, 1000);

// =====================================================
// START SERVER
// =====================================================

server.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "🍪 COOKIE EMPIRE"
        );

        console.log(
            "-----------------------------"
        );

        console.log(
            `🌐 http://localhost:${PORT}`
        );

        console.log(
            "💾 Data: data/players.json"
        );

        console.log(
            "⚡ CPS upgrades: 180"
        );

        console.log(
            "🖱️ Click upgrades: 180"
        );

        console.log(
            "🍪 Cookie skins: 12"
        );

        console.log(
            "👑 Protected owners: Cash, ChakraCraft"
        );

        console.log(
            "🔐 Admin code: enabled"
        );

        console.log(
            "🚫 Ban code: enabled"
        );

        console.log(
            "🛠️ Full admin controls: enabled"
        );

        console.log(
            "🔁 Repeatable upgrades: enabled"
        );

        console.log(
            "🎨 Manual skin equip: enabled"
        );

        console.log(
            "-----------------------------"
        );

        console.log("");
    }
);
