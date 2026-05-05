-- Tabela espelhando o SQLite local (better-sqlite3) para D1
CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY NOT NULL,
  nome TEXT NOT NULL,
  vlr_parc REAL NOT NULL,
  faltam INTEGER NOT NULL,
  parcelas_totais INTEGER NOT NULL,
  venc_original TEXT NOT NULL,
  original REAL NOT NULL
);
