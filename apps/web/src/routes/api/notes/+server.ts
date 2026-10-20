import { NoteSchema } from '@strikebook/core';
import { collection } from '#lib/server/journal/crud.ts';
import { listNotes, saveNote } from '#lib/server/journal/store.ts';

export const { GET, POST } = collection(NoteSchema, listNotes, saveNote);
