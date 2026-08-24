import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { FightCardsController } from "./fight-cards.controller";
import { FightCardsService } from "./fight-cards.service";

@Module({
  imports: [DatabaseModule],
  controllers: [FightCardsController],
  providers: [FightCardsService],
  exports: [FightCardsService],
})
export class FightCardsModule {}
