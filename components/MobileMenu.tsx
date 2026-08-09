"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

type NavLink = { label: string; href: string };

// Menu hambúrguer da landing (só no celular). Links de âncora (#) usam <a>
// para rolar na própria página; rotas usam <Link>.
export default function MobileMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  function renderLink(l: NavLink) {
    const cls =
      "rounded-xl px-3 py-3 text-lg font-semibold text-white transition hover:bg-white/5";
    if (l.href.startsWith("#")) {
      return (
        <a key={l.href} href={l.href} onClick={() => setOpen(false)} className={cls}>
          {l.label}
        </a>
      );
    }
    return (
      <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={cls}>
        {l.label}
      </Link>
    );
  }

  return (
    <div className="lg:hidden">
      <button
        aria-label="Abrir menu"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Menu
            </span>
            <button
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex flex-col gap-1 px-4 pt-2">
            {links.map(renderLink)}

            <div className="mt-6 flex flex-col gap-3 px-3">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/20 px-6 py-3.5 text-center text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-white/5"
              >
                Entrar
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-full bg-brand-500 px-6 py-3.5 text-center text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-brand-400"
              >
                Criar conta
              </Link>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
