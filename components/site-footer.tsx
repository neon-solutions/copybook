import Link from "next/link";

import { githubUrl } from "@/lib/shared";

const linkClassName =
  "text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

export const SiteFooter = () => (
  <footer>
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-center sm:flex-row sm:px-6 sm:text-left">
      <p className="text-muted-foreground text-sm">
        Made by{" "}
        <a
          className="underline underline-offset-4"
          href="https://neon.com"
          rel="noopener noreferrer"
          target="_blank"
        >
          Neon
        </a>
      </p>
      <nav aria-label="Secondary" className="flex items-center gap-4 text-sm">
        <Link className={linkClassName} href="/docs">
          Docs
        </Link>
        <a
          className={linkClassName}
          href={githubUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          GitHub
        </a>
      </nav>
    </div>
  </footer>
);
