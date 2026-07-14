/** Two-letter language Google Identity Services accepts for its UI locale. */
export function getGoogleLocale(appLocale: string): string {
  return appLocale ? appLocale.split(/[-_]/)[0]!.toLowerCase() : 'en';
}
