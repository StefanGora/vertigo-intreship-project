import { Elysia, t } from "elysia";
import { handleRegister, handleLogin } from "./handlers/auth.handlers";

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .post("/register", handleRegister, {
    body: t.Object({
      username: t.String(),
      email: t.String(),
      password: t.String(),
    }),
  })
  .post("/login", handleLogin, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
  });
