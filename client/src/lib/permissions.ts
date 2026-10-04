export type Permission = 'enabled' | 'disabled' | 'hidden';
export type Role = 'projectAdmin' | 'developer' | 'auditor' | null;
export type Environment = 'development' | 'staging' | 'production';

export type Action =
  | 'secrets.list'
  | 'secrets.create'
  | 'secrets.reveal'
  | 'secrets.edit'
  | 'secrets.delete'
  | 'members.list'
  | 'members.add'
  | 'members.change-role'
  | 'members.remove'
  | 'audit.list';

const permissionMatrix: Record<Exclude<Role, null>, Record<Action, Permission>> = {
  projectAdmin: {
    'secrets.list': 'enabled',
    'secrets.create': 'enabled',
    'secrets.reveal': 'enabled',
    'secrets.edit': 'enabled',
    'secrets.delete': 'enabled',
    'members.list': 'enabled',
    'members.add': 'enabled',
    'members.change-role': 'enabled',
    'members.remove': 'enabled',
    'audit.list': 'enabled',
  },
  developer: {
    'secrets.list': 'enabled',
    'secrets.create': 'disabled',
    'secrets.reveal': 'enabled',
    'secrets.edit': 'disabled',
    'secrets.delete': 'hidden',
    'members.list': 'enabled',
    'members.add': 'hidden',
    'members.change-role': 'hidden',
    'members.remove': 'hidden',
    'audit.list': 'enabled',
  },
  auditor: {
    'secrets.list': 'enabled',
    'secrets.create': 'hidden',
    'secrets.reveal': 'hidden',
    'secrets.edit': 'hidden',
    'secrets.delete': 'hidden',
    'members.list': 'enabled',
    'members.add': 'hidden',
    'members.change-role': 'hidden',
    'members.remove': 'hidden',
    'audit.list': 'enabled',
  },
};

function getBasePermission(role: Exclude<Role, null>, action: Action): Permission {
  return permissionMatrix[role]?.[action] ?? 'hidden';
}

export function can(role: Role, action: Action, environment?: Environment): Permission {
  if (!role) return 'hidden';

  const basePermission = getBasePermission(role, action);

  if (role === 'developer') {
    if (action === 'secrets.create' || action === 'secrets.edit') {
      return environment === 'development' ? 'enabled' : 'disabled';
    }
  }

  return basePermission;
}

export function getRolePermissions(role: Role, environment?: Environment): Record<Action, Permission> {
  const actions: Action[] = [
    'secrets.list',
    'secrets.create',
    'secrets.reveal',
    'secrets.edit',
    'secrets.delete',
    'members.list',
    'members.add',
    'members.change-role',
    'members.remove',
    'audit.list',
  ];

  const result: Record<Action, Permission> = {} as Record<Action, Permission>;

  for (const action of actions) {
    result[action] = can(role, action, environment);
  }

  return result;
}

export function canAccessProject(role: Role): boolean {
  return role !== null;
}

export function isProjectAdmin(role: Role): boolean {
  return role === 'projectAdmin';
}

export function canManageMembers(role: Role): boolean {
  return role === 'projectAdmin';
}

export function canViewAuditLog(role: Role): boolean {
  return role !== null;
}

export const PERMISSION_ACTIONS: { value: Action; label: string; category: string }[] = [
  { value: 'secrets.list', label: 'List secrets', category: 'Secrets' },
  { value: 'secrets.create', label: 'Create secrets', category: 'Secrets' },
  { value: 'secrets.reveal', label: 'Reveal secrets', category: 'Secrets' },
  { value: 'secrets.edit', label: 'Edit secrets', category: 'Secrets' },
  { value: 'secrets.delete', label: 'Delete secrets', category: 'Secrets' },
  { value: 'members.list', label: 'List members', category: 'Members' },
  { value: 'members.add', label: 'Add members', category: 'Members' },
  { value: 'members.change-role', label: 'Change member role', category: 'Members' },
  { value: 'members.remove', label: 'Remove members', category: 'Members' },
  { value: 'audit.list', label: 'View audit log', category: 'Audit' },
];