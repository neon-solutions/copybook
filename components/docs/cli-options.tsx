import type { CatalogOption } from "@copybook/cli";
import { Fragment } from "react";

import { findCommand, optionParts } from "@/lib/catalog";

const Description = ({ option }: { option: CatalogOption }) => {
  const { description, fallback, values } = optionParts(option);
  return (
    <>
      {description}
      {values ? (
        <>
          {" One of "}
          {values.map((value, index) => (
            <Fragment key={value}>
              {index > 0 ? ", " : ""}
              <code>{value}</code>
            </Fragment>
          ))}
          .
        </>
      ) : null}
      {fallback === undefined ? null : (
        <>
          {" Defaults to "}
          <code>{fallback}</code>.
        </>
      )}
    </>
  );
};

/** A command's flags, generated from the CLI, so the docs can't drift. */
export const CliOptions = ({ command }: { command: string }) => {
  const entry = findCommand(command);
  if (!entry) {
    throw new Error(
      `No CLI command "${command}" in @copybook/cli/catalog.json.`
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Flag</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {entry.options.map((option) => (
          <tr key={option.flags}>
            <td>
              <code>{option.flags}</code>
            </td>
            <td>
              <Description option={option} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
