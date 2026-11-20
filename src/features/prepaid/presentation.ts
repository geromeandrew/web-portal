export const headings = [
  "REVENUE BEFORE RECLASS",
  "GP EG MT GROSS",
  "HY EG MT GROSS",
  "GP EG BB GROSS",
  "TOTAL GROSS",
  "GP EG MT NET",
  "HY EG MT NET",
  "GP EG BB NET",
  "TOTAL NET",
];
export const allocationFields = [
  "type",
  "gross",
  "tax_rate",
  "amount",
  "vat_oct",
  "total_gross",
  "difference",
];
export const allocationHeaders = [
  "TYPE",
  "GROSS",
  "TAX RATE (%)",
  "AMOUNT",
  "VAT/OCT",
  "TOTAL GROSS",
  "DIFFERENCE",
];
export const dateTime = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
export const dateOnly = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
