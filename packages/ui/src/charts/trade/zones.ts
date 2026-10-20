/**
 * Series primitive that shades the planned risk (entry → stop) and reward (entry → target)
 * zones across the life of a trade, like a broker's position tool.
 */
import type {
	IPrimitivePaneRenderer,
	IPrimitivePaneView,
	ISeriesApi,
	ISeriesPrimitive,
	SeriesAttachedParameter,
	SeriesType,
	Time,
	IChartApiBase,
	PrimitivePaneViewZOrder
} from 'lightweight-charts';

/** Canvas target type, taken from the library's own renderer signature. */
type RenderTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];

export interface Zone {
	readonly from: Time;
	readonly to: Time;
	readonly top: number;
	readonly bottom: number;
	readonly fill: string;
	readonly stroke: string;
}

class ZonesRenderer implements IPrimitivePaneRenderer {
	constructor(
		private readonly rects: readonly {
			x1: number;
			x2: number;
			y1: number;
			y2: number;
			fill: string;
			stroke: string;
		}[]
	) {}

	draw(): void {
		// Everything is drawn in the background pass so candles stay on top.
	}

	drawBackground(target: RenderTarget): void {
		target.useMediaCoordinateSpace(({ context }) => {
			for (const r of this.rects) {
				const x = Math.min(r.x1, r.x2);
				const y = Math.min(r.y1, r.y2);
				const w = Math.max(1, Math.abs(r.x2 - r.x1));
				const h = Math.max(1, Math.abs(r.y2 - r.y1));
				context.fillStyle = r.fill;
				context.fillRect(x, y, w, h);
				context.strokeStyle = r.stroke;
				context.lineWidth = 1;
				context.strokeRect(
					Math.round(x) + 0.5,
					Math.round(y) + 0.5,
					Math.round(w) - 1,
					Math.round(h) - 1
				);
			}
		});
	}
}

class ZonesView implements IPrimitivePaneView {
	constructor(private readonly source: ZonesPrimitive) {}

	zOrder(): PrimitivePaneViewZOrder {
		return 'bottom';
	}

	renderer(): IPrimitivePaneRenderer | null {
		const chart = this.source.chart;
		const series = this.source.series;
		if (!chart || !series) return null;
		const scale = chart.timeScale();
		const rects = [];
		for (const z of this.source.zones) {
			const x1 = scale.timeToCoordinate(z.from);
			const x2 = scale.timeToCoordinate(z.to);
			const y1 = series.priceToCoordinate(z.top);
			const y2 = series.priceToCoordinate(z.bottom);
			if (x1 === null || x2 === null || y1 === null || y2 === null) continue;
			rects.push({ x1, x2, y1, y2, fill: z.fill, stroke: z.stroke });
		}
		return new ZonesRenderer(rects);
	}
}

export class ZonesPrimitive implements ISeriesPrimitive<Time> {
	zones: readonly Zone[] = [];
	chart: IChartApiBase<Time> | null = null;
	series: ISeriesApi<SeriesType, Time> | null = null;
	#requestUpdate: (() => void) | null = null;
	readonly #views: readonly IPrimitivePaneView[] = [new ZonesView(this)];

	attached(param: SeriesAttachedParameter<Time>): void {
		this.chart = param.chart;
		this.series = param.series;
		this.#requestUpdate = param.requestUpdate;
	}

	detached(): void {
		this.chart = null;
		this.series = null;
		this.#requestUpdate = null;
	}

	paneViews(): readonly IPrimitivePaneView[] {
		return this.#views;
	}

	setZones(zones: readonly Zone[]): void {
		this.zones = zones;
		this.#requestUpdate?.();
	}
}
