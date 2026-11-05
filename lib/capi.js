// Lead Signal OAGM: disparo de evento via Meta Conversions API (somente servidor).
import crypto from "crypto";

export function sha256(valor) {
  if (!valor) return undefined;
  return crypto.createHash("sha256").update(String(valor).trim().toLowerCase()).digest("hex");
}

export async function sendCapiEvent({
  pixelId,
  accessToken,
  eventName,
  eventId,
  eventSourceUrl,
  telefoneE164,
  nome,
  fbp,
  fbc,
  clientIp,
  clientUserAgent,
  customData = {},
}) {
  const primeiroNome = nome ? String(nome).trim().split(/\s+/)[0] : undefined;
  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: eventSourceUrl,
        user_data: {
          ph: telefoneE164 ? [sha256(telefoneE164)] : undefined,
          fn: primeiroNome ? [sha256(primeiroNome)] : undefined,
          country: [sha256("br")],
          fbp: fbp || undefined,
          fbc: fbc || undefined,
          client_ip_address: clientIp || undefined,
          client_user_agent: clientUserAgent || undefined,
        },
        custom_data: customData,
      },
    ],
  };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;

  const versao = process.env.META_GRAPH_VERSION || "v23.0";
  const url = `https://graph.facebook.com/${versao}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Erro CAPI (${eventName}): ${JSON.stringify(json)}`);
  return json;
}
