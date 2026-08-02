import { Inject, Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(JwtService) private jwt: JwtService
  ) {}

  @Post('merchant')
  async merchantLogin(@Body() body: { email: string; pinCode: string }) {
    const store = await this.prisma.store.findFirst({
      where: { ownerEmail: body.email },
    });
    if (!store || store.pinCode !== body.pinCode) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const token = await this.jwt.signAsync({
      sub: store.id,
      role: 'merchant',
      email: store.ownerEmail,
    });
    return { token, store };
  }

  @Post('organizer')
  async organizerLogin(@Body() body: { email: string; password: string }) {
    // Dev auth for organizers
    if (body.password !== 'onda-org' && body.password !== process.env.JWT_SECRET) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const token = await this.jwt.signAsync({
      sub: 'organizer',
      role: 'organizer',
      email: body.email,
    });
    return { token, role: 'organizer' };
  }
}
