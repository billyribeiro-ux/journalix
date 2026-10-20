import { ProviderConfigInputSchema } from '@journalix/core';
import { collection } from '#lib/server/journal/crud.ts';
import { listProviders, saveProvider } from '#lib/server/journal/providers.ts';

export const { GET, POST } = collection(ProviderConfigInputSchema, listProviders, saveProvider);
