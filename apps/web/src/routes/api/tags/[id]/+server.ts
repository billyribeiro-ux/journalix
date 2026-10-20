import { item } from '#lib/server/journal/crud.ts';
import { removeTag } from '#lib/server/journal/store.ts';

export const { DELETE } = item(removeTag);
