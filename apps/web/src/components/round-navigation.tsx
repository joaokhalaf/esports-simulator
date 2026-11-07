import { useLayoutEffect, useRef, useState } from "react";

export type RoundTab = { id: string; label: string; count?: string };
export function useRoundNavigation(preferred: string, minimumWidth: number) {
	const ref = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);
	const [choice, setChoice] = useState<string | null>(null);
	const previousPreferred = useRef(preferred);
	useLayoutEffect(() => {
		if (previousPreferred.current === preferred) return;
		previousPreferred.current = preferred;
		setChoice(preferred);
	}, [preferred]);
	useLayoutEffect(() => {
		const node = ref.current;
		if (!node) return;
		const measure = () => setWidth(node.clientWidth);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);
	return {
		ref,
		active: choice ?? (width >= minimumWidth ? "all" : preferred),
		select: setChoice,
	};
}

export function RoundNavigation({
	id,
	items,
	active,
	onChange,
	label,
}: {
	id: string;
	items: RoundTab[];
	active: string;
	onChange: (value: string) => void;
	label: string;
}) {
	return (
		<div
			className="round-tabs"
			role="tablist"
			aria-label={label}
			onKeyDown={(event) => {
				if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
					return;
				const buttons = [
					...event.currentTarget.querySelectorAll<HTMLButtonElement>(
						'[role="tab"]',
					),
				];
				const current = buttons.indexOf(
					document.activeElement as HTMLButtonElement,
				);
				if (current < 0) return;
				event.preventDefault();
				const next =
					event.key === "Home"
						? 0
						: event.key === "End"
							? buttons.length - 1
							: (current +
									(event.key === "ArrowRight" ? 1 : -1) +
									buttons.length) %
								buttons.length;
				const button = buttons[next];
				if (button?.dataset.round) {
					onChange(button.dataset.round);
					button.focus();
				}
			}}
		>
			{items.map((item) => (
				<button
					type="button"
					role="tab"
					key={item.id}
					id={`${id}-${item.id}`}
					data-round={item.id}
					aria-controls={`${id}-panel`}
					aria-selected={active === item.id}
					tabIndex={active === item.id ? 0 : -1}
					onClick={() => onChange(item.id)}
				>
					<span>{item.label}</span>
					{item.count && <small>{item.count}</small>}
				</button>
			))}
		</div>
	);
}
