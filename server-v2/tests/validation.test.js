const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateEmail,
  validatePassword,
  validateRegisterInput,
  validateLoginInput,
} = require("../src/utils/validation");

test("Validation - validateEmail", () => {
  assert.equal(validateEmail("user@example.com"), true);
  assert.equal(validateEmail("test.user+tag@domain.co.uk"), true);
  assert.equal(validateEmail("invalid-email"), false);
  assert.equal(validateEmail("@no-user.com"), false);
  assert.equal(validateEmail("no-domain@"), false);
  assert.equal(validateEmail(""), false);
  assert.equal(validateEmail(null), false);
  assert.equal(validateEmail({}), false);
});

test("Validation - validatePassword strength checks", () => {
  // Valid password: >= 8 chars, uppercase, lowercase, number
  assert.equal(validatePassword("ValidPass1").isValid, true);
  assert.equal(validatePassword("A1b2C3d4!").isValid, true);

  // Too short (< 8)
  const shortResult = validatePassword("Ab1");
  assert.equal(shortResult.isValid, false);
  assert.match(shortResult.message, /at least 8 characters/);

  // Missing uppercase
  const noUpper = validatePassword("lowercase1");
  assert.equal(noUpper.isValid, false);
  assert.match(noUpper.message, /uppercase/);

  // Missing lowercase
  const noLower = validatePassword("UPPERCASE1");
  assert.equal(noLower.isValid, false);
  assert.match(noLower.message, /lowercase/);

  // Missing number
  const noNumber = validatePassword("NoNumbersHere");
  assert.equal(noNumber.isValid, false);
  assert.match(noNumber.message, /number/);

  // Non-string
  const nonString = validatePassword(12345678);
  assert.equal(nonString.isValid, false);
});

test("Validation - validateRegisterInput", () => {
  const valid = validateRegisterInput({
    name: "  Grace Hopper  ",
    email: "  Grace@Example.COM  ",
    password: "Password123",
  });
  assert.equal(valid.isValid, true);
  assert.equal(valid.normalized.name, "Grace Hopper");
  assert.equal(valid.normalized.email, "grace@example.com");
  assert.equal(valid.normalized.password, "Password123");

  // Invalid name
  const badName = validateRegisterInput({
    name: "A",
    email: "grace@example.com",
    password: "Password123",
  });
  assert.equal(badName.isValid, false);
  assert.match(badName.error, /Name must be at least 2 characters/);

  // Invalid email
  const badEmail = validateRegisterInput({
    name: "Grace",
    email: "not-an-email",
    password: "Password123",
  });
  assert.equal(badEmail.isValid, false);
  assert.match(badEmail.error, /valid email/);

  // Weak password
  const weakPass = validateRegisterInput({
    name: "Grace",
    email: "grace@example.com",
    password: "weak",
  });
  assert.equal(weakPass.isValid, false);
  assert.match(weakPass.error, /Password/);
});

test("Validation - validateLoginInput", () => {
  const valid = validateLoginInput({
    email: "  User@domain.COM ",
    password: "Secret123",
  });
  assert.equal(valid.isValid, true);
  assert.equal(valid.normalized.email, "user@domain.com");
  assert.equal(valid.normalized.password, "Secret123");

  const missingEmail = validateLoginInput({ password: "Secret123" });
  assert.equal(missingEmail.isValid, false);

  const missingPassword = validateLoginInput({ email: "user@domain.com" });
  assert.equal(missingPassword.isValid, false);
});
