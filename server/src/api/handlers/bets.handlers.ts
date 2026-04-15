import { eq, and  } from "drizzle-orm";
import db from "../../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../../db/schema";
import {  validateBet } from "../../lib/validation";

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