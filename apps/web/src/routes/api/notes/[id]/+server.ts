import { item } from '#lib/server/journal/crud.ts';
import { removeNote } from '#lib/server/journal/store.ts';

export const { DELETE } = item(removeNote);
