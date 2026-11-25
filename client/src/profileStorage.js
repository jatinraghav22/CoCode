function getStorage(storage) {
  if (storage) return storage;
  if (typeof window !== "undefined") return window.localStorage;
  return null;
}

export const ALLOWED_PROFILE_EXTRA_FIELDS = Object.freeze([
  "username",
  "phone",
  "location",
  "bio",
  "skills",
  "socialLinks",
  "avatarUrl",
]);

export const FORBIDDEN_OVERRIDE_FIELDS = Object.freeze([
  "id",
  "email",
  "name",
  "role",
  "status",
  "accountStatus",
  "isActive",
  "isOwner",
  "permissions",
  "password",
  "passwordHash",
  "token",
  "createdAt",
  "updatedAt",
  "sub",
]);

export function profileExtrasKey(userId) {
  return `cocode_profile_extras:${String(userId)}`;
}

export function sanitizeProfileExtras(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  const clean = {};

  if (typeof data.username === "string") {
    clean.username = data.username.trim().slice(0, 50);
  }

  if (typeof data.phone === "string") {
    clean.phone = data.phone.trim().slice(0, 30);
  }

  if (typeof data.location === "string") {
    clean.location = data.location.trim().slice(0, 100);
  }

  if (typeof data.bio === "string") {
    clean.bio = data.bio.trim().slice(0, 1000);
  }

  if (typeof data.avatarUrl === "string") {
    clean.avatarUrl = data.avatarUrl.trim();
  }

  if (Array.isArray(data.skills)) {
    clean.skills = data.skills
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim().slice(0, 50));
  }

  if (data.socialLinks && typeof data.socialLinks === "object" && !Array.isArray(data.socialLinks)) {
    const cleanLinks = {};
    for (const [key, val] of Object.entries(data.socialLinks)) {
      if (typeof val === "string") {
        cleanLinks[key] = val.trim().slice(0, 200);
      }
    }
    clean.socialLinks = cleanLinks;
  }

  return clean;
}

export function readProfileExtras(userId, storage) {
  if (userId === null || userId === undefined || userId === "") return {};

  try {
    const target = getStorage(storage);
    if (!target) return {};

    const raw = target.getItem(profileExtrasKey(userId));
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return sanitizeProfileExtras(parsed);
  } catch {
    return {};
  }
}

export function saveProfileExtras(userId, profileData, storage) {
  if (userId === null || userId === undefined || userId === "") return false;

  try {
    const target = getStorage(storage);
    if (!target) return false;

    const safeData = sanitizeProfileExtras(profileData);
    target.setItem(profileExtrasKey(userId), JSON.stringify(safeData));
    return true;
  } catch {
    return false;
  }
}

export function mergeUserWithProfileExtras(user, storage) {
  if (!user || user.id === null || user.id === undefined) return user;

  const extras = readProfileExtras(user.id, storage);

  const safeExtras = {};
  for (const [k, v] of Object.entries(extras)) {
    if (ALLOWED_PROFILE_EXTRA_FIELDS.includes(k) && !FORBIDDEN_OVERRIDE_FIELDS.includes(k)) {
      safeExtras[k] = v;
    }
  }

  const merged = {
    ...user,
    ...safeExtras,
  };

  for (const field of FORBIDDEN_OVERRIDE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(user, field)) {
      merged[field] = user[field];
    } else {
      delete merged[field];
    }
  }

  return merged;
}
