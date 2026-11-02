import { useEffect, useState } from "react";

const PREFIX = "#/";

/** The hash of the Agents view. Definitions use `#/<id>`. */
export const AGENTS_HREF = "#agents";

export type Route = { view: "agents" } | { id?: string; view: "definition" };

const read = (): Route => {
  const { hash } = window.location;
  if (hash === AGENTS_HREF) {
    return { view: "agents" };
  }
  if (!hash.startsWith(PREFIX)) {
    return { view: "definition" };
  }
  try {
    return {
      id: decodeURIComponent(hash.slice(PREFIX.length)),
      view: "definition",
    };
  } catch {
    return { view: "definition" };
  }
};

/** The selected view or definition, kept in the URL hash so links work. */
export const useHashRoute = () => {
  const [route, setRoute] = useState(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
};

export const hrefFor = (id: string) => `${PREFIX}${encodeURIComponent(id)}`;
