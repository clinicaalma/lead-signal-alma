// Roda os cenários da fórmula: npm run test:score
import { readFileSync } from "fs";
import { avaliar } from "../lib/scoring.js";
const config = JSON.parse(readFileSync(new URL("../config/quiz.json", import.meta.url)));
const base = { incomodo: "Os dois", regiao: "Sim", tentou: "Pacote em outra clínica", quando: "Esta semana", investimento: "Sim, quero agendar minha avaliação", periodo: "Manhã" };
const casos = [
  ["Ideal: os dois, pacote, esta semana, quer agendar (100)", {}, true],
  ["Estrias, nada ainda, este mês, parcelamento (70)", { incomodo: "Estrias", tentou: "Nada ainda", quando: "Este mês", investimento: "Sim, se tiver parcelamento" }, true],
  ["Estrias, cremes, tem uma data, parcelamento (75)", { incomodo: "Estrias", tentou: "Cremes e tratamentos em casa", quando: "Tenho uma data (verão, viagem, evento)", investimento: "Sim, se tiver parcelamento" }, true],
  ["Só pesquisando, mesmo com o resto bom (70)", { quando: "Só estou pesquisando" }, true],
  ["Só pesquisando, estrias, nada ainda, parcelamento (45)", { incomodo: "Estrias", tentou: "Nada ainda", quando: "Só estou pesquisando", investimento: "Sim, se tiver parcelamento" }, false],
  ["Fora da região (gate)", { regiao: "Não" }, false],
  ["Agora não (gate)", { investimento: "Agora não" }, false],
];
let falhas = 0;
for (const [nome, mud, esperado] of casos) {
  const r = avaliar(config, { ...base, ...mud });
  const ok = r.qualificado === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "OK " : "ERRO"} | score ${String(r.score).padStart(3)} | gates ${r.gatesAprovados ? "ok" : "reprovado"} | ${r.qualificado ? "QUALIFICADO" : "não qualificado"} | ${nome}`);
}
process.exit(falhas ? 1 : 0);
