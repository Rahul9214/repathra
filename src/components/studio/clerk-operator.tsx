"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";

export function ClerkOperator() {
  return (
    <div className="operator-controls">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" className="button button-quiet button-sm nav-sign-in-btn">
            <span className="sign-in-full">Operator Sign In</span>
            <span className="sign-in-short">Sign In</span>
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}

export function OperatorSignInButton({
  label = "Sign in as operator",
  className = "button button-primary",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <SignInButton mode="modal">
      <button type="button" className={className}>
        {label}
      </button>
    </SignInButton>
  );
}

export function OperatorAccessCard({
  gate,
}: {
  gate: "auth_not_configured" | "unauthenticated" | "unauthorized";
}) {
  if (gate === "unauthenticated") {
    return (
      <div className="operator-access-card" aria-label="Operator access required">
        <div>
          <span className="badge badge-operator">Operator Desk</span>
        </div>
        <h3>Operator Access</h3>
        <p className="meta">
          Sign in with an authorized operator account to define new workflows, edit drafts, and publish immutable versions.
        </p>
        <div>
          <OperatorSignInButton label="Sign in as operator" className="button button-primary" />
        </div>
      </div>
    );
  }

  if (gate === "unauthorized") {
    return (
      <div className="operator-access-card is-restricted" aria-label="Operator access restricted">
        <div>
          <span className="badge badge-sandbox">Access Restricted</span>
        </div>
        <h3>Operator Authorization Required</h3>
        <p className="meta">
          This account is signed in, but does not have operator permissions to create or edit journeys. Contact an administrator to request access.
        </p>
      </div>
    );
  }

  return (
    <div className="operator-access-card" aria-label="Operator desk offline">
      <div>
        <span className="badge badge-status-frozen">Desk Offline</span>
      </div>
      <h3>Operator Authentication Offline</h3>
      <p className="meta">
        Operator authentication is not configured in this environment. Journey definitions and editing remain closed.
      </p>
    </div>
  );
}

export function DraftAccessBanner({
  draftAccess,
  clerkConfigured = true,
}: {
  draftAccess: "auth_not_configured" | "unauthenticated" | "unauthorized" | "allowed";
  clerkConfigured?: boolean;
}) {
  if (draftAccess === "allowed") {
    return null;
  }

  if (draftAccess === "unauthenticated") {
    return (
      <div className="draft-access-banner" role="status">
        <div className="draft-access-copy">
          <span className="badge badge-operator">Draft Editing Restricted</span>
          <p>Sign in with an authorized operator account to modify drafts or publish immutable versions.</p>
        </div>
        {clerkConfigured ? (
          <OperatorSignInButton label="Sign in as operator" className="button button-secondary button-sm" />
        ) : null}
      </div>
    );
  }

  if (draftAccess === "unauthorized") {
    return (
      <div className="draft-access-banner is-restricted" role="status">
        <div className="draft-access-copy">
          <span className="badge badge-sandbox">Operator Restricted</span>
          <p>Signed in with an unauthorized account. Operator permissions are required to modify drafts or publish versions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="draft-access-banner" role="status">
      <div className="draft-access-copy">
        <span className="badge badge-status-frozen">Auth Offline</span>
        <p>Operator authentication is not configured. Journey editing remains closed.</p>
      </div>
    </div>
  );
}
