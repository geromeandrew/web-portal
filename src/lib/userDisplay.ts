export function getUserDisplayName(
  displayName?: string | null,
  email?: string,
) {
  const trimmedDisplayName = displayName?.trim();
  if (trimmedDisplayName) return trimmedDisplayName;

  const localPart = email?.split("@", 1)[0]?.trim();
  if (!localPart) return "Account";

  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(
      (part) =>
        `${part.slice(0, 1).toLocaleUpperCase()}${part.slice(1).toLocaleLowerCase()}`,
    )
    .join(" ");
}

export function getUserFirstName(displayName?: string | null, email?: string) {
  return getUserDisplayName(displayName, email).split(" ", 1)[0] ?? "Account";
}
