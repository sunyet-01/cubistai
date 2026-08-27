/**
 * One-off helper: generates an SQL script that initializes roles,
 * permissions and a super_admin user on a D1 database.
 *
 * Usage:
 *   pnpm tsx scripts/gen-rbac-sql.ts --admin-email=admin@cubistai.org --admin-password=xxx
 *   wrangler d1 execute cubistai-db --remote --file=rbac-init.sql
 */
import { writeFileSync } from 'node:fs';
import { hashPassword } from 'better-auth/crypto';
import { v4 as uuidv4 } from 'uuid';

const defaultPermissions = [
  { code: 'admin.access', resource: 'admin', action: 'access', title: 'Admin Access', description: 'Access to admin area' },
  { code: 'admin.users.read', resource: 'users', action: 'read', title: 'Read Users', description: 'View user list and details' },
  { code: 'admin.users.write', resource: 'users', action: 'write', title: 'Write Users', description: 'Create and update users' },
  { code: 'admin.users.delete', resource: 'users', action: 'delete', title: 'Delete Users', description: 'Delete users' },
  { code: 'admin.posts.read', resource: 'posts', action: 'read', title: 'Read Posts', description: 'View post list and details' },
  { code: 'admin.posts.write', resource: 'posts', action: 'write', title: 'Write Posts', description: 'Create and update posts' },
  { code: 'admin.posts.delete', resource: 'posts', action: 'delete', title: 'Delete Posts', description: 'Delete posts' },
  { code: 'admin.categories.read', resource: 'categories', action: 'read', title: 'Read Categories', description: 'View category list and details' },
  { code: 'admin.categories.write', resource: 'categories', action: 'write', title: 'Write Categories', description: 'Create and update categories' },
  { code: 'admin.categories.delete', resource: 'categories', action: 'delete', title: 'Delete Categories', description: 'Delete categories' },
  { code: 'admin.payments.read', resource: 'payments', action: 'read', title: 'Read Payments', description: 'View payment list and details' },
  { code: 'admin.subscriptions.read', resource: 'subscriptions', action: 'read', title: 'Read Subscriptions', description: 'View subscription list and details' },
  { code: 'admin.credits.read', resource: 'credits', action: 'read', title: 'Read Credits', description: 'View credit list and details' },
  { code: 'admin.credits.write', resource: 'credits', action: 'write', title: 'Write Credits', description: 'Grant or consume credits' },
  { code: 'admin.apikeys.read', resource: 'apikeys', action: 'read', title: 'Read API Keys', description: 'View API key list and details' },
  { code: 'admin.apikeys.write', resource: 'apikeys', action: 'write', title: 'Write API Keys', description: 'Create and update API keys' },
  { code: 'admin.apikeys.delete', resource: 'apikeys', action: 'delete', title: 'Delete API Keys', description: 'Delete API keys' },
  { code: 'admin.settings.read', resource: 'settings', action: 'read', title: 'Read Settings', description: 'View system settings' },
  { code: 'admin.settings.write', resource: 'settings', action: 'write', title: 'Write Settings', description: 'Update system settings' },
  { code: 'admin.roles.read', resource: 'roles', action: 'read', title: 'Read Roles', description: 'View roles and permissions' },
  { code: 'admin.roles.write', resource: 'roles', action: 'write', title: 'Write Roles', description: 'Create and update roles' },
  { code: 'admin.roles.delete', resource: 'roles', action: 'delete', title: 'Delete Roles', description: 'Delete roles' },
  { code: 'admin.permissions.read', resource: 'permissions', action: 'read', title: 'Read Permissions', description: 'View permission list and details' },
  { code: 'admin.permissions.write', resource: 'permissions', action: 'write', title: 'Write Permissions', description: 'Create and update permissions' },
  { code: 'admin.permissions.delete', resource: 'permissions', action: 'delete', title: 'Delete Permissions', description: 'Delete permissions' },
  { code: 'admin.ai-tasks.read', resource: 'ai-tasks', action: 'read', title: 'Read AI Tasks', description: 'View AI task list and details' },
  { code: 'admin.ai-tasks.write', resource: 'ai-tasks', action: 'write', title: 'Write AI Tasks', description: 'Create and update AI tasks' },
  { code: 'admin.ai-tasks.delete', resource: 'ai-tasks', action: 'delete', title: 'Delete AI Tasks', description: 'Delete AI tasks' },
  { code: '*', resource: 'all', action: 'all', title: 'Super Admin', description: 'All permissions (super admin only)' },
];

const defaultRoles = [
  { name: 'super_admin', title: 'Super Admin', description: 'Full system access with all permissions', sort: 1, permissions: ['*'] },
  { name: 'admin', title: 'Admin', description: 'Administrator with most permissions', sort: 2, permissions: ['admin.access', 'admin.users.*', 'admin.posts.*', 'admin.categories.*', 'admin.payments.*', 'admin.subscriptions.*', 'admin.credits.*', 'admin.apikeys.*', 'admin.settings.read', 'admin.ai-tasks.*'] },
  { name: 'editor', title: 'Editor', description: 'Content editor with limited permissions', sort: 3, permissions: ['admin.access', 'admin.posts.read', 'admin.posts.write', 'admin.categories.read', 'admin.categories.write'] },
  { name: 'viewer', title: 'Viewer', description: 'Read-only access to admin area', sort: 4, permissions: ['admin.access', 'admin.users.read', 'admin.posts.read', 'admin.categories.read', 'admin.payments.read', 'admin.subscriptions.read', 'admin.credits.read'] },
];

const esc = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith('--admin-email='));
  const passArg = args.find((a) => a.startsWith('--admin-password='));
  const adminEmail = emailArg?.split('=')[1];
  const adminPassword = passArg?.split('=')[1];
  if (!adminEmail || !adminPassword) {
    console.error('Usage: tsx scripts/gen-rbac-sql.ts --admin-email=x --admin-password=y');
    process.exit(1);
  }

  const lines: string[] = [];
  lines.push('-- CubistAI RBAC init (generated)');

  // 1. Permissions
  const permIds: Record<string, string> = {};
  for (const p of defaultPermissions) {
    const id = uuidv4();
    permIds[p.code] = id;
    lines.push(
      `INSERT INTO permission (id, code, resource, action, title, description) VALUES (${esc(id)}, ${esc(p.code)}, ${esc(p.resource)}, ${esc(p.action)}, ${esc(p.title)}, ${esc(p.description)});`
    );
  }

  // 2. Roles + role_permission
  const roleIds: Record<string, string> = {};
  for (const r of defaultRoles) {
    const roleId = uuidv4();
    roleIds[r.name] = roleId;
    lines.push(
      `INSERT INTO role (id, name, title, description, status, sort) VALUES (${esc(roleId)}, ${esc(r.name)}, ${esc(r.title)}, ${esc(r.description)}, 'active', ${r.sort});`
    );
    for (const permCode of r.permissions) {
      let permIdsToLink: string[] = [];
      if (permCode.endsWith('.*')) {
        const prefix = permCode.slice(0, -2);
        permIdsToLink = Object.entries(permIds)
          .filter(([code]) => code.startsWith(prefix + '.'))
          .map(([, id]) => id);
      } else {
        if (permIds[permCode]) permIdsToLink = [permIds[permCode]];
      }
      for (const pid of permIdsToLink) {
        lines.push(
          `INSERT INTO role_permission (id, role_id, permission_id) VALUES (${esc(uuidv4())}, ${esc(roleId)}, ${esc(pid)});`
        );
      }
    }
  }

  // 3. Admin user + account + user_role
  const userId = uuidv4();
  const hashed = await hashPassword(adminPassword);
  const now = Date.now();
  lines.push(
    `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES (${esc(userId)}, 'Admin', ${esc(adminEmail)}, 1, ${now}, ${now});`
  );
  lines.push(
    `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (${esc(uuidv4())}, ${esc(userId)}, 'credential', ${esc(userId)}, ${esc(hashed)}, ${now}, ${now});`
  );
  lines.push(
    `INSERT INTO user_role (id, user_id, role_id) VALUES (${esc(uuidv4())}, ${esc(userId)}, ${esc(roleIds['super_admin'])});`
  );

  const sql = lines.join('\n');
  writeFileSync('rbac-init.sql', sql);
  console.log(`Wrote rbac-init.sql (${lines.length} statements) — admin: ${adminEmail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
