import { item } from '#lib/server/journal/crud.ts';
import { removePlaybook } from '#lib/server/journal/store.ts';

export const { DELETE } = item(removePlaybook);
