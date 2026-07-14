// Route-activity helper shared by navigation UI. The root path only matches
// exactly; every other path is active for itself and its sub-routes.
export function isRoutePathActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isExactRoutePath(pathname: string, href: string): boolean {
  return pathname === href;
}
