"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/Button";

type ChildNavItem = {
    id: string;
    name: string;
};

export function TopNav() {
    const pathname = usePathname();
    const isBoardRoute = pathname?.startsWith("/board");
    const [childrenList, setChildrenList] = useState<ChildNavItem[]>([]);
    const [isParentAuthenticated, setIsParentAuthenticated] = useState(false);

    useEffect(() => {
        let mounted = true;

        async function loadChildren() {
            try {
                const [authRes, childrenRes] = await Promise.all([
                    fetch("/api/auth/me"),
                    fetch("/api/children"),
                ]);

                if (!mounted) return;
                setIsParentAuthenticated(authRes.ok);

                if (!childrenRes.ok) return;
                const data = await childrenRes.json();
                const items = (data.children || []).map((child: { id: string; name: string }) => ({
                    id: child.id,
                    name: child.name,
                }));
                setChildrenList(items);
            } catch {
                // Ignore nav child fetch failures (e.g. unauthenticated users)
            }
        }

        loadChildren();
        return () => {
            mounted = false;
        };
    }, []);

    if (isBoardRoute) {
        return null;
    }

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } finally {
            window.location.href = "/";
        }
    };

    return (
        <header className="sticky top-0 z-50 border-b border-sky-100/70 bg-white/90 backdrop-blur-md dark:bg-slate-950/90">
            <nav className="container mx-auto flex h-14 items-center justify-between px-4">
                <Link href="/" className="inline-flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                        <Rocket className="h-4 w-4" />
                    </div>
                    <span className="text-base font-extrabold tracking-tight text-slate-800 dark:text-slate-100">FutureReady</span>
                </Link>

                <div className="flex items-center gap-5 text-sm font-semibold">
                    <Link href="/" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-200">Home</Link>
                    <Link href="/parent" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-200">Parent</Link>
                    <Link href="/board" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-200">Board</Link>

                    <div className="relative group">
                        <Link href="/kid" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-200">Kid</Link>

                        <div className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border bg-white p-2 opacity-0 shadow-xl transition-all group-hover:pointer-events-auto group-hover:opacity-100 dark:bg-slate-900">
                            {childrenList.length > 0 ? (
                                <div className="space-y-1">
                                    <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">Select Child</p>
                                    {childrenList.map((child) => (
                                        <Link
                                            key={child.id}
                                            href={`/kid?childId=${child.id}`}
                                            className="block rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            {child.name}
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <p className="px-2 py-1 text-xs text-muted-foreground">No child profiles found.</p>
                                    <Link
                                        href="/kid/login"
                                        className="block rounded-lg px-2 py-2 text-sm font-medium text-primary hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        Open Kid Login
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {isParentAuthenticated ? (
                        <Button variant="outline" size="sm" className="h-8 rounded-full px-3" onClick={handleLogout}>
                            Logout
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link href="/login" className="text-slate-700 transition-colors hover:text-primary dark:text-slate-200">Login</Link>
                            <Button asChild size="sm" className="h-8 rounded-full px-3 text-xs">
                                <Link href="/signup">Sign Up</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </nav>
        </header>
    );
}
