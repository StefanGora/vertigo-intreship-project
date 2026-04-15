import { eq, sql, desc, inArray  } from "drizzle-orm";
import { encodeCursor, decodeCursor, buildCursorCondition } from "../../lib/cursor";
import { calculateOutcomeOdds } from "../../lib/odds";
import db from "../../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../../db/schema";
import {
  validateMarketCreation,
} from "../../lib/validation";

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

export async function handleListMarkets({
  query,
}: {
  query: {
    status?: string;
    sortBy?: "date" | "bets" | "participants";
    cursor?: string | null;
  };
}) {
  const statusFilter = query.status ?? "active";
  const sortBy = query.sortBy ?? "date";
  const cursor = decodeCursor(query.cursor);

  console.log(cursor)

  /**
   * -----------------------------
   * Aggregations (IMPORTANT: reuse everywhere)
   * -----------------------------
   */
  const betsSum = sql<number>`COALESCE(SUM(${betsTable.amount}), 0)`;
  const participantsCount = sql<number>`COUNT(DISTINCT ${betsTable.userId})`;

  const sortMap = {
    date: desc(marketsTable.createdAt),
    bets: desc(betsSum),
    participants: desc(participantsCount),
  };

  const sortExpr = sortMap[sortBy];

  /**
   * -----------------------------
   * Base query
   * -----------------------------
   */
  let queryBuilder = db
    .select({
      id: marketsTable.id,
      title: marketsTable.title,
      status: marketsTable.status,
      description: marketsTable.description,
      createdAt: marketsTable.createdAt,
      creator: usersTable.username,

      totalMarketBets: betsSum,
      participants: participantsCount,
    })
    .from(marketsTable)
    .leftJoin(usersTable, eq(usersTable.id, marketsTable.createdBy))
    .leftJoin(
      marketOutcomesTable,
      eq(marketOutcomesTable.marketId, marketsTable.id)
    )
    .leftJoin(
      betsTable,
      eq(betsTable.outcomeId, marketOutcomesTable.id)
    )
    .where(eq(marketsTable.status, statusFilter))
    .groupBy(
      marketsTable.id,
      marketsTable.title,
      marketsTable.status,
      marketsTable.createdAt,
      usersTable.username
    );

  /**
   * -----------------------------
   * CURSOR FILTER 
   * -----------------------------
   */
  const cursorCondition = buildCursorCondition({
    sortBy,
    cursor,
    table: marketsTable,
    betsSum,
    participantsCount,
  });

  if (cursorCondition) {
    // IMPORTANT: date uses WHERE, aggregates use HAVING
    if (sortBy === "date") {
      queryBuilder = queryBuilder.where(cursorCondition);
    } else {
      queryBuilder = queryBuilder.having(cursorCondition);
    }
  }

  /**
   * -----------------------------
   * Final query execution
   * -----------------------------
   */
  const markets = await queryBuilder
    .orderBy(sortExpr, desc(marketsTable.id))
    .limit(20);

  if (!markets) throw new Error("Markets query failed");

  /**
   * -----------------------------
   * Outcomes
   * -----------------------------
   */
  const marketIds = markets.map((m) => m.id);

  const outcomes = await db.query.marketOutcomesTable.findMany({
    where: inArray(marketOutcomesTable.marketId, marketIds),
    orderBy: (o, { asc }) => asc(o.position),
  });

  /**
   * -----------------------------
   * Outcome totals
   * -----------------------------
   */
  const outcomeTotals = await db
    .select({
      outcomeId: betsTable.outcomeId,
      totalBets: sql<number>`SUM(${betsTable.amount})`,
    })
    .from(betsTable)
    .groupBy(betsTable.outcomeId);

  const outcomeTotalsMap = new Map<number, number>();
  for (const row of outcomeTotals) {
    outcomeTotalsMap.set(row.outcomeId, row.totalBets ?? 0);
  }

  /**
   * -----------------------------
   * Response
   * -----------------------------
   */
  const response = markets.map((market) => {
    const relatedOutcomes = outcomes.filter(
      (o) => o.marketId === market.id
    );

    const outcomesWithBets = relatedOutcomes.map((o) => {
      const totalBets = outcomeTotalsMap.get(o.id) ?? 0;

      const odds = calculateOutcomeOdds(totalBets, market.totalMarketBets);

      return {
        id: o.id,
        title: o.title,
        totalBets,
        odds,
      };
    });

    return {
      id: market.id,
      title: market.title,
      status: market.status,
      creator: market.creator,
      description: market.description,
      creationDate: new Date(market.createdAt).toLocaleDateString(),
      totalMarketBets: market.totalMarketBets,
      participants: market.participants,
      outcomes: outcomesWithBets,
    };
  });

  /**
   * -----------------------------
   * NEXT CURSOR
   * -----------------------------
   */
  const last = markets[markets.length - 1];

  const nextCursor = last
    ? encodeCursor({
        value:
          sortBy === "date"
            ? new Date(last.createdAt).getTime()
            : sortBy === "bets"
            ? last.totalMarketBets
            : last.participants,
        id: last.id,
      })
    : null;

  return {
    data: response,
    cursor: nextCursor
  };
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