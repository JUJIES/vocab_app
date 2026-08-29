const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { RuntimeJsonStore } = require("./runtime-json-store");

const TEACHER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TEACHER_SESSION_TOUCH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const INITIAL_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizeTeacherStore(value) {
  return {
    version: 1,
    teachers: Array.isArray(value?.teachers)
      ? value.teachers
          .map((entry) => normalizeTeacher(entry))
          .filter(Boolean)
      : [],
  };
}

function normalizeTeacher(entry) {
  const id = typeof entry?.id === "string" ? entry.id.trim().toLowerCase() : "";
  const username = typeof entry?.username === "string" ? entry.username.trim().toLowerCase() : "";
  const displayName = typeof entry?.displayName === "string" ? entry.displayName.trim() : "";

  if (!id || !username || !displayName) {
    return null;
  }

  const passwordHash = typeof entry?.passwordHash === "string" && entry.passwordHash
    ? entry.passwordHash
    : null;
  return {
    id,
    username,
    displayName,
    status: entry?.status === "disabled"
      ? "disabled"
      : (passwordHash ? "active" : "unprovisioned"),
    passwordHash,
    mustChangePassword: Boolean(passwordHash && entry?.mustChangePassword),
    createdAt: typeof entry?.createdAt === "string" ? entry.createdAt : null,
    updatedAt: typeof entry?.updatedAt === "string" ? entry.updatedAt : null,
    initialPasswordSetAt: typeof entry?.initialPasswordSetAt === "string" ? entry.initialPasswordSetAt : null,
    passwordChangedAt: typeof entry?.passwordChangedAt === "string" ? entry.passwordChangedAt : null,
  };
}

function createInitialPassword(groupLength = 4) {
  const groups = [];

  while (groups.length < 2) {
    let group = "";
    while (group.length < groupLength) {
      const byte = crypto.randomBytes(1)[0];
      group += INITIAL_PASSWORD_ALPHABET[byte % INITIAL_PASSWORD_ALPHABET.length];
    }
    groups.push(group);
  }

  return `LERN-${groups.join("-")}`;
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

class TeacherService {
  constructor({ dataDir, seedPath }) {
    this.dataDir = dataDir;
    this.accountsPath = path.join(dataDir, "teachers.json");
    this.sessionsPath = path.join(dataDir, "teacher-sessions.json");
    this.accountStore = new RuntimeJsonStore(this.accountsPath, {
      defaultValue: { version: 1, teachers: [] },
      seedPath,
      normalize: normalizeTeacherStore,
    });
    this.sessions = this.loadSessions();
  }

  async listPublicAccounts() {
    const store = await this.accountStore.read();
    return store.teachers.filter((teacher) => teacher.status !== "disabled").map((teacher) => ({
      id: teacher.id,
      username: teacher.username,
      displayName: teacher.displayName,
      status: teacher.status,
    }));
  }

  async getTeacher(teacherId) {
    const normalizedTeacherId = typeof teacherId === "string" ? teacherId.trim().toLowerCase() : "";
    const store = await this.accountStore.read();
    const teacher = store.teachers.find((entry) => (
      entry.id === normalizedTeacherId
      && entry.status !== "disabled"
    ));
    return teacher ? toSafeTeacher(teacher) : null;
  }

  async changePassword({ teacherId, currentPassword, newPassword }) {
    const normalizedTeacherId = typeof teacherId === "string" ? teacherId.trim().toLowerCase() : "";
    validatePassword(newPassword);

    return this.accountStore.mutate(async (store) => {
      const teacher = store.teachers.find((entry) => entry.id === normalizedTeacherId);

      if (!teacher || teacher.status !== "active" || !teacher.passwordHash) {
        throw createAuthError("Account nicht verfügbar.", 401, "ACCOUNT_UNAVAILABLE");
      }

      const isMatch = typeof currentPassword === "string" && currentPassword
        ? await bcrypt.compare(currentPassword, teacher.passwordHash)
        : false;

      if (!isMatch) {
        throw createAuthError("Aktuelles Passwort stimmt nicht.", 401, "INVALID_CURRENT_PASSWORD");
      }

      if (currentPassword === newPassword) {
        throw createAuthError("Das neue Passwort muss sich vom bisherigen unterscheiden.", 400, "PASSWORD_UNCHANGED");
      }

      const timestamp = new Date().toISOString();
      teacher.passwordHash = await bcrypt.hash(newPassword, 10);
      teacher.mustChangePassword = false;
      teacher.passwordChangedAt = timestamp;
      teacher.updatedAt = timestamp;

      return toSafeTeacher(teacher);
    });
  }

  async authenticate({ teacherId, password }) {
    const normalizedTeacherId = typeof teacherId === "string" ? teacherId.trim().toLowerCase() : "";
    const store = await this.accountStore.read();
    const teacher = store.teachers.find((entry) => entry.id === normalizedTeacherId);

    if (!teacher || teacher.status !== "active" || !teacher.passwordHash) {
      throw createAuthError("Name oder Passwort stimmt nicht.", 401, "INVALID_CREDENTIALS");
    }

    const isMatch = typeof password === "string" && password
      ? await bcrypt.compare(password, teacher.passwordHash)
      : false;

    if (!isMatch) {
      throw createAuthError("Name oder Passwort stimmt nicht.", 401, "INVALID_CREDENTIALS");
    }

    return toSafeTeacher(teacher);
  }

  createSession(teacherId) {
    this.purgeExpiredSessions();
    const token = createSessionToken();
    const tokenHash = hashToken(token);
    const now = Date.now();
    const session = {
      teacherId,
      expiresAt: now + TEACHER_SESSION_TTL_MS,
      touchedAt: now,
    };

    this.sessions.set(tokenHash, session);
    this.persistSessions();

    return {
      token,
      teacherId,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  requireSession(token) {
    const expiredCount = this.purgeExpiredSessions();
    if (expiredCount > 0) {
      this.persistSessions();
    }

    const normalizedToken = typeof token === "string" ? token.trim() : "";
    const tokenHash = normalizedToken ? hashToken(normalizedToken) : "";
    const session = tokenHash ? this.sessions.get(tokenHash) : null;

    if (!session) {
      return {
        ok: false,
        status: 401,
        error: "Lehrer-Sitzung abgelaufen. Bitte erneut anmelden.",
      };
    }

    const now = Date.now();
    if (now - session.touchedAt >= TEACHER_SESSION_TOUCH_INTERVAL_MS) {
      session.expiresAt = now + TEACHER_SESSION_TTL_MS;
      session.touchedAt = now;
      this.sessions.set(tokenHash, session);
      this.persistSessions();
    }

    return {
      ok: true,
      status: 200,
      token: normalizedToken,
      tokenHash,
      session,
      teacherId: session.teacherId,
    };
  }

  deleteSession(token) {
    const normalizedToken = typeof token === "string" ? token.trim() : "";
    if (!normalizedToken) {
      return;
    }

    if (this.sessions.delete(hashToken(normalizedToken))) {
      this.persistSessions();
    }
  }

  deleteSessionsForTeacher(teacherId) {
    const normalizedTeacherId = typeof teacherId === "string" ? teacherId.trim().toLowerCase() : "";
    let removedCount = 0;

    for (const [tokenHash, session] of this.sessions.entries()) {
      if (session?.teacherId === normalizedTeacherId) {
        this.sessions.delete(tokenHash);
        removedCount += 1;
      }
    }

    if (removedCount > 0) {
      this.persistSessions();
    }

    return removedCount;
  }

  async provisionInitialPasswords({ resetPasswords = false } = {}) {
    const generatedPasswords = [];

    await this.accountStore.mutate(async (store) => {
      const timestamp = new Date().toISOString();

      for (const teacher of store.teachers) {
        if (teacher.status === "disabled") {
          continue;
        }

        if (teacher.passwordHash && !resetPasswords) {
          continue;
        }

        const generatedPassword = await setInitialPassword(teacher, timestamp);
        this.deleteSessionsForTeacher(teacher.id);
        generatedPasswords.push(generatedPassword);
      }
    });

    return generatedPasswords;
  }

  async resetPassword(teacherId) {
    const normalizedTeacherId = typeof teacherId === "string" ? teacherId.trim().toLowerCase() : "";
    let generatedPassword = null;

    await this.accountStore.mutate(async (store) => {
      const teacher = store.teachers.find((entry) => entry.id === normalizedTeacherId);

      if (!teacher || teacher.status === "disabled") {
        throw createAuthError("Account nicht verfügbar.", 404, "ACCOUNT_UNAVAILABLE");
      }

      generatedPassword = await setInitialPassword(teacher, new Date().toISOString());
    });

    this.deleteSessionsForTeacher(normalizedTeacherId);
    return generatedPassword;
  }

  purgeExpiredSessions() {
    const now = Date.now();
    let removedCount = 0;

    for (const [tokenHash, session] of this.sessions.entries()) {
      if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= now) {
        this.sessions.delete(tokenHash);
        removedCount += 1;
      }
    }

    return removedCount;
  }

  loadSessions() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.sessionsPath, "utf8"));
      const now = Date.now();
      const entries = Array.isArray(parsed?.sessions) ? parsed.sessions : [];

      return new Map(entries
        .filter((entry) => (
          typeof entry?.tokenHash === "string"
          && /^[a-f0-9]{64}$/.test(entry.tokenHash)
          && typeof entry?.teacherId === "string"
          && Number.isFinite(entry?.expiresAt)
          && entry.expiresAt > now
        ))
        .map((entry) => [entry.tokenHash, {
          teacherId: entry.teacherId,
          expiresAt: entry.expiresAt,
          touchedAt: Number.isFinite(entry?.touchedAt) ? entry.touchedAt : now,
        }]));
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.error("Unable to load teacher sessions:", error);
      }

      return new Map();
    }
  }

  persistSessions() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    const tempPath = `${this.sessionsPath}.${process.pid}.${Date.now()}.tmp`;
    const payload = {
      version: 1,
      sessions: [...this.sessions.entries()].map(([tokenHash, session]) => ({
        tokenHash,
        teacherId: session.teacherId,
        expiresAt: session.expiresAt,
        touchedAt: session.touchedAt,
      })),
    };

    fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(tempPath, this.sessionsPath);
  }
}

async function setInitialPassword(teacher, timestamp) {
  const initialPassword = createInitialPassword();
  teacher.passwordHash = await bcrypt.hash(initialPassword, 10);
  teacher.status = "active";
  teacher.mustChangePassword = true;
  teacher.createdAt = teacher.createdAt || timestamp;
  teacher.updatedAt = timestamp;
  teacher.initialPasswordSetAt = timestamp;
  teacher.passwordChangedAt = null;

  return {
    id: teacher.id,
    username: teacher.username,
    displayName: teacher.displayName,
    initialPassword,
  };
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw createAuthError("Passwort muss mindestens 8 Zeichen haben.", 400, "INVALID_PASSWORD");
  }
}

function toSafeTeacher(teacher) {
  return {
    id: teacher.id,
    username: teacher.username,
    displayName: teacher.displayName,
    status: teacher.status,
    mustChangePassword: Boolean(teacher.mustChangePassword),
  };
}

function createAuthError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

module.exports = {
  TeacherService,
  createInitialPassword,
  normalizeTeacherStore,
};
