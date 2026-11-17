CREATE TABLE vct_results (
 id TEXT PRIMARY KEY NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 collected_at INTEGER NOT NULL
);
