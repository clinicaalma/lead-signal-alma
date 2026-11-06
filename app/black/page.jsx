import Black from "./Black";
import "./black.css";

export const metadata = {
  title: "Black Alma · Clínica Alma",
  description: "As condições especiais da Black são só para quem está no grupo VIP da Clínica Alma, em Cascavel-PR.",
  robots: { index: false },
};

// Usada se BLACK_ABERTURA não estiver configurada ou for inválida.
const ABERTURA_PADRAO = "2026-11-09T19:00:00-03:00";

export default function Page() {
  const bruta = process.env.BLACK_ABERTURA || ABERTURA_PADRAO;
  const abertura = Number.isNaN(Date.parse(bruta)) ? ABERTURA_PADRAO : bruta;
  return <Black grupoLink={process.env.BLACK_GRUPO_LINK || ""} abertura={abertura} />;
}
