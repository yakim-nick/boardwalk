import { PublicUser } from '../entities';

/** Claims embedded in the signed JWT. */
export interface AuthTokenPayload {
  /** User id (JWT `sub` claim). */
  sub: string;
  /** User email, used for display and audit purposes. */
  email: string;
}

/**
 * Port for authentication operations.
 * Implemented by `AuthServiceImpl`; the API layer depends on this interface
 * so it can be swapped or mocked in tests.
 */
export interface AuthService {
  register(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ token: string; user: PublicUser }>;
  login(data: { email: string; password: string }): Promise<{ token: string; user: PublicUser }>;
  verifyToken(token: string): Promise<AuthTokenPayload>;
  getPublicUser(id: string): Promise<PublicUser | null>;
}
