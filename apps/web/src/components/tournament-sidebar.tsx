import { ChevronRight, Star, Trophy } from "lucide-react";
import { useState } from "react";
import Header from "./header";

const catalog = [
	{
		name: "Worlds",
		description: "Mundial de LoL",
		category: "Internacionais",
		image:
			"https://static.lolesports.com/leagues/1592594612171_WorldsDarkBG.png",
		available: true,
	},
	{
		name: "MSI",
		description: "Mid-Season Invitational",
		category: "Internacionais",
		image: "https://static.lolesports.com/leagues/1592594634248_MSIDarkBG.png",
		available: false,
	},
	{
		name: "First Stand",
		description: "First Stand Tournament",
		category: "Internacionais",
		image:
			"https://static.lolesports.com/leagues/1740042025201_RG_LOL_FIRST_STAND_LOGO_VOLT_ALPHA.png",
		available: false,
	},
	{
		name: "LCK",
		description: "Coreia do Sul",
		category: "Ligas regionais",
		image: "https://static.lolesports.com/leagues/lck-color-on-black.png",
		available: false,
	},
	{
		name: "LEC",
		description: "Europa",
		category: "Ligas regionais",
		image:
			"https://static.lolesports.com/leagues/1592516184297_LEC-01-FullonDark.png",
		available: false,
	},
	{
		name: "LPL",
		description: "China",
		category: "Ligas regionais",
		image:
			"https://static.lolesports.com/leagues/1592516115322_LPL-01-FullonDark.png",
		available: false,
	},
	{
		name: "CBLOL",
		description: "Brasil",
		category: "Ligas regionais",
		image:
			"https://static.lolesports.com/leagues/cblol-logo-symbol-offwhite.png",
		available: false,
	},
];

export function TournamentSidebar() {
	const [game, setGame] = useState("lol");
	const [favorite, setFavorite] = useState(() => {
		try {
			return localStorage.getItem("bracket-lab-favorite") === "worlds";
		} catch {
			return false;
		}
	});
	function toggleFavorite() {
		const next = !favorite;
		setFavorite(next);
		try {
			localStorage.setItem("bracket-lab-favorite", next ? "worlds" : "");
		} catch {
			/* Favorites remain usable for this visit. */
		}
	}
	return (
		<aside className="championship-sidebar" aria-label="Campeonatos">
			<Header />
			<h2>Explorar campeonatos</h2>
			<div className="game-tabs" role="tablist" aria-label="Jogos">
				<button
					type="button"
					role="tab"
					aria-selected={game === "lol"}
					onClick={() => setGame("lol")}
				>
					League of Legends
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={game === "valorant"}
					onClick={() => setGame("valorant")}
				>
					Valorant
				</button>
			</div>
			{game === "lol" ? (
				["Internacionais", "Ligas regionais"].map((category) => {
					const items = catalog.filter((item) => item.category === category);
					return items.length ? (
						<section className="championship-category" key={category}>
							<h3>{category}</h3>
							<div className="championship-list">
								{items.map((item) => (
									<div
										key={item.name}
										className={`championship-item ${item.available ? "selected" : "unavailable"}`}
									>
										<button
											type="button"
											disabled={!item.available}
											title={
												item.available
													? "Worlds 2026 selecionado"
													: "Disponível em uma próxima versão"
											}
											aria-current={item.available ? "true" : undefined}
										>
											<img
												src={item.image}
												alt=""
												className={
													["Worlds", "LCK", "LEC", "CBLOL"].includes(item.name)
														? "league-monochrome"
														: item.name === "MSI"
															? "league-msi"
															: undefined
												}
											/>
											<span>
												<strong>{item.name}</strong>
												<small>{item.description}</small>
											</span>
											{item.available ? (
												<ChevronRight size={18} />
											) : (
												<small className="coming-soon">Em breve</small>
											)}
										</button>
										{item.available && (
											<button
												type="button"
												className={`favorite-toggle ${favorite ? "is-favorite" : ""}`}
												aria-label={
													favorite
														? "Remover Worlds dos favoritos"
														: "Adicionar Worlds aos favoritos"
												}
												aria-pressed={favorite}
												onClick={toggleFavorite}
											>
												<Star size={15} />
											</button>
										)}
									</div>
								))}
							</div>
						</section>
					) : null;
				})
			) : (
				<div className="catalog-empty">
					<Trophy size={27} />
					<h3>Valorant chega depois</h3>
					<p>O primeiro campeonato disponível é o Worlds 2026 de LoL.</p>
				</div>
			)}
		</aside>
	);
}
