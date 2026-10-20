import type { AppEnv, SaveFileRequest } from './routes.ts';

/** Saves through the host when it provides a native dialog, else triggers a browser download. */
export async function saveFile(env: AppEnv, file: SaveFileRequest): Promise<boolean> {
	if (env.saveFile) return env.saveFile(file);
	const url = URL.createObjectURL(new Blob([file.contents], { type: file.mime }));
	try {
		const a = document.createElement('a');
		a.href = url;
		a.download = file.name;
		a.rel = 'noopener';
		document.body.append(a);
		a.click();
		a.remove();
	} finally {
		// Revoke on the next task so the download has started in every engine.
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}
	return true;
}
