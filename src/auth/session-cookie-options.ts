export function sessionCookieOptions(expiresAt: Date, isProduction = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
