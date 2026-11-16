CREATE TABLE records (owner_id TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, PRIMARY KEY(owner_id,kind,id));
CREATE TABLE operations (owner_id TEXT NOT NULL, id TEXT NOT NULL, nonce TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(owner_id,id));
CREATE TABLE publications (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, source_id TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(owner_id,source_id));
CREATE TABLE pack_versions (owner_id TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(owner_id,id,revision));
