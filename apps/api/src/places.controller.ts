import { Controller, Get, Inject, Param } from '@nestjs/common';
import { GooglePlacesService } from './google-places.service';

@Controller('places')
export class PlacesController {
  constructor(
    @Inject(GooglePlacesService) private places: GooglePlacesService
  ) {}

  @Get(':placeId/preview')
  preview(@Param('placeId') placeId: string) {
    return this.places.fetchPlacePreview(placeId);
  }
}
