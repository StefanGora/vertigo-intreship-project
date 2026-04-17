import { eq} from "drizzle-orm";
import db from "../../db";
import { usersTable, walletsTable } from "../../db/schema";
import { hashPassword, verifyPassword, type AuthTokenPayload } from "../../lib/auth";
import {
  validateRegistration,
  validateLogin,
} from "../../lib/validation";

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
  
  const userId = newUser[0].id;
  // create new wallet ( hardcoded for now with 1000)
  const newWallet = await db.insert(walletsTable).values({userId, balance: 1000 }).returning();

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
    role: user.role,
    token,
  };
}