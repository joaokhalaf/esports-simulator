CREATE TABLE "user" (
 id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 email_verified INTEGER DEFAULT 0 NOT NULL, image TEXT,
 created_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
 updated_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE TABLE session (
 id TEXT PRIMARY KEY NOT NULL, expires_at INTEGER NOT NULL, token TEXT NOT NULL UNIQUE,
 created_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL, updated_at INTEGER NOT NULL,
 ip_address TEXT, user_agent TEXT, user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX session_userId_idx ON session(user_id);
CREATE TABLE account (
 id TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL, provider_id TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 access_token TEXT, refresh_token TEXT, id_token TEXT,
 access_token_expires_at INTEGER, refresh_token_expires_at INTEGER, scope TEXT, password TEXT,
 created_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX account_userId_idx ON account(user_id);
CREATE TABLE verification (
 id TEXT PRIMARY KEY NOT NULL, identifier TEXT NOT NULL, value TEXT NOT NULL,
 expires_at INTEGER NOT NULL, created_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
 updated_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE INDEX verification_identifier_idx ON verification(identifier);
CREATE TABLE worlds_snapshot (
 id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), published_at INTEGER,
 created_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE INDEX worlds_snapshot_created_idx ON worlds_snapshot(created_at);
CREATE TABLE worlds_scenario (
 id TEXT PRIMARY KEY NOT NULL,
 owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 snapshot_id TEXT NOT NULL REFERENCES worlds_snapshot(id) ON DELETE RESTRICT,
 name TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
 created_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE INDEX worlds_scenario_owner_idx ON worlds_scenario(owner_id);
CREATE INDEX worlds_scenario_snapshot_idx ON worlds_scenario(snapshot_id);
