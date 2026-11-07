import { Button } from "@esports-simulator/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@esports-simulator/ui/components/dropdown-menu";
import { Skeleton } from "@esports-simulator/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { authClient } from "@/lib/auth-client";

export default function UserMenu({ settings = false }: { settings?: boolean }) {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <Skeleton className="h-9 w-24" />;
	}

	if (!session) {
		return (
			<Link to="/login">
				<Button variant="outline">Entrar</Button>
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						aria-label={`Conta de ${session.user.name}`}
					/>
				}
			>
				{settings ? (
					<Settings size={18} />
				) : (
					session.user.name
						.split(/\s+/)
						.filter(Boolean)
						.map((part) => part[0])
						.slice(0, 2)
						.join("")
						.toUpperCase()
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent className="bg-card">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Minha conta</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem>{session.user.email}</DropdownMenuItem>
					<DropdownMenuItem
						variant="destructive"
						onClick={() => {
							authClient.signOut({
								fetchOptions: {
									onSuccess: () => {
										navigate({
											to: "/",
										});
									},
								},
							});
						}}
					>
						Sair
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
