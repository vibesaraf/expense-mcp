import { config } from "@/config";
import { Router, type Router as ExpressRouter } from "express";

const router: ExpressRouter = Router();

router.get("/.well-known/oauth-protected-resource", (_req, res) => {
  const protectedResourceMetadata = JSON.parse(config.PROTECTED_RESOURCE_METADATA)

  res.json(protectedResourceMetadata);
});

export const wellKnownRouter: Router = router;
