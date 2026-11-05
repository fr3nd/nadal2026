// URL "cheats" for previewing the game (README: "Previewing without playing").
// They only work when the page is served from localhost: on the online game the
// parameters are ignored completely.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export const isLocalHost = (hostname) => LOCAL_HOSTS.has(hostname);

export function readDebug(search, hostname) {
  const off = { on: false, seconds: 0, meters: 0, god: false, over: false, star: false };
  if (!isLocalHost(hostname)) return off;
  const q = new URLSearchParams(search);
  const num = (k) => (q.has(k) ? Number(q.get(k)) || 0 : 0);
  const d = { seconds: num('t'), meters: num('m'), god: q.has('god'), over: q.has('over'), star: q.has('star') };
  return { ...d, on: d.seconds > 0 || d.meters > 0 || d.god || d.over || d.star };
}
