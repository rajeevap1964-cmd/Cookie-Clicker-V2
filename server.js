
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;

// =====================================================
// ADMIN SETTINGS
// Add or remove admin nicknames here
// =====================================================

const ADMIN_NAMES = new Set([
    "Cash"
]);

const ADMIN_CODE = "Chain1964";

// =====================================================
// WEBSITE
// =====================================================

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Cookie Clicker.html"));
});

// =====================================================
// UPGRADES
// =====================================================

// 180 CPS / Per Second upgrades
const cpsUpgrades = [];

for (let i = 1; i <= 180; i++) {
    cpsUpgrades.push({
        id: i,
        level: i,
        amount: i,
        baseCost: Math.pow(1.18, i) * 10
    });
}

// Unlimited click upgrades
const clickUpgrade = {
    baseCost: 25,
    basePower: 1
};

// =====================================================
// PLAYERS
// =====================================================

const players = new Map();

function cleanNickname(name) {
    return String(name || "")
        .trim()
        .replace(/[<>]/g, "")
        .slice(0, 20);
}

function send(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function broadcast(data) {
    const message = JSON.stringify(data);

    for (const player of players.values()) {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(message);
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

function isAdmin(player) {
    return player && ADMIN_NAMES.has(player.nickname);
}

function checkAdmin(player) {
    return player &&
        isAdmin(player) &&
        player.adminUnlocked === true;
}

function upgradeCost(base, level) {
    return Math.floor(base * Math.pow(1.15, level));
}

function getPublicPlayer(player) {
    return {
        nickname: player.nickname,
        cookies: Math.floor(player.cookies),
        perClick: Math.floor(player.perClick),
        cps: Number(player.cps.toFixed(2)),
        pr: Number(player.pr.toFixed(2)),
        clickLevel: player.clickLevel,
        cpsLevels: player.cpsLevels
    };
}

function leaderboard() {
    return [...players.values()]
        .sort((a, b) => b.cookies - a.cookies)
        .slice(0, 50)
        .map((p, index) => ({
            rank: index + 1,
            nickname: p.nickname,
            cookies: Math.floor(p.cookies),
            cps: Number(p.cps.toFixed(2)),
            pr: Number(p.pr.toFixed(2))
        }));
}

// =====================================================
// CONNECTION
// =====================================================

wss.on("connection", (ws) => {

    ws.on("message", (raw) => {

        let data;

        try {
            data = JSON.parse(raw.toString());
        } catch {
            return;
        }

        // =================================================
        // JOIN
        // =================================================

        if (data.type === "join") {

            const nickname = cleanNickname(data.nickname);

            if (!nickname) {
                send(ws, {
                    type: "error",
                    message: "Please enter a nickname."
                });
                return;
            }

            if (nickname.length < 2) {
                send(ws, {
                    type: "error",
                    message: "Nickname must be at least 2 characters."
                });
                return;
            }

            if (players.has(nickname)) {
                send(ws, {
                    type: "error",
                    message: "That nickname is already online."
                });
                return;
            }

            const player = {
                nickname,
                cookies: 0,
                perClick: 1,
                cps: 0,
                pr: 0,

                clickLevel: 0,

                // Stores CPS upgrade levels
                cpsLevels: {},

                ws,

                adminUnlocked: false,

                globalMultiplier: {
                    cookies: 1,
                    perClick: 1,
                    cps: 1,
                    pr: 1
                }
            };

            players.set(nickname, player);

            send(ws, {
                type: "joined",
                player: getPublicPlayer(player),
                admin: isAdmin(player)
            });

            broadcast({
                type: "leaderboard",
                leaderboard: leaderboard()
            });

            return;
        }

        const player = getPlayerBySocket(ws);

        if (!player) {
            send(ws, {
                type: "error",
                message: "Join the empire first."
            });
            return;
        }

        // =================================================
        // CLICK COOKIE
        // =================================================

        if (data.type === "click") {

            const amount =
                player.perClick *
                player.globalMultiplier.perClick *
                player.globalMultiplier.cookies;

            player.cookies += amount;

            send(ws, {
                type: "player",
                player: getPublicPlayer(player)
            });

            return;
        }

        // =================================================
        // BUY CPS / PER SECOND UPGRADE
        // =================================================

        if (data.type === "buyCpsUpgrade") {

            const id = Number(data.upgradeId);

            if (!Number.isInteger(id) || id < 1 || id > 180) {
                return;
            }

            const upgrade = cpsUpgrades[id - 1];

            const currentLevel =
                player.cpsLevels[id] || 0;

            const cost = upgradeCost(
                upgrade.baseCost,
                currentLevel
            );

            if (player.cookies < cost) {
                send(ws, {
                    type: "error",
                    message: `You need ${Math.floor(cost).toLocaleString()} cookies.`
                });
                return;
            }

            player.cookies -= cost;

            player.cps += upgrade.amount;

            player.cpsLevels[id] =
                currentLevel + 1;

            send(ws, {
                type: "purchaseSuccess",
                kind: "cps",
                upgradeId: id,
                cost,
                player: getPublicPlayer(player)
            });

            return;
        }

        // =================================================
        // BUY PER CLICK UPGRADE
        // =================================================

        if (data.type === "buyClickUpgrade") {

            const cost = upgradeCost(
                clickUpgrade.baseCost,
                player.clickLevel
            );

            if (player.cookies < cost) {
                send(ws, {
                    type: "error",
                    message: `You need ${Math.floor(cost).toLocaleString()} cookies.`
                });
                return;
            }

            player.cookies -= cost;

            player.clickLevel++;

            player.perClick +=
                clickUpgrade.basePower;

            send(ws, {
                type: "purchaseSuccess",
                kind: "click",
                cost,
                player: getPublicPlayer(player)
            });

            return;
        }

        // =================================================
        // ADMIN UNLOCK
        // =================================================

        if (data.type === "adminUnlock") {

            if (!isAdmin(player)) {
                send(ws, {
                    type: "error",
                    message: "You are not an authorized admin."
                });
                return;
            }

            if (String(data.code) !== ADMIN_CODE) {
                send(ws, {
                    type: "error",
                    message: "Incorrect admin code."
                });
                return;
            }

            player.adminUnlocked = true;

            send(ws, {
                type: "adminUnlocked",
                success: true
            });

            return;
        }

        // =================================================
        // ADMIN SET PLAYER STATS
        // =================================================

        if (data.type === "adminStats") {

            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message: "Admin permission required."
                });
                return;
            }

            const targetName = cleanNickname(data.target);
            const target = players.get(targetName);

            if (!target) {
                send(ws, {
                    type: "error",
                    message: "Target player is not online."
                });
                return;
            }

            if (data.cookies !== "" && data.cookies != null) {
                const value = Number(data.cookies);

                if (Number.isFinite(value)) {
                    target.cookies = Math.max(0, value);
                }
            }

            if (data.perClick !== "" && data.perClick != null) {
                const value = Number(data.perClick);

                if (Number.isFinite(value)) {
                    target.perClick = Math.max(1, value);
                }
            }

            if (data.cps !== "" && data.cps != null) {
                const value = Number(data.cps);

                if (Number.isFinite(value)) {
                    target.cps = Math.max(0, value);
                }
            }

            if (data.pr !== "" && data.pr != null) {
                const value = Number(data.pr);

                if (Number.isFinite(value)) {
                    target.pr = Math.max(0, value);
                }
            }

            send(target.ws, {
                type: "player",
                player: getPublicPlayer(target)
            });

            send(ws, {
                type: "adminSuccess",
                message: `${target.nickname}'s stats were updated.`
            });

            return;
        }

        // =================================================
        // GLOBAL ADMIN ABUSE
        // =================================================

        if (data.type === "globalAdminAbuse") {

            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message: "Admin permission required."
                });
                return;
            }

            const multiplier = Number(data.multiplier);
            const duration = Number(data.duration);
            const target = String(data.target || "ALL");

            if (!Number.isFinite(multiplier) || multiplier <= 0) {
                send(ws, {
                    type: "error",
                    message: "Invalid multiplier."
                });
                return;
            }

            if (!Number.isFinite(duration) || duration <= 0) {
                send(ws, {
                    type: "error",
                    message: "Invalid duration."
                });
                return;
            }

            const validTargets = [
                "COOKIES",
                "PERCLICK",
                "CPS",
                "PR",
                "ALL"
            ];

            if (!validTargets.includes(target)) {
                return;
            }

            for (const targetPlayer of players.values()) {

                if (target === "COOKIES" || target === "ALL") {
                    targetPlayer.globalMultiplier.cookies = multiplier;
                }

                if (target === "PERCLICK" || target === "ALL") {
                    targetPlayer.globalMultiplier.perClick = multiplier;
                }

                if (target === "CPS" || target === "ALL") {
                    targetPlayer.globalMultiplier.cps = multiplier;
                }

                if (target === "PR" || target === "ALL") {
                    targetPlayer.globalMultiplier.pr = multiplier;
                }
            }

            broadcast({
                type: "globalAbuse",
                sender: player.nickname,
                multiplier,
                duration,
                target
            });

            setTimeout(() => {

                for (const targetPlayer of players.values()) {

                    if (target === "COOKIES" || target === "ALL") {
                        targetPlayer.globalMultiplier.cookies = 1;
                    }

                    if (target === "PERCLICK" || target === "ALL") {
                        targetPlayer.globalMultiplier.perClick = 1;
                    }

                    if (target === "CPS" || target === "ALL") {
                        targetPlayer.globalMultiplier.cps = 1;
                    }

                    if (target === "PR" || target === "ALL") {
                        targetPlayer.globalMultiplier.pr = 1;
                    }
                }

                broadcast({
                    type: "globalAbuseStop",
                    sender: player.nickname
                });

            }, duration * 1000);

            return;
        }

        // =================================================
        // STOP GLOBAL ABUSE
        // =================================================

        if (data.type === "stopGlobalAbuse") {

            if (!checkAdmin(player)) {
                return;
            }

            for (const targetPlayer of players.values()) {
                targetPlayer.globalMultiplier = {
                    cookies: 1,
                    perClick: 1,
                    cps: 1,
                    pr: 1
                };
            }

            broadcast({
                type: "globalAbuseStop",
                sender: player.nickname
            });

            return;
        }

        // =================================================
        // GLOBAL MESSAGE
        // =================================================

        if (data.type === "globalMessage") {

            if (!checkAdmin(player)) {
                send(ws, {
                    type: "error",
                    message: "Admin permission required."
                });
                return;
            }

            const message = String(data.message || "")
                .trim()
                .slice(0, 200);

            if (!message) {
                return;
            }

            broadcast({
                type: "globalMessage",
                sender: player.nickname,
                message
            });

            return;
        }

    });

    // =====================================================
    // DISCONNECT
    // =====================================================

    ws.on("close", () => {

        const player = getPlayerBySocket(ws);

        if (!player) {
            return;
        }

        players.delete(player.nickname);

        broadcast({
            type: "leaderboard",
            leaderboard: leaderboard()
        });
    });
});

// =====================================================
// CPS LOOP
// =====================================================

setInterval(() => {

    for (const player of players.values()) {

        if (player.cps > 0) {

            const earned =
                player.cps *
                player.globalMultiplier.cps *
                player.globalMultiplier.cookies;

            player.cookies += earned;

            player.pr +=
                earned * 0.001;
        }

        send(player.ws, {
            type: "player",
            player: getPublicPlayer(player)
        });
    }

    broadcast({
        type: "leaderboard",
        leaderboard: leaderboard()
    });

}, 1000);

// =====================================================
// START
// =====================================================

server.listen(PORT, () => {

    console.log("");
    console.log("🍪 COOKIE EMPIRE");
    console.log("-----------------------------");
    console.log(`🌐 http://localhost:${PORT}`);
    console.log("⚡ CPS upgrades: 180");
    console.log("🖱️ Click upgrades: Unlimited");
    console.log("-----------------------------");
    console.log("");
});
