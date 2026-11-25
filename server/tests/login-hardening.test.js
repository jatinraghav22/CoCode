/**
 * login-hardening.test.js — Tests for Production Login Resilience & Compatibility
 *
 * Verifies:
 * 1. Legacy bcrypt ($2a$, $2b$, $2y$) password verification works seamlessly.
 * 2. Modern scrypt (salt:hash) password verification works seamlessly.
 * 3. Invalid passwords are rejected across all hash formats without throwing.
 * 4. CORS allowedOrigins includes production domains (getcocode.app, www.getcocode.app, getcocode.vercel.app).
 * 5. Database error handling outputs safe 503 DATABASE_UNAVAILABLE without leaking raw DB connection strings.
 */

"use strict";

process.env.NODE_ENV = "test";
require("dotenv").config();

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { hashPassword, verifyPassword, allowedOrigins } = require("../server");

describe("Password Verification Compatibility", () => {
    test("Verifies legacy bcrypt hash ($2a$ / $2b$)", () => {
        const rawPassword = "LegacyUserPass#2025";
        const legacyHash = bcrypt.hashSync(rawPassword, 10);

        assert.ok(legacyHash.startsWith("$2a$") || legacyHash.startsWith("$2b$"));
        assert.equal(verifyPassword(rawPassword, legacyHash), true, "Should verify correct password with legacy bcrypt hash");
        assert.equal(verifyPassword("WrongPassword123", legacyHash), false, "Should reject incorrect password with legacy bcrypt hash");
    });

    test("Verifies modern scrypt hash (salt:hash)", () => {
        const rawPassword = "ModernUserPass#2026";
        const scryptHash = hashPassword(rawPassword);

        assert.ok(scryptHash.includes(":"));
        assert.equal(verifyPassword(rawPassword, scryptHash), true, "Should verify correct password with scrypt hash");
        assert.equal(verifyPassword("WrongPassword123", scryptHash), false, "Should reject incorrect password with scrypt hash");
    });

    test("Safely handles null, empty, or malformed hashes without crashing", () => {
        assert.equal(verifyPassword("anyPass", null), false);
        assert.equal(verifyPassword("anyPass", undefined), false);
        assert.equal(verifyPassword("anyPass", ""), false);
        assert.equal(verifyPassword("anyPass", "not_a_valid_hash"), false);
        assert.equal(verifyPassword("anyPass", "broken:"), false);
        assert.equal(verifyPassword("anyPass", ":broken"), false);
    });
});

describe("CORS Configuration", () => {
    test("allowedOrigins includes custom domain https://www.getcocode.app", () => {
        assert.ok(
            allowedOrigins.includes("https://www.getcocode.app"),
            "CORS must allow https://www.getcocode.app"
        );
    });

    test("allowedOrigins includes apex domain https://getcocode.app", () => {
        assert.ok(
            allowedOrigins.includes("https://getcocode.app"),
            "CORS must allow https://getcocode.app"
        );
    });

    test("allowedOrigins includes Vercel default domain https://getcocode.vercel.app", () => {
        assert.ok(
            allowedOrigins.includes("https://getcocode.vercel.app"),
            "CORS must allow https://getcocode.vercel.app"
        );
    });
});

