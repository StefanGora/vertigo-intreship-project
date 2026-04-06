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

export async function handleListMarkets({ query, }: { query: { status?: string, sortBy?: string } }) {
  /**
   * Default behavior:
   * If no status is provided, we assume the client wants "active" markets.
   */
  const statusFilter = query.status || "active";
  const sortFlag = query.sortBy || "date";

  /**
   * STEP 1: Fetch base market data
   */
  const markets = await db.query.marketsTable.findMany({
    where: eq(marketsTable.status, statusFilter),

    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  /**
   * STEP 2: Fetch ALL bets aggregated by outcome (fixes N+1)
   */
  const outcomeTotals = await db
    .select({
      outcomeId: betsTable.outcomeId,
      totalBets: sql<number>`SUM(${betsTable.amount})`,
    })
    .from(betsTable)
    .groupBy(betsTable.outcomeId);

  /**
   * Convert to a lookup map for O(1) access
   */
  const betsMap = new Map<number, number>();
  for (const row of outcomeTotals) {
    betsMap.set(row.outcomeId, row.totalBets ?? 0);
  }

  /**
   * STEP 3: Enrich markets with computed data
   */
  const enrichedMarkets = markets.map((market) => {
    /**
     * Attach total bets to each outcome
     */
    const outcomesWithBets = market.outcomes.map((outcome) => {
      const totalBets = betsMap.get(outcome.id) ?? 0;
      return { ...outcome, totalBets };
    });

    /**
     * Compute total market liquidity
     */
    const totalMarketBets = outcomesWithBets.reduce(
      (sum, o) => sum + o.totalBets,
      0
    );

    /**
     * Build final response
     */
    return {
      id: market.id,
      title: market.title,
      status: market.status,
      creator: market.creator?.username,
      creationDate: new Date(market.createdAt).toLocaleDateString(),

      outcomes: outcomesWithBets.map((outcome) => {
        const odds =
          totalMarketBets > 0
            ? Number(((outcome.totalBets / totalMarketBets) * 100).toFixed(2))
            : 0;

        return {
          id: outcome.id,
          title: outcome.title,
          totalBets: outcome.totalBets,
          odds,
        };
      }),

      totalMarketBets,
    };
  });

  /**
   * FINAL STEP: Return enriched markets
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
