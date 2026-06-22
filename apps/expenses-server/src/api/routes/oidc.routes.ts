import { Router } from "express";
import { z } from "zod";
import { config } from "../../config/index.js";
import { verifyIdToken } from "../../utils/oidc.js";
import { userRepository } from "../../db/repositories/index.js";
import { UnauthorizedError, ValidationError } from "../../utils/errors.js";
import { sendSuccess, sendNoContent } from "../../utils/response.js";

const router = Router();

const callbackBodySchema = z.object({ code: z.string().min(1) });

router.post("/callback", async (req, res, next) => {
  try {
    const parsed = callbackBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid request body", {
        errors: parsed.error.issues,
      });
    }

    const { code } = parsed.data;

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.OIDC_REDIRECT_URI,
      client_id: config.LR_CLIENT_ID,
      client_secret: config.LR_CLIENT_SECRET,
      resource: config.REST_RESOURCE_URL,
    });

    const tokenRes = await fetch(config.LR_OIDC_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (!tokenRes.ok) {
      const body = (await tokenRes.json()) as { error_description?: string };
      throw new UnauthorizedError(
        body.error_description ?? "Authorization code exchange failed",
      );
    }

    const { access_token, expires_in } = (await tokenRes.json()) as {
      access_token: string;
      expires_in?: number;
    };

    res.cookie(config.COOKIE_NAME, access_token, {
      httpOnly: true,
      secure: config.COOKIE_SECURE,
      sameSite: "lax",
      maxAge: (expires_in ?? 3600) * 1000,
    });

    const tokenData = await verifyIdToken(access_token, {
      audience: config.REST_RESOURCE_URL,
    });

    const user = userRepository.findByLrUserIdOrEmail(
      tokenData.sub,
      tokenData.claims.email as string | undefined,
    );

    sendSuccess(res, { user: user ?? { sub: tokenData.sub } });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie(config.COOKIE_NAME);
  sendNoContent(res);
});

export const oidcRouter: Router = router;
