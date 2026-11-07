import { Link } from "@tanstack/react-router";

export default function Header() {
	return (
		<header className="sidebar-header">
			<div className="sidebar-header-inner">
				<Link className="sidebar-brand" to="/">
					<svg
						width="43"
						height="36"
						viewBox="0 0 43 36"
						fill="none"
						aria-hidden="true"
					>
						<path
							d="M2 3H19V15H31V22H19V34H2M19 9H31V28H19M31 18H41"
							stroke="currentColor"
							strokeWidth="1.6"
						/>
						<circle cx="10" cy="9" r="2" stroke="currentColor" />
						<circle cx="10" cy="28" r="2" stroke="currentColor" />
						<path d="M34 18H41" stroke="#c4fb5c" strokeWidth="2" />
					</svg>
					<span>bracket.</span>
				</Link>
				<span className="sidebar-brand-description">Tournament simulator</span>
			</div>
		</header>
	);
}
