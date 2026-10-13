// OpenStreetMapin paikkatyypit (Nominatimin `type`) suomeksi. Tuntematon tyyppi -> null,
// jolloin kategoria jää tyhjäksi eikä käyttäjä näe teknistä tunnistetta.
const FI = {
  // Ruoka ja juoma
  cafe: 'kahvila', restaurant: 'ravintola', fast_food: 'pikaruoka', bar: 'baari', pub: 'pubi',
  biergarten: 'terassi', ice_cream: 'jäätelöbaari', food_court: 'ruokamaailma', bakery: 'leipomo',
  // Liikunta ja vapaa-aika
  swimming_pool: 'uimahalli', sports_centre: 'urheilukeskus', fitness_centre: 'kuntosali',
  sports_hall: 'urheiluhalli', stadium: 'stadion', pitch: 'kenttä', ice_rink: 'jäähalli',
  golf_course: 'golfkenttä', water_park: 'vesipuisto', sauna: 'sauna', beach_resort: 'uimaranta',
  beach: 'uimaranta', park: 'puisto', playground: 'leikkipuisto', garden: 'puutarha',
  nature_reserve: 'luonnonsuojelualue', national_park: 'kansallispuisto', marina: 'venesatama',
  dog_park: 'koirapuisto', track: 'ulkoilureitti', ski_resort: 'laskettelukeskus',
  // Kulttuuri ja nähtävyydet
  museum: 'museo', gallery: 'galleria', arts_centre: 'kulttuurikeskus', theatre: 'teatteri',
  cinema: 'elokuvateatteri', library: 'kirjasto', attraction: 'nähtävyys', viewpoint: 'näköalapaikka',
  zoo: 'eläintarha', theme_park: 'huvipuisto', aquarium: 'akvaario', castle: 'linna',
  monument: 'muistomerkki', memorial: 'muistomerkki', ruins: 'rauniot', artwork: 'taideteos',
  concert_hall: 'konserttitalo', events_venue: 'tapahtumapaikka', community_centre: 'yhteisötila',
  // Majoitus
  hotel: 'hotelli', hostel: 'hostelli', guest_house: 'majatalo', motel: 'motelli',
  camp_site: 'leirintäalue', chalet: 'mökki', apartment: 'huoneisto', wilderness_hut: 'autiotupa',
  // Kaupat
  supermarket: 'ruokakauppa', convenience: 'lähikauppa', mall: 'kauppakeskus',
  department_store: 'tavaratalo', marketplace: 'tori', books: 'kirjakauppa', clothes: 'vaatekauppa',
  garden_centre: 'puutarhamyymälä', hardware: 'rautakauppa', doityourself: 'rautakauppa',
  second_hand: 'kirpputori', florist: 'kukkakauppa', pharmacy: 'apteekki', kiosk: 'kioski',
  // Palvelut
  hospital: 'sairaala', clinic: 'terveysasema', doctors: 'lääkäri', dentist: 'hammaslääkäri',
  hairdresser: 'kampaamo', school: 'koulu', university: 'yliopisto', college: 'oppilaitos',
  kindergarten: 'päiväkoti', townhall: 'kaupungintalo', post_office: 'posti', bank: 'pankki',
  place_of_worship: 'kirkko', church: 'kirkko', cathedral: 'tuomiokirkko', chapel: 'kappeli',
  cemetery: 'hautausmaa', grave_yard: 'hautausmaa', office: 'toimisto', parking: 'pysäköinti',
  fuel: 'huoltoasema', charging_station: 'latauspiste',
  // Liikenne
  station: 'asema', train_station: 'rautatieasema', bus_station: 'linja-autoasema',
  aerodrome: 'lentokenttä', ferry_terminal: 'satama', harbour: 'satama', bus_stop: 'pysäkki',
  tram_stop: 'raitiovaunupysäkki', subway_entrance: 'metroasema',
  // Paikkakunnat ja alueet
  city: 'kaupunki', town: 'kaupunki', village: 'kylä', hamlet: 'kylä', suburb: 'kaupunginosa',
  neighbourhood: 'asuinalue', quarter: 'kaupunginosa', island: 'saari', islet: 'saari',
  administrative: 'alue', lake: 'järvi', water: 'vesistö', peak: 'huippu', forest: 'metsä',
  wood: 'metsä', bay: 'lahti',
  // Rakennukset
  house: 'talo', residential: 'asuinalue', building: 'rakennus', commercial: 'liikerakennus',
};

// Urheilupaikoissa laji kertoo enemmän kuin yleinen tyyppi (OSM: sport=swimming jne.)
const SPORT_FI = {
  swimming: 'uimahalli', ice_hockey: 'jäähalli', skating: 'jäähalli', tennis: 'tenniskenttä',
  padel: 'padelhalli', golf: 'golfkenttä', climbing: 'kiipeilykeskus', bowling: 'keilahalli',
  fitness: 'kuntosali', equestrian: 'talli', skiing: 'hiihtokeskus', football: 'jalkapallokenttä',
};
const SPORT_TYPES = new Set(['sports_centre', 'sports_hall', 'swimming_pool', 'pitch', 'stadium', 'fitness_centre']);

export function placeTypeFi(type, extratags) {
  if (SPORT_TYPES.has(type) && extratags?.sport) {
    const sport = extratags.sport.split(';').map(x => x.trim()).find(x => SPORT_FI[x]);
    if (sport) return SPORT_FI[sport];
  }
  return FI[type] ?? null;
}
