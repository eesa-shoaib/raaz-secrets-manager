var permissionMatrix = {
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
function getBasePermission(role, action) {
  var _a, _b;
  return (_b = (_a = permissionMatrix[role]) === null || _a === void 0 ? void 0 : _a[action]) !==
    null && _b !== void 0
    ? _b
    : 'hidden';
}
export function can(role, action, environment) {
  if (!role) return 'hidden';
  var basePermission = getBasePermission(role, action);
  if (role === 'developer') {
    if (action === 'secrets.create' || action === 'secrets.edit') {
      return environment === 'development' ? 'enabled' : 'disabled';
    }
  }
  return basePermission;
}
export function getRolePermissions(role, environment) {
  var actions = [
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
  var result = {};
  for (var _i = 0, actions_1 = actions; _i < actions_1.length; _i++) {
    var action = actions_1[_i];
    result[action] = can(role, action, environment);
  }
  return result;
}
export function canAccessProject(role) {
  return role !== null;
}
export function isProjectAdmin(role) {
  return role === 'projectAdmin';
}
export function canManageMembers(role) {
  return role === 'projectAdmin';
}
export function canViewAuditLog(role) {
  return role !== null;
}
export var PERMISSION_ACTIONS = [
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
