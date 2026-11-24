/**
 * Font faces are fetched by the boot manifest, not by the entry module, so the
 * loader can paint immediately with system fallbacks. Importing this module
 * registers every face with the document; the manifest then asks the browser
 * to parse the ones each page needs.
 */
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/playfair-display';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/neucha/latin-400.css';
import '@fontsource/noto-serif-devanagari/devanagari-500.css';
import '@fontsource/noto-serif-bengali/bengali-500.css';
