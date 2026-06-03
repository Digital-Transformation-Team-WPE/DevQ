import { useAuth } from '../contexts/AuthContext';
import {
  canAccess  as _canAccess,
  canCreate  as _canCreate,
  canEdit    as _canEdit,
  canDelete  as _canDelete,
  roleDept, isOwnOnly, roleLabel, roleColor,
} from '../utils/permissions';

/**
 * Returns permission helpers scoped to the currently logged-in user.
 *
 * const perm = usePermissions();
 * perm.canCreate('issues')         → bool
 * perm.canEdit('issues', row)      → bool  (ownOnly check built-in)
 * perm.canDelete('projects', row)  → bool
 * perm.canAccess('dmrs')           → bool  (used by RoleRoute)
 * perm.role                        → string
 * perm.dept                        → 'AVP' | 'WGDE' | null
 * perm.ownOnly                     → bool
 */
export default function usePermissions() {
  const { user } = useAuth();
  const role   = user?.role   ?? 'Viewer';
  const userId = user?.userId ?? user?.email ?? '';

  return {
    role,
    userId,
    dept:      roleDept(role),
    ownOnly:   isOwnOnly(role),
    roleLabel: roleLabel(role),
    roleColor: roleColor(role),
    isAdmin:   role === 'Admin',

    canAccess:  module         => _canAccess(role, module),
    canCreate:  module         => _canCreate(role, module),
    canEdit:   (module, record) => _canEdit(role, module, record, userId),
    canDelete: (module, record) => _canDelete(role, module, record, userId),
  };
}
