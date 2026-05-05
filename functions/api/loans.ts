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
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const result = await env.DB.prepare(
      `SELECT id, nome, vlr_parc, faltam, parcelas_totais, venc_original, original FROM loans ORDER BY id`
    ).all();

    const rows = (result.results ?? []) as LoanRow[];
    return Response.json(rows.map(rowToJson));
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Falha ao ler dados' }, { status: 500 });
  }
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = (await request.json()) as unknown;
    if (!Array.isArray(body)) {
      return Response.json({ error: 'Esperado um array JSON' }, { status: 400 });
    }

    const stmts: D1PreparedStatement[] = [env.DB.prepare('DELETE FROM loans')];

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
        env.DB
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

    await env.DB.batch(stmts);
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Falha ao gravar dados' }, { status: 500 });
  }
};
