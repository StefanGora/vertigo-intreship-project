import { eq, and, desc, sql } from "drizzle-orm";
import db from "../../db";
import { betsTable, marketsTable, marketOutcomesTable, walletsTable } from "../../db/schema";
import { decodeCursor, encodeCursor, buildSimpleCursorCondition } from "../../lib/cursor";
import { calculateOutcomeOdds } from "../../lib/odds";

export async function handleLisActiveBets({
  query,
  user,
}: {
  query: { cursor?: string | null };
  user: { id: number } | null;
}) {
  if (!user) return { error: "Unauthorized" };

  const cursor = decodeCursor(query.cursor);
  const cursorCondition = buildSimpleCursorCondition(cursor, betsTable);

  const userBets = await db
    .select({
      betId: betsTable.id,
      amount: betsTable.amount,
      createdAt: betsTable.createdAt,

      marketId: marketsTable.id,
      marketTitle: marketsTable.title,
      marketStatus: marketsTable.status,

      outcomeId: marketOutcomesTable.id,
      outcomeTitle: marketOutcomesTable.title,
    })
    .from(betsTable)
    .leftJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
    .leftJoin(
      marketOutcomesTable,
      eq(betsTable.outcomeId, marketOutcomesTable.id),
    )
    .where(
      and(
        eq(betsTable.userId, user.id),
        eq(marketsTable.status, "active"),
        cursorCondition
      )
    )
    .orderBy(desc(betsTable.createdAt), desc(betsTable.id))
    .limit(20);

  const marketTotals = await db
    .select({
      marketId: betsTable.marketId,
      outcomeId: betsTable.outcomeId,
      total: sql<number>`SUM(${betsTable.amount})`,
    })
    .from(betsTable)
    .groupBy(betsTable.marketId, betsTable.outcomeId);

  const totalsMap = new Map<string, number>();
  for (const row of marketTotals) {
    totalsMap.set(`${row.marketId}-${row.outcomeId}`, row.total ?? 0);
  }

  const response = userBets.map((bet) => {
    const outcomeTotal =
      totalsMap.get(`${bet.marketId}-${bet.outcomeId}`) ?? 0;

    const marketTotal = Array.from(totalsMap.entries())
      .filter(([key]) => key.startsWith(`${bet.marketId}-`))
      .reduce((sum, [, val]) => sum + val, 0);

    const odds = calculateOutcomeOdds(outcomeTotal, marketTotal);

    return {
      betId: bet.betId,
      amount: bet.amount,
      createdAt: bet.createdAt,

      market: {
        id: bet.marketId,
        title: bet.marketTitle,
        status: bet.marketStatus,
      },

      outcome: {
        id: bet.outcomeId,
        title: bet.outcomeTitle,
        odds,
      },
    };
  });

  const last = userBets[userBets.length - 1];

  return {
    data: response,
    cursor: last
      ? encodeCursor({
          value: new Date(last.createdAt).getTime(),
          id: last.betId,
        })
      : null,
  };
}

export async function handleLisResolvedBets({
  query,
  user,
}: {
  query: { cursor?: string | null };
  user: { id: number } | null;
}) {
  if (!user) return { error: "Unauthorized" };

  const cursor = decodeCursor(query.cursor);
  const cursorCondition = buildSimpleCursorCondition(cursor, betsTable);

  const userBets = await db
    .select({
      betId: betsTable.id,
      amount: betsTable.amount,
      createdAt: betsTable.createdAt,

      marketId: marketsTable.id,
      marketTitle: marketsTable.title,
      resolvedOutcomeId: marketsTable.resolvedOutcomeId,

      outcomeId: marketOutcomesTable.id,
      outcomeTitle: marketOutcomesTable.title,
    })
    .from(betsTable)
    .leftJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
    .leftJoin(
      marketOutcomesTable,
      eq(betsTable.outcomeId, marketOutcomesTable.id),
    )
    .where(
      and(
        eq(betsTable.userId, user.id),
        eq(marketsTable.status, "resolved"),
        cursorCondition
      )
    )
    .orderBy(desc(betsTable.createdAt), desc(betsTable.id))
    .limit(20);

  const response = userBets.map((bet) => {
    const isWinner =
      bet.outcomeId === bet.resolvedOutcomeId;

    return {
      betId: bet.betId,
      amount: bet.amount,
      createdAt: bet.createdAt,

      market: {
        id: bet.marketId,
        title: bet.marketTitle,
      },

      outcome: {
        id: bet.outcomeId,
        title: bet.outcomeTitle,
      },

      result: isWinner ? "won" : "lost",
    };
  });

  const last = userBets[userBets.length - 1];

  return {
    data: response,
    cursor: last
      ? encodeCursor({
          value: new Date(last.createdAt).getTime(),
          id: last.betId,
        })
      : null,
  };
}


export async function handleGetUserBalance({
  user,
}: {
  user: { id: number } | null;
}) {
  if (!user) return { error: "Unauthorized" };

  const wallet = await db
    .select({
      balance: walletsTable.balance,
    })
    .from(walletsTable)
    .where(eq(walletsTable.userId, user.id))
    .limit(1);

  if (!wallet.length) {
    return {
      balance: 0,
    };
  }

  return {
    balance: wallet[0].balance,
  };
}