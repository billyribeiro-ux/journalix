import { AccountSchema } from '@strikebook/core';
import { collection } from '#lib/server/journal/crud.ts';
import { listAccounts, saveAccount } from '#lib/server/journal/store.ts';

export const { GET, POST } = collection(AccountSchema, listAccounts, saveAccount);
