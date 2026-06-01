type NullableDateValue = string | null | undefined;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getCurrentUtcIso() {
  return new Date().toISOString();
}

export function formatUtcDateTime(
  value: NullableDateValue,
  { includeSuffix = true }: { includeSuffix?: boolean } = {},
) {
  if (!value) return "—";

  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const base = `${year}-${month}-${day} ${hours}:${minutes}`;

  return includeSuffix ? `${base} UTC` : base;
}

export function formatUtcTime(
  value: NullableDateValue,
  { includeSuffix = false }: { includeSuffix?: boolean } = {},
) {
  if (!value) return "—";

  const date = new Date(value);
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const base = `${hours}:${minutes}`;

  return includeSuffix ? `${base} UTC` : base;
}

export function formatUtcDayMonthTime(
  value: NullableDateValue,
  { includeSuffix = false }: { includeSuffix?: boolean } = {},
) {
  if (!value) return "—";

  const date = new Date(value);
  const day = pad(date.getUTCDate());
  const month = pad(date.getUTCMonth() + 1);
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const base = `${day}/${month} ${hours}:${minutes}`;

  return includeSuffix ? `${base} UTC` : base;
}

export function formatRecentUtcMoment(value: NullableDateValue) {
  if (!value) return "—";

  const date = new Date(value);
  const now = new Date();

  const isSameUtcDay =
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate();

  if (isSameUtcDay) {
    return formatUtcTime(value);
  }

  return formatUtcDayMonthTime(value);
}
