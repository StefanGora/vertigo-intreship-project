import { eq, and, sql  } from "drizzle-orm";
import db from "../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../db/schema";
import { hashPassword, verifyPassword, type AuthTokenPayload } from "../lib/auth";
import {
  validateRegistration,
  validateLogin,
  validateMarketCreation,
  validateBet,
} from "../lib/validation";

type JwtSigner = {
  sign: (payload: AuthTokenPayload) => Promise<string>;
};

export async function handleRegister({
  body,
  jwt,
  set,
}: {
  body: { username: string; email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { username, email } = body;

  // Validate input
  const errors = validateRegistration(username, email, body.password);
  if (errors.length > 0) {
    console.log(new Date().toISOString(), "[REGISTER] Validation failed:", { username, email });
    set.status = 400;
    return { errors };
  }

  // Check if user already exists
  const existingUser = await db.query.usersTable.findFirst({
    where: (users, { or, eq }) => or(eq(users.email, email), eq(users.username, username)),
  });

  if (existingUser) {
    set.status = 409;
    const errors = [{ field: "email", message: "User already exists" }];
    console.log(new Date().toISOString(), "[REGISTER] User already exists:", {
      username,
      email,
      id: existingUser.id,
      statusCode: set.status,
      errors,
    });
    return { errors };
  }

  // Hash password safely
  const passwordHash = await hashPassword(body.password);

  // Insert new user
  const newUser = await db.insert(usersTable).values({ username, email, passwordHash }).returning();

  // Generate JWT token
  const token = await jwt.sign({ userId: newUser[0].id });

  set.status = 201;
  console.log(new Date().toISOString(), "[REGISTER] Success:", { username, email, id: newUser[0].id, errors });

  return {
    id: newUser[0].id,
    username: newUser[0].username,
    email: newUser[0].email,
    token,
  };
}

export async function handleLogin({
  body,
  jwt,
  set,
}: {
  body: { email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { email, password } = body;
  const errors = validateLogin(email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    set.status = 401;
    return { error: "Invalid email or password" };
  }

  const token = await jwt.sign({ userId: user.id });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    token,
  };
}

export async function handleCreateMarket({
  body,
  set,
  user,
}: {
  body: { title: string; description?: string; outcomes: string[] };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const { title, description, outcomes } = body;
  const errors = validateMarketCreation(title, description || "", outcomes);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db
    .insert(marketsTable)
    .values({
      title,
      description: description || null,
      createdBy: user.id,
    })
    .returning();

  const outcomeIds = await db
    .insert(marketOutcomesTable)
    .values(
      outcomes.map((title: string, index: number) => ({
        marketId: market[0].id,
        title,
        position: index,
      })),
    )
    .returning();

  set.status = 201;
  return {
    id: market[0].id,
    title: market[0].title,
    description: market[0].description,
    status: market[0].status,
    outcomes: outcomeIds,
  };
}

export async function handleListMarkets({ query }: { query: { status?: string } }) {
  /**
   * Default behavior:
   * If no status is provided, we assume the client wants "active" markets.
   * This keeps the API ergonomic and avoids forcing the frontend to always pass it.
   */
  const statusFilter = query.status || "active";

  /**
   * STEP 1: Fetch base market data
   *
   * We intentionally fetch:
   * - markets (filtered by status)
   * - creator (only username, to avoid over-fetching)
   * - outcomes (ordered for consistent UI rendering)
   *
   * NOTE:
   * This is NOT a SQL JOIN in the traditional sense.
   * Drizzle performs multiple queries under the hood and assembles the result.
   * This is easier to work with but can become inefficient at scale.
   */
  const markets = await db.query.marketsTable.findMany({
    where: eq(marketsTable.status, statusFilter),

    with: {
      creator: {
        // Only fetch what we need (good practice)
        columns: { username: true },
      },

      outcomes: {
        /**
         * Outcomes must be ordered (e.g. Yes/No, Team A/Team B)
         * Otherwise UI rendering may appear inconsistent between requests.
         */
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  /**
   * STEP 2: Enrich markets with computed data
   *
   * At this stage, we have:
   * - markets
   * - outcomes
   * - creator usernames
   *
   * What we DON'T have:
   * - total bets per outcome
   * - total bets per market
   * - odds
   *
   * These are computed manually below.
   *
   * ⚠️ IMPORTANT:
   * This implementation suffers from the "N+1 query problem":
   * For each outcome, we run an additional query to fetch bets.
   * This is acceptable for small datasets but will not scale.
   *
   * Future optimization:
   * Replace this with a single aggregated SQL query using GROUP BY.
   */
  const enrichedMarkets = await Promise.all(
    markets.map(async (market) => {
      /**
       * STEP 2.1: Compute total bets per outcome
       *
       * For each outcome in the market:
       * - fetch all bets
       * - sum their amounts
       *
       * NOTE:
       * We fetch ALL rows and reduce in JS.
       * A more efficient approach would be:
       * SELECT SUM(amount) FROM bets WHERE outcome_id = ?
       */
      const betsPerOutcome = await Promise.all(
      market.outcomes.map(async (outcome) => {
        // ✅ Aggregate total bet amount for this outcome in one query
        const [result] = await db
          .select({
            totalBets: sql<number>`SUM(${betsTable.amount})`,
          })
          .from(betsTable)
          .where(eq(betsTable.outcomeId, outcome.id));

        // result.totalBets can be null if there are no bets
        return { outcomeId: outcome.id, totalBets: result.totalBets ?? 0 };
      })
    );

      /**
       * STEP 2.2: Compute total bets across the entire market
       *
       * This is needed to calculate odds later.
       */
      const totalMarketBets = betsPerOutcome.reduce((sum, b) => sum + b.totalBets, 0);

      /**
       * STEP 2.3: Construct response object
       *
       * We transform raw DB data into a shape suitable for the frontend.
       */
      return {
        id: market.id,
        title: market.title,
        status: market.status,

        /**
         * Creator username (optional chaining for safety)
         */
        creator: market.creator?.username,

        /**
         * Map outcomes and attach computed fields
         */
        outcomes: market.outcomes.map((outcome) => {
          /**
           * Find precomputed total bets for this outcome
           */
          const outcomeBets =
            betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;

          /**
           * Odds calculation:
           * percentage of total market bets allocated to this outcome
           *
           * Example:
           * outcomeBets = 30
           * totalMarketBets = 100
           * odds = 30%
           *
           * We guard against division by zero.
           */
          const odds =
            totalMarketBets > 0
              ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2))
              : 0;

          return {
            id: outcome.id,
            title: outcome.title,
            odds,
            totalBets: outcomeBets,
          };
        }),

        /**
         * Total liquidity in this market
         * (useful for sorting, analytics, UI display)
         */
        totalMarketBets,
      };
    }),
  );

  /**
   * FINAL STEP:
   * Return enriched markets to the caller.
   *
   * At this point, the data is fully computed and ready for frontend consumption.
   */
  return enrichedMarkets;
}

export async function handleGetMarket({
  params,
  set,
}: {
  params: { id: number };
  set: { status: number };
}) {
  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, params.id),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  const betsPerOutcome = await Promise.all(
    market.outcomes.map(async (outcome) => {
      const totalBets = await db
        .select()
        .from(betsTable)
        .where(eq(betsTable.outcomeId, outcome.id));

      const totalAmount = totalBets.reduce((sum, bet) => sum + bet.amount, 0);
      return { outcomeId: outcome.id, totalBets: totalAmount };
    }),
  );

  const totalMarketBets = betsPerOutcome.reduce((sum, b) => sum + b.totalBets, 0);

  return {
    id: market.id,
    title: market.title,
    description: market.description,
    status: market.status,
    creator: market.creator?.username,
    outcomes: market.outcomes.map((outcome) => {
      const outcomeBets = betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;
      const odds =
        totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

      return {
        id: outcome.id,
        title: outcome.title,
        odds,
        totalBets: outcomeBets,
      };
    }),
    totalMarketBets,
  };
}

export async function handlePlaceBet({
  params,
  body,
  set,
  user,
}: {
  params: { id: number };
  body: { outcomeId: number; amount: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const marketId = params.id;
  const { outcomeId, amount } = body;
  const errors = validateBet(amount);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, marketId),
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  if (market.status !== "active") {
    set.status = 400;
    return { error: "Market is not active" };
  }

  const outcome = await db.query.marketOutcomesTable.findFirst({
    where: and(eq(marketOutcomesTable.id, outcomeId), eq(marketOutcomesTable.marketId, marketId)),
  });

  if (!outcome) {
    set.status = 404;
    return { error: "Outcome not found" };
  }

  const bet = await db
    .insert(betsTable)
    .values({
      userId: user.id,
      marketId,
      outcomeId,
      amount: Number(amount),
    })
    .returning();

  set.status = 201;
  return {
    id: bet[0].id,
    userId: bet[0].userId,
    marketId: bet[0].marketId,
    outcomeId: bet[0].outcomeId,
    amount: bet[0].amount,
  };
}
