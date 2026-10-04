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
