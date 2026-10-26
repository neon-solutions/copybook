import { writeError } from "./output";
import { createProgram } from "./program";

try {
  await createProgram().parseAsync(process.argv);
} catch (error) {
  writeError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
