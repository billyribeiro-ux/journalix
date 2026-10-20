import { item } from '#lib/server/journal/crud.ts';
import { removeProvider } from '#lib/server/journal/providers.ts';

export const { DELETE } = item(removeProvider);
