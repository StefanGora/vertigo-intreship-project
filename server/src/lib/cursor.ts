import { eq, and, lt, or  } from "drizzle-orm";

export type Cursor<T = number> = {
  value: T;
  id: number;
};

export function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64");
}

export function decodeCursor(cursor?: string | null): Cursor | null {
  if (!cursor) return null;

  return JSON.parse(Buffer.from(cursor, "base64").toString());
}

export function buildSimpleCursorCondition(cursor: Cursor | null, table: any) {
  if (!cursor) return undefined;

  return or(
    lt(table.createdAt, new Date(cursor.value)),
    and(eq(table.createdAt, new Date(cursor.value)), lt(table.id, cursor.id))
  );
}

export function buildCursorCondition({
  sortBy,
  cursor,
  table,
  betsSum,
  participantsCount,
}: {
  sortBy: string;
  cursor: Cursor | null;
  table: any;
  betsSum: any;
  participantsCount: any;
}) {
  if (!cursor) return undefined;

  const id = table.id;

  switch (sortBy) {
    case "date":
      return or(
        lt(table.createdAt, new Date(cursor.value)),
        and(eq(table.createdAt, new Date(cursor.value)), lt(id, cursor.id))
      );

    case "bets":
      return or(
        lt(betsSum, cursor.value),
        and(eq(betsSum, cursor.value), lt(id, cursor.id))
      );

    case "participants":
      return or(
        lt(participantsCount, cursor.value),
        and(eq(participantsCount, cursor.value), lt(id, cursor.id))
      );
  }
}