import { seedDatabase } from '../data/seed.js';

const DB_KEY = 'eswap_v2_local_database_v2_2';
const SESSION_KEY = 'eswap_v2_local_session_v2_2';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function makeId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function readDatabase() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    const seeded = clone(seedDatabase);
    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const database = JSON.parse(raw);
    database.meta ||= { schemaVersion: '2.2.0', createdAt: nowIso() };
    database.recyclingRequests ||= [];
    database.conversations ||= [];
    database.messages ||= [];
    database.notifications ||= [];
    database.transactions ||= [];
    database.reviews ||= [];
    database.reports ||= [];
    database.auditLog ||= [];
    return database;
  } catch {
    const seeded = clone(seedDatabase);
    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function writeDatabase(database) {
  localStorage.setItem(DB_KEY, JSON.stringify(database));
  globalThis.dispatchEvent(new CustomEvent('eswap-db-changed'));
}

export function readSession() {
  return localStorage.getItem(SESSION_KEY);
}

export function writeSession(userId) {
  if (userId) localStorage.setItem(SESSION_KEY, userId);
  else localStorage.removeItem(SESSION_KEY);
  globalThis.dispatchEvent(new CustomEvent('eswap-session-changed'));
}

export function resetLocalDatabase() {
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem(SESSION_KEY);
  globalThis.dispatchEvent(new CustomEvent('eswap-db-changed'));
  globalThis.dispatchEvent(new CustomEvent('eswap-session-changed'));
}

export function safeUser(user) {
  if (!user) return null;
  const { password: _password, ...rest } = user;
  return rest;
}
