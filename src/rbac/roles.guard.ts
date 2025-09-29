// src/rbac/roles.guard.ts

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './roles.enum';
import { ROLES_KEY } from './roles.decorator';
import { User } from 'src/user/entities/user.entity';

// Defines the hierarchy of roles.
// A Manager has all the permissions of an Agent.
// An Admin has all the permissions of a Manager (and by extension, an Agent).
const roleHierarchy: Map<Role, Role[]> = new Map([
  [Role.ADMIN, [Role.MANAGER, Role.AGENT]],
  [Role.MANAGER, [Role.AGENT]],
]);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user }: { user: User } = context.switchToHttp().getRequest();

    // Expand the user's roles based on the hierarchy.
    const userRoles = new Set<Role>(user.roles);
    user.roles.forEach((role) => {
      const inheritedRoles = roleHierarchy.get(role);
      if (inheritedRoles) {
        inheritedRoles.forEach((inheritedRole) => userRoles.add(inheritedRole));
      }
    });

    // Check if the expanded set of roles includes any of the required roles.
    return requiredRoles.some((role) => userRoles.has(role));
  }
}
