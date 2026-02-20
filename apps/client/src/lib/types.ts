export type MCPAuthType = "none" | "bearer" | "oauth";

export type MCPOAuthConfig = {
  clientId?: string;
  clientSecret?: string;
};

export type MCPServerConfig = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  authType: MCPAuthType;
  apiKey?: string;
  oauthConfig?: MCPOAuthConfig;
};

export type MCPServerFormValues = {
  name: string;
  url: string;
  authType: MCPAuthType;
  apiKey?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
};
