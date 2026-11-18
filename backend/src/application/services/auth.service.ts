import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Env } from '../../config/env';
import { ConflictError, UnauthorizedError } from '../../domain/errors';
import { PublicUser, User } from '../../domain/entities';
import { UserRepository } from '../../domain/repositories';
import { AuthService, AuthTokenPayload } from '../../domain/services/auth.service';

const BCRYPT_ROUNDS = 10;

/** Prisma error code for a unique-constraint violation. */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * Concrete authentication service backed by a `UserRepository`.
 * Handles password hashing, JWT signing/verification, and the
 * user-facing (password-free) projection.
 */
export class AuthServiceImpl implements AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly env: Env
  ) {}

  /** Creates an account and returns a signed token plus the public user. */
  async register(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ token: string; user: PublicUser }> {
    const existing = await this.users.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    let user: User;
    try {
      user = await this.users.create({
        name: data.name,
        email: data.email,
        passwordHash,
      });
    } catch (err) {
      // Unique-constraint race: two concurrent registers with the same email.
      if ((err as { code?: string }).code === UNIQUE_CONSTRAINT_VIOLATION) {
        throw new ConflictError('An account with this email already exists');
      }
      throw err;
    }

    return { token: this.signToken(user), user: toPublicUser(user) };
  }

  /** Verifies credentials and returns a signed token plus the public user. */
  async login(data: {
    email: string;
    password: string;
  }): Promise<{ token: string; user: PublicUser }> {
    const user = await this.users.findByEmail(data.email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    return { token: this.signToken(user), user: toPublicUser(user) };
  }

  /** Validates a JWT and returns its claims, or throws if invalid/expired. */
  async verifyToken(token: string): Promise<AuthTokenPayload> {
    try {
      const decoded = jwt.verify(token, this.env.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'flowboard',
        audience: 'flowboard-web',
      }) as AuthTokenPayload;
      if (!decoded.sub || !decoded.email) {
        throw new UnauthorizedError('Invalid token payload');
      }
      return { sub: decoded.sub, email: decoded.email };
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  /** Loads a user by id without exposing password material. */
  async getPublicUser(id: string): Promise<PublicUser | null> {
    const user = await this.users.findById(id);
    return user ? toPublicUser(user) : null;
  }

  /** Signs a JWT for the given user with the configured expiry and claims. */
  private signToken(user: User): string {
    const payload: AuthTokenPayload = { sub: user.id, email: user.email };
    const options: SignOptions = {
      expiresIn: this.env.jwtExpiresIn as SignOptions['expiresIn'],
      issuer: 'flowboard',
      audience: 'flowboard-web',
    };
    return jwt.sign(payload, this.env.jwtSecret, options);
  }
}

/** Strips sensitive fields (password hash) from a user entity. */
export function toPublicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, email: user.email };
}
