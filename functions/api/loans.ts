/// <reference types="@cloudflare/workers-types" />

type LoanRow = {
  id: number;
  nome: string;
  vlr_parc: number;
  faltam: number;
  parcelas_totais: number;
  venc_original: string;
  original: number;
};

function rowToJson(row: LoanRow) {
  return {
    id: row.id,
    nome: row.nome,
    vlrParc: row.vlr_parc,
    faltam: row.faltam,
    parcelasTotais: row.parcelas_totais,
    vencOriginal: row.venc_original,
    original: row.original,
  };
}

interface Env {
  /** Binding comum na documentação Cloudflare */
  DB?: D1Database;
  /** Mesmo nome do banco/recurso no painel (ex.: Name = fernando) */
  fernando?: D1Database;
}

function getD1(env: Env): D1Database | undefined {
  return env.DB ?? env.fernando;
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const db = getD1(env);
  if (!db) {
    return Response.json(
      {
        error: 'D1 não disponível',
        hint:
          'No Pages → Bindings: o nome da variável D1 vira env.<nome>. Use "DB" ou "fernando" e aponte para o banco fernando; o código aceita os dois.',
      },
      { status: 503 }
    );
  }

  try {
    const result = await db.prepare(
      `SELECT id, nome, vlr_parc, faltam, parcelas_totais, venc_original, original FROM loans ORDER BY id`
    ).all();

    const rows = (result.results ?? []) as LoanRow[];
    return Response.json(rows.map(rowToJson));
  } catch (e) {
    const msg = errText(e);
    console.error(e);
    const hint =
      /no such table/i.test(msg)
        ? 'Rode no seu PC: npm run cf:d1:migrate (aplica migrations/ no D1 remoto).'
        : undefined;
    return Response.json(
      { error: 'Falha ao ler dados', detail: msg, ...(hint ? { hint } : {}) },
      { status: 500 }
    );
  }
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const db = getD1(env);
  if (!db) {
    return Response.json(
      {
        error: 'D1 não disponível',
        hint: 'Adicione binding D1 no Pages (variável DB ou fernando → banco fernando).',
      },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as unknown;
    if (!Array.isArray(body)) {
      return Response.json({ error: 'Esperado um array JSON' }, { status: 400 });
    }

    const stmts: D1PreparedStatement[] = [db.prepare('DELETE FROM loans')];

    for (const item of body) {
      if (
        item == null ||
        typeof item !== 'object' ||
        typeof (item as { id?: unknown }).id !== 'number' ||
        typeof (item as { nome?: unknown }).nome !== 'string' ||
        typeof (item as { vlrParc?: unknown }).vlrParc !== 'number' ||
        typeof (item as { faltam?: unknown }).faltam !== 'number' ||
        typeof (item as { parcelasTotais?: unknown }).parcelasTotais !== 'number' ||
        typeof (item as { vencOriginal?: unknown }).vencOriginal !== 'string' ||
        typeof (item as { original?: unknown }).original !== 'number'
      ) {
        return Response.json({ error: 'Item inválido no array' }, { status: 400 });
      }

      const rec = item as {
        id: number;
        nome: string;
        vlrParc: number;
        faltam: number;
        parcelasTotais: number;
        vencOriginal: string;
        original: number;
      };

      stmts.push(
        db
          .prepare(
            `INSERT INTO loans (id, nome, vlr_parc, faltam, parcelas_totais, venc_original, original)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            rec.id,
            rec.nome,
            rec.vlrParc,
            rec.faltam,
            rec.parcelasTotais,
            rec.vencOriginal,
            rec.original
          )
      );
    }

    await db.batch(stmts);
    return Response.json({ ok: true });
  } catch (e) {
    const msg = errText(e);
    console.error(e);
    const hint =
      /no such table/i.test(msg)
        ? 'Rode: npm run cf:d1:migrate'
        : undefined;
    return Response.json(
      { error: 'Falha ao gravar dados', detail: msg, ...(hint ? { hint } : {}) },
      { status: 500 }
    );
  }
};
