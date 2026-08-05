import { PublicUser } from '../entities';

export interface AuthTokenPayload {
  sub: string;
  email: string;
}

export interface AuthService {
  register(data: { name: string; email: string; password: string }): Promise<{ token: string; user: PublicUser }>;
  login(data: { email: string; password: string }): Promise<{ token: string; user: PublicUser }>;
  verifyToken(token: string): Promise<AuthTokenPayload>;
  getPublicUser(id: string): Promise<PublicUser | null>;
}
