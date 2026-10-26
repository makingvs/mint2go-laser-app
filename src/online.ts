// Online-Suche in der Iconify-Bibliothek (api.iconify.design): offene Schnittstelle mit
// Suche, SVG-Abruf und Lizenzangabe je Sammlung. Für Kinder gibt es
//  - eine Liste erlaubter Sammlungen (config.json -> onlineSearch.sets),
//  - eine Übersetzung deutscher Suchwörter ins Englische (die Sammlungen sind englisch benannt),
//  - einen Filter für ungeeignete Begriffe in Suche und Ergebnissen.
import { safeName } from './names';

export const ICONIFY_API = 'https://api.iconify.design';

export interface SearchConfig {
  enabled: boolean;
  sets: string[];
}

/**
 * Nur Sammlungen mit eindeutiger Lizenz (MIT, Microsoft Fluent Emoji), einfarbige zuerst (gut zum Gravieren).
 * Noto Emoji bewusst nicht: Die Lizenzangaben des Projekts sind widersprüchlich (OFL in der Lizenzdatei, Apache 2.0 im README).
 */
export const DEFAULT_SEARCH: SearchConfig = {
  enabled: true,
  sets: ['fluent-emoji-high-contrast', 'fluent-emoji-flat'],
};

export const SET_CREDITS: Record<string, { name: string; author: string; license: string; url: string; licenseFile: string }> = {
  'fluent-emoji-high-contrast': { name: 'Fluent Emoji High Contrast', author: 'Microsoft Corporation', license: 'MIT', url: 'https://github.com/microsoft/fluentui-emoji', licenseFile: 'fluent-emoji' },
  'fluent-emoji-flat': { name: 'Fluent Emoji Flat', author: 'Microsoft Corporation', license: 'MIT', url: 'https://github.com/microsoft/fluentui-emoji', licenseFile: 'fluent-emoji' },
};

export function normalizeSearchConfig(input: unknown): SearchConfig {
  const j = (input && typeof input === 'object' ? input : {}) as Partial<SearchConfig>;
  const sets = Array.isArray(j.sets) ? j.sets.filter((s): s is string => typeof s === 'string' && /^[a-z0-9-]{1,40}$/.test(s)) : [];
  return { enabled: j.enabled !== false, sets: sets.length ? sets : DEFAULT_SEARCH.sets };
}

// ---------- Deutsch -> Englisch ----------
const DICT = `
katze=cat kater=cat kätzchen=cat hund=dog welpe=dog hase=rabbit kaninchen=rabbit maus=mouse ratte=rat hamster=hamster
meerschweinchen=guinea pig pferd=horse pony=horse kuh=cow schwein=pig schaf=sheep ziege=goat huhn=chicken hahn=rooster
küken=chick ente=duck gans=goose schwan=swan vogel=bird eule=owl adler=eagle papagei=parrot pinguin=penguin fisch=fish
hai=shark wal=whale delfin=dolphin krake=octopus krebs=crab qualle=jellyfish seestern=starfish schildkröte=turtle
frosch=frog schlange=snake krokodil=crocodile eidechse=lizard dinosaurier=dinosaur dino=dinosaur drache=dragon
einhorn=unicorn löwe=lion tiger=tiger bär=bear panda=panda koala=koala affe=monkey elefant=elephant giraffe=giraffe
zebra=zebra nashorn=rhinoceros nilpferd=hippopotamus känguru=kangaroo fuchs=fox wolf=wolf igel=hedgehog
eichhörnchen=squirrel reh=deer hirsch=deer fledermaus=bat schmetterling=butterfly biene=honeybee marienkäfer=lady beetle
ameise=ant spinne=spider käfer=beetle schnecke=snail wurm=worm libelle=dragonfly
auto=automobile pkw=automobile bus=bus lkw=truck traktor=tractor fahrrad=bicycle motorrad=motorcycle roller=kick scooter
zug=locomotive straßenbahn=tram flugzeug=airplane hubschrauber=helicopter rakete=rocket schiff=ship boot=boat
segelboot=sailboat ufo=flying saucer feuerwehr=fire engine polizeiauto=police car krankenwagen=ambulance bagger=excavator
baum=tree tanne=evergreen tree palme=palm tree blume=blossom rose=rose tulpe=tulip sonnenblume=sunflower blatt=leaf
kleeblatt=four leaf clover pilz=mushroom kaktus=cactus berg=mountain vulkan=volcano welle=water wave wolke=cloud sonne=sun
mond=moon stern=star komet=comet planet=ringed planet erde=globe regenbogen=rainbow regen=rain schnee=snowflake
schneemann=snowman blitz=high voltage tropfen=droplet feuer=fire flamme=fire insel=desert island strand=beach
apfel=apple birne=pear banane=banana erdbeere=strawberry kirsche=cherries traube=grapes orange=tangerine zitrone=lemon
ananas=pineapple wassermelone=watermelon karotte=carrot tomate=tomato mais=ear of corn brot=bread kuchen=cake torte=cake
eis=ice cream keks=cookie pizza=pizza burger=hamburger pommes=french fries ei=egg käse=cheese milch=glass of milk
lutscher=lollipop bonbon=candy schokolade=chocolate bar popcorn=popcorn brezel=pretzel donut=doughnut muffin=cupcake
haus=house schloss=castle burg=castle kirche=church schule=school zelt=tent leuchtturm=lighthouse brücke=bridge
herz=heart krone=crown schlüssel=key glocke=bell kerze=candle geschenk=wrapped gift ballon=balloon luftballon=balloon
drachen=kite teddy=teddy bear ball=soccer ball fußball=soccer ball basketball=basketball tennis=tennis schere=scissors
stift=pencil buch=book brille=glasses hut=top hat mütze=billed cap schuh=running shoe socke=socks handschuh=gloves
regenschirm=umbrella uhr=alarm clock lampe=light bulb glühbirne=light bulb gitarre=guitar klavier=musical keyboard
trompete=trumpet trommel=drum musik=musical note note=musical note telefon=telephone kamera=camera computer=laptop
roboter=robot alien=alien geist=ghost clown=clown zauberer=mage fee=fairy prinzessin=princess flagge=flag anker=anchor
kompass=compass diamant=gem stone ring=ring zauberstab=magic wand feuerwerk=fireworks weihnachtsbaum=christmas tree
kürbis=jack-o-lantern smiley=grinning face gesicht=face hand=waving hand daumen=thumbs up auge=eye pfote=paw prints
fußabdruck=footprints schwimmen=person swimming sport=sports medal pokal=trophy medaille=sports medal
`;

const dictionary = new Map<string, string>();
for (const entry of DICT.matchAll(/(\S+)=([^=]+?)(?=\s+\S+=|\s*$)/g)) dictionary.set(entry[1], entry[2].trim());

/** Deutsches Suchwort (auch Mehrzahl) ins Englische übersetzen; Unbekanntes bleibt unverändert. */
export function translateQuery(input: string): string {
  const words = input.toLowerCase().split(/[^\p{L}\p{N}-]+/u).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    let hit = dictionary.get(w);
    if (!hit) {
      for (const suffix of ['n', 'en', 'e', 's', 'er', 'se']) {
        if (w.endsWith(suffix) && w.length - suffix.length >= 2) {
          hit = dictionary.get(w.slice(0, -suffix.length));
          if (hit) break;
        }
      }
    }
    out.push(hit ?? w);
  }
  return out.join(' ');
}

// ---------- Kindersicherung ----------
/** Teile eines Wortes genügen (eindeutig genug). */
const BLOCKED_PARTS = [
  'pistol', 'rifle', 'revolver', 'knife', 'dagger', 'sword', 'bomb', 'grenade', 'skull', 'blood', 'syringe', 'cigar', 'smok',
  'cocktail', 'whisky', 'whiskey', 'vodka', 'alcohol', 'champagne', 'drunk', 'naked', 'penis', 'coffin', 'zombie', 'devil',
  'demon', 'gallows', 'drug', 'cannabis', 'toilet', 'middle-finger', 'middle finger', 'vomit', 'noose', 'hanged', 'crossbones',
  'blut', 'messer', 'schwert', 'totenkopf', 'zigarette', 'alkohol', 'nackt', 'teufel', 'droge', 'kacke', 'töten', 'mord',
  'krieg', 'hitler', 'nazi', 'swastika',
];
/** Nur als ganzes Wort (sonst würden z. B. "butterfly" oder "meerschweinchen" gesperrt). */
const BLOCKED_WORDS = ['gun', 'bone', 'butt', 'imp', 'sex', 'pill', 'sake', 'poo', 'sick', 'weed', 'grave', 'wine', 'beer', 'nude', 'breast', 'wein', 'bier', 'tod', 'klo', 'waffe', 'waffen'];
const WORD_RE = new RegExp(String.raw`(^|[^\p{L}])(${BLOCKED_WORDS.join('|')})([^\p{L}]|$)`, 'u');

/** true, wenn der Begriff für Kinder nicht in Frage kommt. */
export function isBlocked(text: string): boolean {
  const t = text.toLowerCase();
  return BLOCKED_PARTS.some((p) => t.includes(p)) || WORD_RE.test(t);
}

// ---------- Suche ----------
export interface Hit {
  prefix: string;
  name: string;
  /** Vorschaubild */
  thumb: string;
  /** SVG-Adresse */
  url: string;
}

export const iconUrl = (prefix: string, name: string): string => `${ICONIFY_API}/${prefix}/${name}.svg`;

export type SearchOutcome = { kind: 'ok'; hits: Hit[] } | { kind: 'blocked' } | { kind: 'offline' };

/** Sucht in den erlaubten Sammlungen. Eingabe darf deutsch sein. */
export async function searchIcons(input: string, sets: string[], signal?: AbortSignal): Promise<SearchOutcome> {
  if (isBlocked(input)) return { kind: 'blocked' };
  const term = translateQuery(input);
  if (!term || isBlocked(term)) return { kind: 'blocked' };
  try {
    const url = `${ICONIFY_API}/search?query=${encodeURIComponent(term)}&prefixes=${sets.join(',')}&limit=96`;
    const res = await fetch(url, { signal });
    if (!res.ok) return { kind: 'offline' };
    const data = (await res.json()) as { icons?: string[] };
    const rank = (p: string) => sets.indexOf(p);
    const hits: Hit[] = [];
    const seen = new Set<string>();
    const sorted = [...(data.icons ?? [])].sort((a, b) => rank(a.split(':')[0]) - rank(b.split(':')[0]));
    for (const id of sorted) {
      const [prefix, name] = id.split(':');
      if (!prefix || !name || isBlocked(name) || seen.has(name)) continue;
      seen.add(name);
      hits.push({ prefix, name, thumb: iconUrl(prefix, name), url: iconUrl(prefix, name) });
    }
    return { kind: 'ok', hits: hits.slice(0, 60) };
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') throw e;
    return { kind: 'offline' };
  }
}

export async function fetchIconSvg(hit: Hit): Promise<string> {
  const res = await fetch(hit.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!/<svg[\s>]/.test(text.slice(0, 2000)) || /<script/i.test(text)) throw new Error('kein SVG');
  return text;
}

/** Kurzer, dateisicherer Name für Anzeige/Referenz. */
export const hitRef = (hit: Pick<Hit, 'prefix' | 'name'>): string => `iconify:${hit.prefix}:${safeName(hit.name, 'icon')}`;

/** Vorschläge zum Antippen (Emoji + deutsches Suchwort) – damit auch ohne Tippen gesucht werden kann. */
export const TOPICS: { emoji: string; query: string }[] = [
  { emoji: '🐱', query: 'katze' }, { emoji: '🐶', query: 'hund' }, { emoji: '🐴', query: 'pferd' }, { emoji: '🐟', query: 'fisch' },
  { emoji: '🦋', query: 'schmetterling' }, { emoji: '🐘', query: 'elefant' }, { emoji: '🦖', query: 'dinosaurier' }, { emoji: '🦄', query: 'einhorn' },
  { emoji: '🚗', query: 'auto' }, { emoji: '🚀', query: 'rakete' }, { emoji: '✈️', query: 'flugzeug' }, { emoji: '🚂', query: 'zug' },
  { emoji: '🌳', query: 'baum' }, { emoji: '🌸', query: 'blume' }, { emoji: '☀️', query: 'sonne' }, { emoji: '⭐', query: 'stern' },
  { emoji: '🍎', query: 'apfel' }, { emoji: '🍦', query: 'eis' }, { emoji: '🎂', query: 'kuchen' }, { emoji: '🏠', query: 'haus' },
  { emoji: '🏰', query: 'schloss' }, { emoji: '👑', query: 'krone' }, { emoji: '🎈', query: 'ballon' }, { emoji: '⚽', query: 'fußball' },
];
