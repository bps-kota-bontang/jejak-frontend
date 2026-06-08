export function getRolesFromToken(accessToken: string | null): string[] {
  if (!accessToken) {
    return [];
  }

  const segments = accessToken.split(".");
  if (segments.length !== 3) {
    return [];
  }

  try {
    const payloadBase64 = segments[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(segments[1].length / 4) * 4, "=");

    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson) as { roles?: unknown };

    if (!Array.isArray(payload.roles)) {
      return [];
    }

    return payload.roles.filter((role): role is string => typeof role === "string");
  } catch {
    return [];
  }
}

export function hasRole(roles: string[], role: string): boolean {
  return roles.includes(role);
}

export function hasAnyRole(roles: string[], requiredRoles: string[]): boolean {
  return requiredRoles.some((role) => hasRole(roles, role));
}