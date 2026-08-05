import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Env } from '../../config/env';
import { ConflictError, UnauthorizedError } from '../../domain/errors';
import { PublicUser, User } from '../../domain/entities';
import { UserRepository } from '../../domain/repositories';
import { AuthService, AuthTokenPayload } from '../../domain/services/auth.service';

const BCRYPT_ROUNDS = 10;

export class AuthServiceImpl implements AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly env: Env
  ) {}

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
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictError('An account with this email already exists');
      }
      throw err;
    }

    return { token: this.signToken(user), user: toPublicUser(user) };
  }

  async login(data: { email: string; password: string }): Promise<{ token: string; user: PublicUser }> {
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

  async getPublicUser(id: string): Promise<PublicUser | null> {
    const user = await this.users.findById(id);
    return user ? toPublicUser(user) : null;
  }

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

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, email: user.email };
}
