const fs = require('fs');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');

const PORT = Number(process.env.PORT) || 3004;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'loans.db');
const LEGACY_JSON = path.join(DATA_DIR, 'loan_db.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

ensureDataDir();

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY NOT NULL,
    nome TEXT NOT NULL,
    vlr_parc REAL NOT NULL,
    faltam INTEGER NOT NULL,
    parcelas_totais INTEGER NOT NULL,
    venc_original TEXT NOT NULL,
    original REAL NOT NULL
  );
`);

const stmtSelectAll = sqlite.prepare(`
  SELECT id, nome, vlr_parc, faltam, parcelas_totais, venc_original, original
  FROM loans ORDER BY id
`);

const stmtDeleteAll = sqlite.prepare('DELETE FROM loans');
const stmtInsert = sqlite.prepare(`
  INSERT INTO loans (id, nome, vlr_parc, faltam, parcelas_totais, venc_original, original)
  VALUES (@id, @nome, @vlr_parc, @faltam, @parcelas_totais, @venc_original, @original)
`);

function rowToLoan(row) {
  return {
    id: row.id,
    nome: row.nome,
    vlrParc: row.vlr_parc,
    faltam: row.faltam,
    parcelasTotais: row.parcelas_totais,
    vencOriginal: row.venc_original,
    original: row.original
  };
}

function readDb() {
  return stmtSelectAll.all().map(rowToLoan);
}

const replaceAllLoans = sqlite.transaction((items) => {
  stmtDeleteAll.run();
  for (const item of items) {
    stmtInsert.run({
      id: item.id,
      nome: item.nome,
      vlr_parc: item.vlrParc,
      faltam: item.faltam,
      parcelas_totais: item.parcelasTotais,
      venc_original: item.vencOriginal,
      original: item.original
    });
  }
});

function writeDb(data) {
  replaceAllLoans(data);
}

function migrateFromJsonIfNeeded() {
  const count = sqlite.prepare('SELECT COUNT(*) AS c FROM loans').get().c;
  if (count > 0 || !fs.existsSync(LEGACY_JSON)) return;
  try {
    const raw = fs.readFileSync(LEGACY_JSON, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return;
    replaceAllLoans(arr);
    fs.renameSync(LEGACY_JSON, `${LEGACY_JSON}.migrated.bak`);
    console.log('Dados importados de loan_db.json para SQLite (backup .migrated.bak).');
  } catch (e) {
    console.error('Migração loan_db.json → SQLite falhou:', e.message);
  }
}

migrateFromJsonIfNeeded();

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/loans', (req, res) => {
  try {
    res.json(readDb());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao ler dados' });
  }
});

app.put('/api/loans', (req, res) => {
  try {
    const body = req.body;
    if (!Array.isArray(body)) {
      return res.status(400).json({ error: 'Esperado um array JSON' });
    }
    writeDb(body);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao gravar dados' });
  }
});

app.use(express.static(ROOT));

app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'gemini-code-1777989653780.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gestor Financeiro: http://localhost:${PORT}/`);
  console.log(`SQLite: ${DB_PATH}`);
  console.log(`Na rede local use o IP desta máquina na porta ${PORT}`);
});
