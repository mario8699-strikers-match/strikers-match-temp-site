import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { GraphicsCuesService } from "./graphics-cues.service";
import type { CreateGraphicsCueInput } from "./graphics-cues.service";

type SetActiveBody = {
  isActive: boolean;
};

@Controller()
export class GraphicsCuesController {
  constructor(private readonly graphicsCuesService: GraphicsCuesService) {}

  @Get("events/:eventId/graphics-cues")
  listGraphicsCuesForEvent(@Param("eventId") eventId: string) {
    return this.graphicsCuesService.listGraphicsCuesForEvent(eventId);
  }

  @Post("events/:eventId/graphics-cues")
  createGraphicsCue(
    @Param("eventId") eventId: string,
    @Body() body: CreateGraphicsCueInput,
  ) {
    return this.graphicsCuesService.createGraphicsCue(eventId, body);
  }

  @Patch("graphics-cues/:graphicsCueId")
  setGraphicsCueActive(
    @Param("graphicsCueId") graphicsCueId: string,
    @Body() body: SetActiveBody,
  ) {
    return this.graphicsCuesService.setGraphicsCueActive(
      graphicsCueId,
      body.isActive,
    );
  }
}
