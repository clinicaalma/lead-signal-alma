import config from "../config/quiz.json";
import Quiz from "./Quiz";

export default function Page() {
  return (
    <Quiz
      config={config}
      whatsappNumero={(process.env.WHATSAPP_NUMERO || "").replace(/\D/g, "")}
    />
  );
}
