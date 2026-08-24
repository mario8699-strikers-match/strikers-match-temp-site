import { Module } from "@nestjs/common";
import { POSTGRES_POOL_PROVIDER, postgresPoolProvider } from "./postgres.provider";

@Module({
  providers: [postgresPoolProvider],
  exports: [POSTGRES_POOL_PROVIDER],
})
export class DatabaseModule {}
