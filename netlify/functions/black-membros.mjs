// Black Alma: a cada 30 minutos, busca na Evolution API quantos membros o grupo VIP tem
// e grava em black_grupo_snapshots (origem 'evolution').
// Só roda de verdade se EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE e BLACK_GRUPO_JID estiverem configuradas.

export const config = { schedule: "*/30 * * * *" };

export default async function handler() {
  const { EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, BLACK_GRUPO_JID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE || !BLACK_GRUPO_JID) {
    console.log("[black-membros] Evolution não configurada; nada a fazer");
    return new Response("evolution não configurada");
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[black-membros] Supabase não configurado");
    return new Response("supabase não configurado", { status: 500 });
  }

  try {
    const base = EVOLUTION_API_URL.replace(/\/+$/, "");
    const url = `${base}/group/participants/${encodeURIComponent(EVOLUTION_INSTANCE)}?groupJid=${encodeURIComponent(BLACK_GRUPO_JID)}`;
    const res = await fetch(url, { headers: { apikey: EVOLUTION_API_KEY } });
    if (!res.ok) throw new Error(`Evolution ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const lista = Array.isArray(json) ? json : json.participants;
    if (!Array.isArray(lista)) throw new Error(`Resposta inesperada da Evolution: ${JSON.stringify(json).slice(0, 300)}`);

    const total = lista.length;
    const db = await fetch(`${SUPABASE_URL}/rest/v1/black_grupo_snapshots`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ total_membros: total, origem: "evolution" }),
    });
    if (!db.ok) throw new Error(`Supabase ${db.status}: ${await db.text()}`);

    console.log(`[black-membros] ${total} membros gravados`);
    return new Response(`ok ${total}`);
  } catch (e) {
    console.error("[black-membros]", e.message);
    return new Response(e.message, { status: 500 });
  }
}
