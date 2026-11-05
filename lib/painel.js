// Funções do CRM usadas só no servidor: senha do painel e acesso ao Supabase.
import crypto from "crypto";

// "proposta" aparece no painel como "Avaliação agendada".
export const ETAPAS = ["novo", "atendimento", "proposta", "fechou", "perdido"];
export const PROTOCOLOS = ["Harmonização Corporal", "Protocolo de Estrias", "Combinado Sob Medida", "Área avulsa", "Combo Black", "Outro"];

export function senhaOk(recebida) {
  const certa = process.env.PAINEL_SENHA || "";
  if (!certa || typeof recebida !== "string") return false;
  const a = crypto.createHash("sha256").update(recebida).digest();
  const b = crypto.createHash("sha256").update(certa).digest();
  return crypto.timingSafeEqual(a, b);
}

export function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return {
    async get(query) {
      const res = await fetch(`${url}/rest/v1/${query}`, { headers, cache: "no-store" });
      if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
      return res.json();
    },
    async patch(query, body) {
      const res = await fetch(`${url}/rest/v1/${query}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
      return res.json();
    },
  };
}

// Campos que o navegador do painel pode ver (nada de IP, user agent ou cookies).
export const CAMPOS_PUBLICOS = [
  "id", "created_at", "telefone", "respostas", "score", "gates_aprovados", "qualificado",
  "etapa", "responsavel", "protocolo", "valor_pedido", "notas", "proximo_contato", "data_reposicao",
  "motivo_perda", "fechado_em", "evento_compra_enviado", "atualizado_em",
  "origem", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer",
].join(",");

// Mesma lista, sem as colunas de origem (se o utm.sql ainda não rodou, o painel continua abrindo).
export const CAMPOS_PUBLICOS_BASE = CAMPOS_PUBLICOS.split(",")
  .filter((k) => !/^(origem|utm_|referrer)/.test(k))
  .join(",");
