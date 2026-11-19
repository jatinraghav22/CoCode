const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateEmail,
  validatePassword,
  validateRegisterInput,
  validateLoginInput,
  validateUpdateProfileInput,
  validateChangePasswordInput,
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

test("Validation - validateUpdateProfileInput", () => {
  // Valid update
  const valid = validateUpdateProfileInput({ name: "  Ada Lovelace  " });
  assert.equal(valid.isValid, true);
  assert.equal(valid.normalized.name, "Ada Lovelace");

  // Non-object
  assert.equal(validateUpdateProfileInput(null).isValid, false);
  assert.equal(validateUpdateProfileInput([]).isValid, false);
  assert.equal(validateUpdateProfileInput("string").isValid, false);

  // Empty object
  const empty = validateUpdateProfileInput({});
  assert.equal(empty.isValid, false);
  assert.match(empty.error, /At least one field to update is required/);

  // Reject email modification
  const withEmail = validateUpdateProfileInput({ name: "Ada", email: "new@example.com" });
  assert.equal(withEmail.isValid, false);
  assert.match(withEmail.error, /Email cannot be updated/);

  // Reject password modification
  const withPass = validateUpdateProfileInput({ name: "Ada", password: "NewPassword123" });
  assert.equal(withPass.isValid, false);
  assert.match(withPass.error, /Password cannot be updated/);

  // Reject unexpected fields
  const withUnexpected = validateUpdateProfileInput({ name: "Ada", role: "admin" });
  assert.equal(withUnexpected.isValid, false);
  assert.match(withUnexpected.error, /Unexpected field/);

  // Invalid name length
  const shortName = validateUpdateProfileInput({ name: "A" });
  assert.equal(shortName.isValid, false);
  assert.match(shortName.error, /at least 2 characters/);

  const longName = validateUpdateProfileInput({ name: "A".repeat(51) });
  assert.equal(longName.isValid, false);
  assert.match(longName.error, /cannot exceed 50 characters/);
});

test("Validation - validateChangePasswordInput", () => {
  // Valid
  const valid = validateChangePasswordInput({
    currentPassword: "OldPassword123",
    newPassword: "NewPassword456",
  });
  assert.equal(valid.isValid, true);
  assert.equal(valid.normalized.currentPassword, "OldPassword123");
  assert.equal(valid.normalized.newPassword, "NewPassword456");

  // Non-object
  assert.equal(validateChangePasswordInput(null).isValid, false);
  assert.equal(validateChangePasswordInput("string").isValid, false);

  // Missing currentPassword
  const noCurrent = validateChangePasswordInput({ newPassword: "NewPassword456" });
  assert.equal(noCurrent.isValid, false);
  assert.match(noCurrent.error, /Current password is required/);

  // Missing newPassword
  const noNew = validateChangePasswordInput({ currentPassword: "OldPassword123" });
  assert.equal(noNew.isValid, false);
  assert.match(noNew.error, /New password is required/);

  // Reusing current password
  const same = validateChangePasswordInput({
    currentPassword: "SamePassword123",
    newPassword: "SamePassword123",
  });
  assert.equal(same.isValid, false);
  assert.match(same.error, /New password cannot be the same as the current password/);

  // Weak new password
  const weak = validateChangePasswordInput({
    currentPassword: "OldPassword123",
    newPassword: "weak",
  });
  assert.equal(weak.isValid, false);
  assert.match(weak.error, /Password must be at least 8 characters/);

  // Unexpected fields
  const unexpected = validateChangePasswordInput({
    currentPassword: "OldPassword123",
    newPassword: "NewPassword456",
    extra: "hacker",
  });
  assert.equal(unexpected.isValid, false);
  assert.match(unexpected.error, /Unexpected field/);
});
