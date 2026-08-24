import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ProductionSessionsService } from "./production-sessions.service";

type CreateProductionSessionBody = {
  eventId: string;
};

type SelectPreviewBody = {
  cameraSourceId: string | null;
};

type SetActiveBoutBody = {
  boutId: string | null;
};

type ConfigureRoundTimerBody = {
  currentRound: number;
  durationSeconds: number;
};

@Controller("production-sessions")
export class ProductionSessionsController {
  constructor(
    private readonly productionSessionsService: ProductionSessionsService,
  ) {}

  @Get("events/:eventId/state")
  getStudioState(@Param("eventId") eventId: string) {
    return this.productionSessionsService.getStudioState(eventId);
  }

  @Post()
  createProductionSession(@Body() body: CreateProductionSessionBody) {
    return this.productionSessionsService.createProductionSession(body.eventId);
  }

  @Patch(":sessionId/preview")
  selectPreviewCamera(
    @Param("sessionId") sessionId: string,
    @Body() body: SelectPreviewBody,
  ) {
    return this.productionSessionsService.selectPreviewCamera(
      sessionId,
      body.cameraSourceId,
    );
  }

  @Post(":sessionId/take")
  takePreviewToProgram(@Param("sessionId") sessionId: string) {
    return this.productionSessionsService.takePreviewToProgram(sessionId);
  }

  @Patch(":sessionId/active-bout")
  setActiveBout(
    @Param("sessionId") sessionId: string,
    @Body() body: SetActiveBoutBody,
  ) {
    return this.productionSessionsService.setActiveBout(sessionId, body.boutId);
  }

  @Post(":sessionId/round-timer")
  configureRoundTimer(
    @Param("sessionId") sessionId: string,
    @Body() body: ConfigureRoundTimerBody,
  ) {
    return this.productionSessionsService.configureRoundTimer(
      sessionId,
      body.currentRound,
      body.durationSeconds,
    );
  }

  @Post(":sessionId/round-timer/start")
  startRoundTimer(@Param("sessionId") sessionId: string) {
    return this.productionSessionsService.startRoundTimer(sessionId);
  }

  @Post(":sessionId/round-timer/pause")
  pauseRoundTimer(@Param("sessionId") sessionId: string) {
    return this.productionSessionsService.pauseRoundTimer(sessionId);
  }

  @Post(":sessionId/round-timer/reset")
  resetRoundTimer(@Param("sessionId") sessionId: string) {
    return this.productionSessionsService.resetRoundTimer(sessionId);
  }
}
