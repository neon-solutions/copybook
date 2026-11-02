import { cliCatalog, POLICY_LABELS, sentence } from "@/lib/catalog";

/** Every CLI command, as a Studio panel, from the CLI's own catalog. */
export const CliView = () => (
  <>
    <header className="flex flex-col gap-2">
      <p className="eyebrow">Project</p>
      <h3 className="text-foreground text-lg font-semibold">CLI</h3>
      <p className="text-body text-muted-foreground">
        Start with <code className="font-mono">copybook status --json</code>:
        its <code className="font-mono">next</code> field lists what to do.
        Every command except <code className="font-mono">report</code> takes{" "}
        <code className="font-mono">--json</code>, and exits with 0 when
        everything is fine, 1 when it found problems, and 2 when it can&apos;t
        run.
      </p>
    </header>
    <section className="flex flex-col gap-3">
      <h4 className="eyebrow">
        {cliCatalog.commands.length} commands in {cliCatalog.version}
      </h4>
      <ul className="divide-border border-border divide-y rounded-md border">
        {cliCatalog.commands.map((command) => (
          <li className="flex flex-col gap-1 px-3 py-2.5" key={command.name}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <code className="text-foreground font-mono text-xs">
                {command.usage}
              </code>
              <span className="text-muted-foreground text-xs">
                {POLICY_LABELS[command.agent]}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              {sentence(command.summary)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  </>
);
