export interface AuthTokenPayload {
  sub: string;
  email: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  createdAt: Date;
}

export interface PublicStatsProfile {
  id: string;
  username: string;
  displayName: string | null;
  createdAt: Date;
}
