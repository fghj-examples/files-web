import { UserManager, WebStorageStateStore } from "oidc-client-ts";

let manager: Promise<UserManager> | null = null;

// The issuer and client id come from files-api, so the Descope project is
// configured in one place. Everything else is derived from where we're
// served — which fghj decides, not this code.
export function userManager(): Promise<UserManager> {
  manager ??= fetch("/api/config")
    .then((res) => res.json() as Promise<{ issuer: string; clientId: string }>)
    .then(
      ({ issuer, clientId }) =>
        new UserManager({
          authority: issuer,
          client_id: clientId,
          redirect_uri: `${location.origin}/callback`,
          post_logout_redirect_uri: location.origin,
          response_type: "code",
          scope: "openid profile email",
          userStore: new WebStorageStateStore({ store: localStorage }),
        }),
    );
  return manager;
}
