import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CustomerAuthService } from './customer-auth.service';

function toE164Colombia(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('57') && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith('3') && digits.length === 10) return `+57${digits}`;
  if (input.trim().startsWith('+')) return input.trim();
  return `+${digits}`;
}

function bearerToken(header?: string): string {
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedException('Falta token de sesión');
  }
  return header.slice('Bearer '.length);
}

@Controller('customer-auth')
export class CustomerAuthController {
  constructor(@Inject(CustomerAuthService) private auth: CustomerAuthService) {}

  @Post('otp')
  requestOtp(@Body() body: { phone: string }) {
    return this.auth.requestOtp(toE164Colombia(body.phone));
  }

  @Post('otp/verify')
  verifyOtp(@Body() body: { phone: string; code: string }) {
    return this.auth.verifyOtp(toE164Colombia(body.phone), body.code);
  }

  @Patch('profile')
  setProfile(
    @Headers('authorization') authHeader: string,
    @Body() body: { name: string }
  ) {
    return this.auth.setProfile(bearerToken(authHeader), body.name);
  }

  @Get('session')
  async session(@Headers('authorization') authHeader: string) {
    const user = await this.auth.requireSession(bearerToken(authHeader));
    return { user };
  }

  @Post('logout')
  logout(@Headers('authorization') authHeader: string) {
    return this.auth.logout(bearerToken(authHeader));
  }
}
