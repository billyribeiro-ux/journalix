import { TagSchema } from '@strikebook/core';
import { collection } from '#lib/server/journal/crud.ts';
import { listTags, saveTag } from '#lib/server/journal/store.ts';

export const { GET, POST } = collection(TagSchema, listTags, saveTag);
