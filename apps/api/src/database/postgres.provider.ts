import { Provider } from "@nestjs/common";
import { Pool } from "pg";
import { getEnvironment } from "../config/environment";

export const POSTGRES_POOL_PROVIDER = "POSTGRES_POOL";

export const postgresPoolProvider: Provider<Pool> = {
  provide: POSTGRES_POOL_PROVIDER,
  useFactory: () => {
    const environment = getEnvironment();

    return new Pool({
      connectionString: environment.databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
      options: "-c search_path=studio",
    });
  },
};
