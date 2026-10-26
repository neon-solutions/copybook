import { useEffect, useState } from "react";

const PREFIX = "#/";

const read = () =>
  window.location.hash.startsWith(PREFIX)
    ? decodeURIComponent(window.location.hash.slice(PREFIX.length))
    : undefined;

/** The selected definition id, kept in the URL hash so links work. */
export const useHashRoute = () => {
  const [id, setId] = useState(read);

  useEffect(() => {
    const onChange = () => setId(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return id;
};

export const hrefFor = (id: string) => `${PREFIX}${encodeURIComponent(id)}`;
