import { getEnv } from "../../toImplement/helpers/getEnv";
import { supabaseAuthClientFromSSRContext } from "../../toImplement/client/supabaseAuthClientFromSSRContext";
import { betterAuthClientFromSSRContext } from "../../toImplement/server/useBetterAuthClient";
import { authentikAuthClientFromSSRContext } from "../../toImplement/server/authentikAuthClientFromSSRContext";
import { HeliconeAuthClient } from "./HeliconeAuthClient";

export async function getSSRHeliconeAuthClient({
  ctx,
}: {
  ctx: SSRContext<any, any, any>;
}): Promise<HeliconeAuthClient> {
  // ADR 0024 precedence: Authentik OIDC → better-auth → Supabase fallback.
  if (getEnv("AUTH_PROVIDER") === "authentik") {
    return authentikAuthClientFromSSRContext(ctx);
  }
  if (getEnv("NEXT_PUBLIC_BETTER_AUTH") === "true") {
    return betterAuthClientFromSSRContext(ctx);
  }
  return supabaseAuthClientFromSSRContext(ctx);
}

export type SSRContext<
  NextApiRequest extends { headers: Record<string, string> },
  NextApiResponse,
  GetServerSidePropsContext,
> = { req: NextApiRequest; res: NextApiResponse } | GetServerSidePropsContext;
