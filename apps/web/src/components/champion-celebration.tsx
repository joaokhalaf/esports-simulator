import type { Team } from "@esports-simulator/api/worlds/model";
import { Trophy } from "lucide-react";
import { type CSSProperties, useState } from "react";

const colors = ["#c69b42", "#e8cc7c", "#144e42", "#5b9882", "#f1dfac"];
const confetti = Array.from({ length: 48 }, (_, index) => ({
	id: index,
	style: {
		"--x": `${(index * 37 + 5) % 100}%`,
		"--drift": `${((index * 29) % 160) - 80}px`,
		"--delay": `${(index % 12) * 0.09}s`,
		"--duration": `${2.6 + (index % 7) * 0.18}s`,
		"--turn": `${index % 2 ? 720 : -540}deg`,
		backgroundColor: colors[index % colors.length],
		borderRadius: index % 3 === 0 ? "50%" : "1px",
	} as CSSProperties,
}));

export function ChampionCelebration({ team }: { team: Team }) {
	const [imageFailed, setImageFailed] = useState(false);
	return (
		<section
			className="champion-celebration"
			aria-label={`Campeão: ${team.name}`}
		>
			<div className="champion-confetti" aria-hidden="true">
				{confetti.map((piece) => (
					<i key={piece.id} style={piece.style} />
				))}
			</div>
			<div className="champion-emblem" aria-hidden="true">
				<span className="champion-halo" />
				{team.image && !imageFailed ? (
					<img
						className={
							["G2", "DK", "TSW"].includes(team.code)
								? "champion-logo-monochrome"
								: undefined
						}
						src={team.image}
						alt=""
						onError={() => setImageFailed(true)}
					/>
				) : (
					<strong>{team.code}</strong>
				)}
			</div>
			<div className="champion-title" role="status">
				<span className="champion-eyebrow">
					<Trophy size={16} /> Seu campeão do Worlds 2026
				</span>
				<h2>{team.name}</h2>
				<p>O topo do mundo tem dono.</p>
			</div>
		</section>
	);
}
