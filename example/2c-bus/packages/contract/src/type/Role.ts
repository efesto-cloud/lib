export const ROLES = ["staff", "admin"] as const;

export type Role = (typeof ROLES)[number];
