export type MexicoDate = {
  year: number;
  month: number;
  day: number;
};

export type LivedAge = {
  days: number;
  years: number;
  months: number;
};

const MEXICO_TZ = "America/Mexico_City";

export function mexicoToday(now = new Date()): MexicoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MEXICO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: num("year"), month: num("month"), day: num("day") };
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

function compareDates(a: MexicoDate, b: MexicoDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function parseBirthDate(raw: string): { date: MexicoDate; error?: string } {
  const text = raw.trim();
  const dmy = text.match(/^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{4})$/);
  const ymd = text.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  let year = 0;
  let month = 0;
  let day = 0;
  if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else if (ymd) {
    year = Number(ymd[1]);
    month = Number(ymd[2]);
    day = Number(ymd[3]);
  } else {
    return {
      date: { year: 0, month: 0, day: 0 },
      error: "Escribe la fecha como 15/03/1990.",
    };
  }
  if (!isValidYmd(year, month, day)) {
    return {
      date: { year, month, day },
      error: "Esa fecha no es válida. Ejemplo: 15/03/1990.",
    };
  }
  const date = { year, month, day };
  const today = mexicoToday();
  if (compareDates(date, today) > 0) {
    return { date, error: "La fecha de nacimiento no puede ser del futuro." };
  }
  if (today.year - year > 120) {
    return { date, error: "Revisa la fecha; parece demasiado antigua." };
  }
  return { date };
}

export function livedAgeUntil(birth: MexicoDate, today = mexicoToday()): LivedAge {
  const start = Date.UTC(birth.year, birth.month - 1, birth.day);
  const end = Date.UTC(today.year, today.month - 1, today.day);
  const days = Math.max(0, Math.round((end - start) / 86_400_000));

  let years = today.year - birth.year;
  let months = today.month - birth.month;
  if (today.day < birth.day) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { days, years: Math.max(0, years), months: Math.max(0, months) };
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("es-MX")} ${count === 1 ? one : many}`;
}

export function formatLivedAge(name: string, age: LivedAge): string {
  return [
    `${name}, hasta hoy has vivido ${plural(age.days, "día", "días")}.`,
    `Tienes ${plural(age.years, "año", "años")} y ${plural(age.months, "mes", "meses")}.`,
  ].join("\n");
}
