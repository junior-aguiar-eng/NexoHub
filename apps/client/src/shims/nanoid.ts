const urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzict";

export const nanoid = (size = 21): string => {
  let id = "";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let i = size;
  while (i--) {
    id += urlAlphabet[bytes[i] & 63];
  }
  return id;
};

export const customAlphabet = (alphabet: string, defaultSize = 21) => {
  return (size = defaultSize): string => {
    let id = "";
    const bytes = crypto.getRandomValues(new Uint8Array(size));
    let i = size;
    while (i--) {
      id += alphabet[bytes[i] % alphabet.length];
    }
    return id;
  };
};

export { urlAlphabet };
export default nanoid;
