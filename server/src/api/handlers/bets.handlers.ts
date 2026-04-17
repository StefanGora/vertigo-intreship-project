import { eq, and } from "drizzle-orm";
import db from "../../db";
import {
  usersTable,
  marketsTable,
  marketOutcomesTable,
  betsTable,
  walletsTable,
  transactionsTable,
} from "../../db/schema";
import { validateBet } from "../../lib/validation";

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

  // -------------------------
  // WALLET CHECK
  // -------------------------
  const wallet = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, user.id))
    .limit(1);

  if (!wallet.length) {
    set.status = 404;
    return { error: "Wallet not found" };
  }

  const userWallet = wallet[0];

  if (userWallet.balance < amount) {
    set.status = 400;
    return {
      error: "INSUFFICIENT_BALANCE",
      message: "Insufficient balance",
    };
  }

  // -------------------------
  // MARKET CHECK
  // -------------------------
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
    where: and(
      eq(marketOutcomesTable.id, outcomeId),
      eq(marketOutcomesTable.marketId, marketId)
    ),
  });

  if (!outcome) {
    set.status = 404;
    return { error: "Outcome not found" };
  }

  // =====================================================
  // TRANSACTION + WALLET UPDATE 
  // =====================================================

  const newBalance = userWallet.balance - amount;

  await db
    .update(walletsTable)
    .set({ balance: newBalance })
    .where(eq(walletsTable.userId, user.id));

  const bet = await db
    .insert(betsTable)
    .values({
      userId: user.id,
      marketId,
      outcomeId,
      amount: Number(amount),
    })
    .returning();

  const [transaction] = await db.insert(transactionsTable).values({
    walletId: userWallet.id,
    type: "bet",
    amount: Number(amount),
    betId: bet[0].id,
  })
  .returning();

  // -------------------------
  // LOGGING
  // -------------------------
  console.log("=====Trasction occured======");
  console.log({
    timestamp: transaction.createdAt,
    type: transaction.type,
    walletId: transaction.walletId,
    userId: user.id,
    betId: transaction.betId,
    amount: transaction.amount,
    oldBalance: userWallet.balance,
    newBalance,
  });

  // -------------------------
  // RESPONSE
  // -------------------------
  set.status = 201;
  return {
    id: bet[0].id,
    userId: bet[0].userId,
    marketId: bet[0].marketId,
    outcomeId: bet[0].outcomeId,
    amount: bet[0].amount,
  };
}