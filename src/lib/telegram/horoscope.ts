import type { MexicoDate } from "./livedAge";
import { mexicoToday } from "./livedAge";

export type ZodiacSign =
  | "Aries"
  | "Tauro"
  | "Géminis"
  | "Cáncer"
  | "Leo"
  | "Virgo"
  | "Libra"
  | "Escorpio"
  | "Sagitario"
  | "Capricornio"
  | "Acuario"
  | "Piscis";

const SIGNS: { name: ZodiacSign; from: [number, number] }[] = [
  { name: "Capricornio", from: [12, 22] },
  { name: "Acuario", from: [1, 20] },
  { name: "Piscis", from: [2, 19] },
  { name: "Aries", from: [3, 21] },
  { name: "Tauro", from: [4, 20] },
  { name: "Géminis", from: [5, 21] },
  { name: "Cáncer", from: [6, 21] },
  { name: "Leo", from: [7, 23] },
  { name: "Virgo", from: [8, 23] },
  { name: "Libra", from: [9, 23] },
  { name: "Escorpio", from: [10, 23] },
  { name: "Sagitario", from: [11, 22] },
];

const TODAY_LINES: Record<ZodiacSign, string[]> = {
  Aries: [
    "Hoy tu impulso abre puertas; actúa con calma y ganas.",
    "Una idea valiente te da ventaja si no te apresuras.",
    "Canaliza la energía en un paso concreto y firme.",
    "Hoy ganas si lideras sin atropellar a nadie.",
    "El fuego rinde más cuando eliges una sola meta.",
  ],
  Tauro: [
    "Hoy la constancia te rinde más que cualquier prisa.",
    "Cuida lo tuyo; un gesto práctico trae estabilidad.",
    "Avanza despacio y hoy cierras algo que importaba.",
    "El gusto simple te recentra y te da seguridad.",
    "Hoy resiste la tentación: lo sólido llega después.",
  ],
  Géminis: [
    "Hoy una conversación clara te ahorra vueltas innecesarias.",
    "Tu ingenio brilla; elige un mensaje y suéltalo bien.",
    "Pregunta más y hoy entiendes lo que estaba opaco.",
    "Dos ideas se cruzan; quédate con la más útil.",
    "Hoy conectar con alguien cercano te abre un camino.",
  ],
  Cáncer: [
    "Hoy protege tu paz; el hogar te recarga de veras.",
    "Escucha tu intuición antes de ceder por costumbre.",
    "Un gesto tierno desarma tensiones y te alivia.",
    "Hoy cuida tus límites y duermes más tranquilo.",
    "Lo emotivo se ordena si hablas con honestidad suave.",
  ],
  Leo: [
    "Hoy brillas si compartes el crédito y no solo el escenario.",
    "Tu calor anima a otros; úsalo con generosidad.",
    "Un elogio sincero te devuelve más de lo esperado.",
    "Hoy crea algo visible y siéntete orgulloso sin soberbia.",
    "El corazón manda: elige lo que te enciende de verdad.",
  ],
  Virgo: [
    "Hoy un detalle bien resuelto te ahorra un problema mayor.",
    "Ordena una cosa y todo lo demás se aligera.",
    "Tu criterio fino ve el error que nadie notó.",
    "Hoy menos prisa y más precisión te dejan en paz.",
    "Ayuda en lo práctico; tu utilidad se nota y se agradece.",
  ],
  Libra: [
    "Hoy el equilibrio llega si dices lo que de verdad sientes.",
    "Una decisión justa cierra un tira y afloja.",
    "Busca armonía, no aprobación; hoy eso te libera.",
    "Un acuerdo simple vale más que un debate eterno.",
    "Hoy la belleza de un gesto sincero arregla el día.",
  ],
  Escorpio: [
    "Hoy ve al fondo sin enredarte en sospechas.",
    "Tu intensidad sirve si la usas para sanar, no controlar.",
    "Suelta un secreto viejo y recuperas energía.",
    "Hoy la verdad corta, pero también limpia el camino.",
    "Confía selectivamente; un aliado leal aparece cerca.",
  ],
  Sagitario: [
    "Hoy un horizonte nuevo te llama; da un paso real.",
    "Tu humor abre puertas si no prometes de más.",
    "Aprende algo breve y hoy se te aclara el rumbo.",
    "La fe mueve, pero el plan corto te aterriza.",
    "Hoy comparte una idea y alguien te suma camino.",
  ],
  Capricornio: [
    "Hoy el esfuerzo silencioso te pone un peldaño más arriba.",
    "Cumple lo esencial y deja lo que solo aparenta.",
    "Tu seriedad convence si también te permites descansar.",
    "Hoy un límite claro te protege el tiempo y el logro.",
    "Construye despacio; lo que fijes hoy dura.",
  ],
  Acuario: [
    "Hoy una idea distinta resuelve lo que el hábito no pudo.",
    "Tu originalidad suma si la bajas a un gesto concreto.",
    "Conecta con tu gente; hoy el grupo te impulsa.",
    "Rompe una rutina menor y se oxigena el día.",
    "Hoy piensa en todos, pero no te olvides de ti.",
  ],
  Piscis: [
    "Hoy sueña, pero ancla un deseo en un acto pequeño.",
    "Tu sensibilidad lee el ambiente; confía y cuídate.",
    "Un rato de silencio te limpia más que mil planes.",
    "Hoy ayuda sin perderte; tu empatía es un don.",
    "La imaginación te guía si no la dejas en niebla.",
  ],
};

function md(month: number, day: number): number {
  return month * 100 + day;
}

export function zodiacSign(birth: MexicoDate): ZodiacSign {
  const value = md(birth.month, birth.day);
  let current: ZodiacSign = "Capricornio";
  for (const sign of SIGNS) {
    if (value >= md(sign.from[0], sign.from[1])) current = sign.name;
  }
  return current;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function todayHoroscope(sign: ZodiacSign, today = mexicoToday()): string {
  const lines = TODAY_LINES[sign];
  const dayOfYear = Math.floor(
    (Date.UTC(today.year, today.month - 1, today.day) - Date.UTC(today.year, 0, 0)) /
      86_400_000,
  );
  const line = lines[(dayOfYear + today.year) % lines.length] ?? lines[0];
  return line;
}

export function formatSignAndHoroscope(birth: MexicoDate, today = mexicoToday()): string {
  const sign = zodiacSign(birth);
  const line = todayHoroscope(sign, today);
  return `Tu signo es ${sign}.\nHoróscopo de hoy: ${line}`;
}
