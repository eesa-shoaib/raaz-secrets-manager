import type {
  PublicUser,
  SignupInput,
  LoginInput,
  ProjectResponse,
  CreateProjectInput,
  SecretResponse,
  CreateSecretInput,
  EditSecretInput,
  RevealSecretResponse,
  AuditLogEntryResponse,
  MemberResponse,
  AddMemberInput,
  ProjectRole,
  ProjectEnvironment,
} from '@raaz/shared-schemas';

export type {
  PublicUser,
  SignupInput,
  LoginInput,
  ProjectResponse,
  CreateProjectInput,
  SecretResponse,
  CreateSecretInput,
  EditSecretInput,
  RevealSecretResponse,
  AuditLogEntryResponse,
  MemberResponse,
  AddMemberInput,
  ProjectRole,
  ProjectEnvironment,
};

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface SecretWithMask extends SecretResponse {
  value: string;
}
