import { Body, Controller, Headers, Inject, Post } from '@nestjs/common';
import { JobsService } from './jobs.service';
import type { JobType } from './jobs.types';

@Controller('jobs')
export class JobsController {
  constructor(@Inject(JobsService) private jobs: JobsService) {}

  @Post('run')
  async run(
    @Headers('x-onda-jobs-secret') secret: string | undefined,
    @Body() body: { type: JobType; payload: unknown }
  ) {
    this.jobs.verifyWorkerSecret(secret);
    await this.jobs.dispatch(body.type, body.payload);
    return { ok: true };
  }
}
