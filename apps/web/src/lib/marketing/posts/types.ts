/** A block of article content. Text is plain; the renderer never interprets HTML. */
export type PostBlock =
	| { readonly type: 'p'; readonly text: string }
	| { readonly type: 'h2'; readonly text: string; readonly id: string }
	| { readonly type: 'ul'; readonly items: readonly string[] }
	| { readonly type: 'ol'; readonly items: readonly string[] }
	| { readonly type: 'quote'; readonly text: string }
	| { readonly type: 'formula'; readonly text: string; readonly caption?: string }
	| {
			readonly type: 'table';
			readonly caption: string;
			readonly head: readonly string[];
			readonly rows: readonly (readonly string[])[];
			/** Column indexes that hold numbers and should be right-aligned. */
			readonly numeric?: readonly number[];
	  };

export interface Post {
	readonly slug: string;
	readonly title: string;
	readonly description: string;
	/** `YYYY-MM-DD` */
	readonly date: string;
	readonly readingMinutes: number;
	readonly body: readonly PostBlock[];
}
