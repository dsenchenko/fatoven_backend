export interface AuthTokenPayload {
  sub: string;
  email: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: Date;
}
