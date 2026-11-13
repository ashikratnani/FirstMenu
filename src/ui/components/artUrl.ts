// URL of a picture file shipped in public/art (design "Food art", "Picture
// files"). Built from the Vite base so it works under the Pages base path
// (/FirstMenu/art/foods/carrot.webp). The files are copied as they are, never
// inlined, and never fetched from another host.

export function artUrl(folder: 'foods' | 'state', name: string): string {
  return `${import.meta.env.BASE_URL}art/${folder}/${name}.webp`;
}
