export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatMoney(value: number, currency = "BOB") {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function uniqueSlug(base: string, existing: string[]) {
  const root = slugify(base) || "item";
  if (!existing.includes(root)) return root;
  let index = 2;
  while (existing.includes(`${root}-${index}`)) index += 1;
  return `${root}-${index}`;
}

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
