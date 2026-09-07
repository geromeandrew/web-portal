export function getUserDisplayName(email?: string) {
  const localPart = email?.split("@", 1)[0]?.trim();
  if (!localPart) return "Account";

  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toLocaleUpperCase()}${part.slice(1).toLocaleLowerCase()}`)
    .join(" ");
}

export function getUserFirstName(email?: string) {
  return getUserDisplayName(email).split(" ", 1)[0] ?? "Account";
}
