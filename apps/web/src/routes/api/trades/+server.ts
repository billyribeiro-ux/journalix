import { TradeSchema } from '@journalix/core';
import { collection } from '#lib/server/journal/crud.ts';
import { listTrades, saveTrade } from '#lib/server/journal/store.ts';

export const { GET, POST } = collection(TradeSchema, listTrades, saveTrade);
