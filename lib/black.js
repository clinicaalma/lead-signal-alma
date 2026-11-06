// Black Alma: funções usadas só no servidor (gravar visitas/cliques, ler o resumo, buscar membros do grupo).

const limpo = (v, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function credenciais() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } };
}

export async function inserir(tabela, linha) {
  const c = credenciais();
  if (!c) throw new Error("Supabase não configurado na Netlify");
  const res = await fetch(`${c.url}/rest/v1/${tabela}`, {
    method: "POST",
    headers: { ...c.headers, Prefer: "return=minimal" },
    body: JSON.stringify(linha),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
}

export async function resumo() {
  const c = credenciais();
  if (!c) throw new Error("Supabase não configurado na Netlify");
  const res = await fetch(`${c.url}/rest/v1/rpc/black_resumo`, { method: "POST", headers: c.headers, body: "{}", cache: "no-store" });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

// Corpo vindo de sendBeacon ou fetch: lê como texto e converte, para aceitar qualquer Content-Type.
export async function lerCorpo(req) {
  try {
    const texto = await req.text();
    const json = JSON.parse(texto || "{}");
    return json && typeof json === "object" ? json : {};
  } catch {
    return {};
  }
}

// Campos de origem e rastreio comuns à visita e ao clique.
export function camposRastreio(body, req) {
  const o = body.origem && typeof body.origem === "object" ? body.origem : {};
  return {
    utm_source: limpo(o.utm_source),
    utm_campaign: limpo(o.utm_campaign),
    utm_content: limpo(o.utm_content),
    fbclid: limpo(body.fbclid, 500),
    fbp: limpo(body.fbp, 300),
    fbc: limpo(body.fbc, 600),
    user_agent: limpo(req.headers.get("user-agent"), 500),
  };
}

export function ipDoCliente(req) {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    undefined
  );
}

export function evolutionConfigurada() {
  return ["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE", "BLACK_GRUPO_JID"].every((k) => !!process.env[k]);
}
