import type {
  PublicUser,
  SignupInput,
  LoginInput,
  Project,
  ProjectCreateInput,
  SecretResponse,
  SecretCreateInput,
  AuditLogEntry,
} from '@raaz/shared-schemas';

declare module '@tanstack/react-query' {
  interface Register {
    mutationKey: unknown[];
    mutationFn: (variables: unknown) => Promise<unknown>;
  }
}

declare global {
  namespace ReactRouter {
    interface AppRouteObject {
      path?: string;
      index?: boolean;
      children?: AppRouteObject[];
      element?: React.ReactNode;
      loader?: () => Promise<unknown>;
      action?: () => Promise<unknown>;
    }
  }
}

export type {
  PublicUser,
  SignupInput,
  LoginInput,
  Project,
  ProjectCreateInput,
  SecretResponse,
  SecretCreateInput,
  AuditLogEntry,
};

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface SecretWithMask extends SecretResponse {
  value: string;
}

export interface RevealSecretResponse {
  value: string;
}
