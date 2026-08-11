type UserRole = "admin" | "employee" | "investor";

export function getRedirectPathByRole(role: UserRole) {
  if (role === "admin") return "/dashboard";
  if (role === "employee") return "/employee";
  if (role === "investor") return "/investor";

  return "/";
}