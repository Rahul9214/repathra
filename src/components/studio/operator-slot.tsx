import { connection } from "next/server";

import { ClerkOperator } from "@/components/studio/clerk-operator";
import { JOURNEY_MESSAGES } from "@/features/journey-studio/messages";
import { readClerkConfig } from "@/shared/config/clerk";

export async function OperatorSlot() {
  await connection();
  const clerk = readClerkConfig(process.env);
  if (!clerk.configured) {
    return (
      <p className="blocker" role="status">
        {JOURNEY_MESSAGES.auth_not_configured}
      </p>
    );
  }
  return <ClerkOperator />;
}
