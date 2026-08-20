import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      // Deliberately vague — don't confirm/deny an email exists in responses
      // that aren't the login flow itself.
      throw new ConflictException('Unable to create account with these details');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
      },
    });

    return this.issueToken(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Compare against a dummy hash when the user doesn't exist so response
    // timing doesn't reveal whether the email is registered.
    const hashToCompare =
      user?.passwordHash ??
      '$2b$12$invalidsaltinvalidsaltinvalidsaltinvalidsaltinvalidsal';
    const passwordMatches = await bcrypt.compare(dto.password, hashToCompare);

    if (!user || !passwordMatches || user.status !== 'active') {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueToken(user.id, user.email);
  }

  private issueToken(userId: string, email: string) {
    const accessToken = this.jwt.sign({ sub: userId, email });
    return {
      accessToken,
      user: { id: userId, email },
    };
  }
}
