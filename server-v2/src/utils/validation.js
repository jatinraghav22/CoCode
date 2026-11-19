const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates email format and length.
 *
 * @param {any} email
 * @returns {boolean}
 */
function validateEmail(email) {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Validates password strength:
 * - 8 to 72 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 *
 * @param {any} password
 * @returns {{ isValid: boolean, message?: string }}
 */
function validatePassword(password) {
  if (typeof password !== "string") {
    return {
      isValid: false,
      message: "Password must be a string.",
    };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long.",
    };
  }

  if (password.length > 72) {
    return {
      isValid: false,
      message: "Password cannot exceed 72 characters.",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one uppercase letter.",
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one lowercase letter.",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one number.",
    };
  }

  return { isValid: true };
}

/**
 * Validates registration input payload.
 *
 * @param {Object} body
 * @returns {{ isValid: boolean, error?: string, normalized?: { name: string, email: string, password: string } }}
 */
function validateRegisterInput(body) {
  const { name, email, password } = body || {};

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return {
      isValid: false,
      error: "Name must be at least 2 characters.",
    };
  }

  if (name.trim().length > 50) {
    return {
      isValid: false,
      error: "Name cannot exceed 50 characters.",
    };
  }

  if (!email || !validateEmail(email)) {
    return {
      isValid: false,
      error: "Please provide a valid email address.",
    };
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return {
      isValid: false,
      error: passwordValidation.message,
    };
  }

  return {
    isValid: true,
    normalized: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    },
  };
}

/**
 * Validates login input payload.
 *
 * @param {Object} body
 * @returns {{ isValid: boolean, error?: string, normalized?: { email: string, password: string } }}
 */
function validateLoginInput(body) {
  const { email, password } = body || {};

  if (!email || typeof email !== "string" || !validateEmail(email)) {
    return {
      isValid: false,
      error: "Please provide a valid email address.",
    };
  }

  if (!password || typeof password !== "string") {
    return {
      isValid: false,
      error: "Password is required.",
    };
  }

  return {
    isValid: true,
    normalized: {
      email: email.trim().toLowerCase(),
      password,
    },
  };
}

/**
 * Validates profile update input payload.
 * Only 'name' is permitted to be updated.
 *
 * @param {Object} body
 * @returns {{ isValid: boolean, error?: string, normalized?: { name: string } }}
 */
function validateUpdateProfileInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      isValid: false,
      error: "Request body must be a valid JSON object.",
    };
  }

  const keys = Object.keys(body);
  if (keys.length === 0) {
    return {
      isValid: false,
      error: "At least one field to update is required.",
    };
  }

  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    return {
      isValid: false,
      error: "Email cannot be updated through this endpoint.",
    };
  }

  if (
    Object.prototype.hasOwnProperty.call(body, "password") ||
    Object.prototype.hasOwnProperty.call(body, "passwordHash") ||
    Object.prototype.hasOwnProperty.call(body, "currentPassword") ||
    Object.prototype.hasOwnProperty.call(body, "newPassword")
  ) {
    return {
      isValid: false,
      error: "Password cannot be updated through this endpoint.",
    };
  }

  const allowedFields = ["name"];
  const unexpected = keys.filter((key) => !allowedFields.includes(key));
  if (unexpected.length > 0) {
    return {
      isValid: false,
      error: `Unexpected field: '${unexpected[0]}'. Only permitted fields can be updated.`,
    };
  }

  const { name } = body;
  if (typeof name !== "string" || name.trim().length < 2) {
    return {
      isValid: false,
      error: "Name must be at least 2 characters.",
    };
  }

  if (name.trim().length > 50) {
    return {
      isValid: false,
      error: "Name cannot exceed 50 characters.",
    };
  }

  return {
    isValid: true,
    normalized: {
      name: name.trim(),
    },
  };
}

/**
 * Validates change password input payload.
 *
 * @param {Object} body
 * @returns {{ isValid: boolean, error?: string, normalized?: { currentPassword: string, newPassword: string } }}
 */
function validateChangePasswordInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      isValid: false,
      error: "Request body must be a valid JSON object.",
    };
  }

  const keys = Object.keys(body);
  const allowedFields = ["currentPassword", "newPassword"];
  const unexpected = keys.filter((key) => !allowedFields.includes(key));
  if (unexpected.length > 0) {
    return {
      isValid: false,
      error: `Unexpected field: '${unexpected[0]}'. Only currentPassword and newPassword are permitted.`,
    };
  }

  const { currentPassword, newPassword } = body;

  if (!currentPassword || typeof currentPassword !== "string") {
    return {
      isValid: false,
      error: "Current password is required.",
    };
  }

  if (!newPassword || typeof newPassword !== "string") {
    return {
      isValid: false,
      error: "New password is required.",
    };
  }

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return {
      isValid: false,
      error: passwordValidation.message,
    };
  }

  if (currentPassword === newPassword) {
    return {
      isValid: false,
      error: "New password cannot be the same as the current password.",
    };
  }

  return {
    isValid: true,
    normalized: {
      currentPassword,
      newPassword,
    },
  };
}

module.exports = {
  validateEmail,
  validatePassword,
  validateRegisterInput,
  validateLoginInput,
  validateUpdateProfileInput,
  validateChangePasswordInput,
};
