# Coach

Personlig mat- og treningsapp. Logg mat med vanlige ord («300 g yoghurt, 30 g havregryn»), skann strekkoder (Open Food Facts), søk i Matvaretabellen, logg styrkeøkter, se Garmin-tall og regn ut kalori- og makromål.

- Appen: `index.html` (publiseres med GitHub Pages fra grenen `gh-pages`)
- Data: Supabase med innlogging; hver bruker ser bare sine egne rader (radregler i databasen)
- Kildekode: `kilde/` – bygg med `node kilde/build.js`
- Tester og startdata ligger ikke her (de inneholder personlige data).
