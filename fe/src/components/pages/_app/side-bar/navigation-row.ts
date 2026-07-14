// Row class recipe copied from Naab's button base + `md` size with the
// sidebar overrides (`w-full justify-start rounded-lg overflow-hidden`);
// ghost/secondary variants match Naab's buttonVariants on Diwan's tokens.
export const NAVIGATION_ROW_CLASS_NAME =
  'full-center group relative flex h-10 w-full cursor-pointer justify-start gap-x-2 overflow-hidden rounded-lg border border-transparent text-sm font-medium outline-none transition-[background-color,border-color,color,box-shadow,opacity] duration-100';

export const NAVIGATION_ROW_GHOST_CLASS_NAME =
  'hover:text-secondary-foreground hover:bg-secondary active:bg-secondary-active focus-visible:bg-secondary';

export const NAVIGATION_ROW_ACTIVE_CLASS_NAME =
  'text-secondary-foreground bg-secondary border-secondary hover:bg-secondary-hover active:bg-secondary-active';
