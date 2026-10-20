import { item } from '#lib/server/journal/crud.ts';
import { removeAccount } from '#lib/server/journal/store.ts';

export const { DELETE } = item(removeAccount);
