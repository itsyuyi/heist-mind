/** SQLite 数据库持久化层 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "..", "data", "heistmind.db");

// 确保 data 目录存在
import fs from "fs";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db: any = new Database(DB_PATH);

// 启用 WAL 模式提升并发性能
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// --- 建表 ---
db.exec(`
  CREATE TABLE IF NOT EXISTS scripts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    theme TEXT NOT NULL,
    player_count INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    script_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (script_id) REFERENCES scripts(id)
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    name TEXT NOT NULL,
    character_id TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (game_id) REFERENCES games(id)
  );
`);

// --- 预编译语句 ---
const stmts = {
  // Scripts
  insertScript: db.prepare(
    "INSERT OR REPLACE INTO scripts (id, title, theme, player_count, data) VALUES (?, ?, ?, ?, ?)"
  ),
  getScript: db.prepare("SELECT data FROM scripts WHERE id = ?"),
  listScripts: db.prepare(
    "SELECT id, title, theme, player_count, created_at FROM scripts ORDER BY created_at DESC LIMIT 50"
  ),
  countScripts: db.prepare("SELECT COUNT(*) as count FROM scripts"),

  // Games
  insertGame: db.prepare(
    "INSERT OR REPLACE INTO games (id, script_id, data, updated_at) VALUES (?, ?, ?, datetime('now'))"
  ),
  updateGame: db.prepare(
    "UPDATE games SET data = ?, updated_at = datetime('now') WHERE id = ?"
  ),
  getGame: db.prepare("SELECT data FROM games WHERE id = ?"),
  listGames: db.prepare(
    "SELECT id, script_id, created_at, updated_at FROM games ORDER BY updated_at DESC LIMIT 50"
  ),

  // Players
  insertPlayer: db.prepare(
    "INSERT OR REPLACE INTO players (id, game_id, name, character_id, data) VALUES (?, ?, ?, ?, ?)"
  ),
  getPlayer: db.prepare("SELECT * FROM players WHERE id = ?"),
  listPlayersByGame: db.prepare(
    "SELECT * FROM players WHERE game_id = ?"
  ),
};

// --- Script 操作 ---
export function dbSaveScript(script: unknown): void {
  const s = script as Record<string, unknown>;
  stmts.insertScript.run(s.id, s.title, s.theme, s.player_count, JSON.stringify(script));
}

export function dbGetScript(id: string): unknown | null {
  const row = stmts.getScript.get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function dbListScripts(): unknown[] {
  return stmts.listScripts.all();
}

export function dbScriptExists(): boolean {
  const row = stmts.countScripts.get() as { count: number };
  return row.count > 0;
}

// --- Game 操作 ---
export function dbSaveGame(game: unknown): void {
  const g = game as Record<string, unknown>;
  const existing = stmts.getGame.get(g.id) as { data: string } | undefined;
  if (existing) {
    stmts.updateGame.run(JSON.stringify(game), g.id);
  } else {
    stmts.insertGame.run(g.id, g.script_id, JSON.stringify(game));
  }
}

export function dbGetGame(id: string): unknown | null {
  const row = stmts.getGame.get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function dbListGames(): unknown[] {
  return stmts.listGames.all();
}

// --- Player 操作 ---
export function dbSavePlayer(player: unknown): void {
  const p = player as Record<string, unknown>;
  stmts.insertPlayer.run(p.id, p.game_id || "unknown", p.name, p.character_id, JSON.stringify(player));
}

export function dbGetPlayer(id: string): unknown | null {
  const row = stmts.getPlayer.get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const data = JSON.parse(row.data as string);
  return { ...data, id: row.id, name: row.name, character_id: row.character_id, game_id: row.game_id };
}

export function dbListPlayersByGame(gameId: string): unknown[] {
  return stmts.listPlayersByGame.all(gameId);
}

// --- 工具 ---
export function dbClose(): void {
  db.close();
}

export default db;
