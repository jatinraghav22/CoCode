/**
 * prisma.js — Singleton Prisma Client
 *
 * We export a single shared PrismaClient instance used throughout the app.
 * This prevents the common mistake of creating multiple database connection
 * pools (one per file) which can exhaust MySQL connections quickly.
 *
 * During hot-reload (nodemon in development), Node's module cache is preserved,
 * so this same instance is reused — no connection leaks.
 */

"use strict";

const { PrismaClient } = require("@prisma/client");

// globalThis ensures the client is reused across hot-reloads in development
let prisma;

if (!globalThis.__prismaClient) {
    globalThis.__prismaClient = new PrismaClient({
        log: process.env.NODE_ENV === "development"
            ? ["warn", "error"]
            : ["error"],
    });
}

prisma = globalThis.__prismaClient;

// Gracefully disconnect when the Node process shuts down
process.on("beforeExit", async () => {
    await prisma.$disconnect();
});

module.exports = prisma;
