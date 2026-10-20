import { PlaybookSchema } from '@strikebook/core';
import { collection } from '#lib/server/journal/crud.ts';
import { listPlaybooks, savePlaybook } from '#lib/server/journal/store.ts';

export const { GET, POST } = collection(PlaybookSchema, listPlaybooks, savePlaybook);
